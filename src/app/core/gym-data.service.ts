import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore, addDoc, collection, collectionData, deleteDoc, doc, query, updateDoc, where
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth.service';
import { Member, Membership, Routine } from './models';

/**
 * Datos del gimnasio: socios, rutinas y membresias.
 *
 * Si hay Firestore disponible, manda Firestore. Si no (entorno local sin
 * emulador), se queda con los datos de ejemplo del final del archivo para que
 * la app siga siendo navegable.
 */
@Injectable({ providedIn: 'root' })
export class GymDataService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private membersSubscription?: Subscription;
  /** Evita que dos emisiones seguidas del listener creen dos fichas. */
  private creatingMember = false;

  /** Ultimo error de Firestore, para poder mostrarlo en vez de ocultarlo. */
  readonly dataError = signal('');

  readonly members = signal<Member[]>(DEMO_MEMBERS);
  readonly routines = signal<Routine[]>(DEMO_ROUTINES);
  readonly memberships = signal<Membership[]>(DEMO_MEMBERSHIPS);

  /**
   * Metricas que todavia NO salen de datos reales.
   *
   * `income` y `net` ya no estan aca: se calculan mas abajo a partir de los
   * socios. El resto sigue fijo porque no hay de donde sacarlo (haria falta
   * registro de asistencia y una caja de gastos).
   */
  readonly summaryMetrics = {
    expenses: 480000,
    attendance: 84,
    adherence: 72,
    retention: 91
  };

  /**
   * Ingreso mensual de las membresias vigentes.
   *
   * Suma solo a los socios en 'Pago': quien no abono todavia no es un ingreso.
   *
   * Cada plan se lleva a su equivalente mensual, asi un socio anual no infla
   * el mes doce veces. Un socio con plan anual de $150.000 aporta ~$12.300 por
   * mes, no $150.000.
   *
   * OJO: esto es el valor recurrente de las membresias activas, no la
   * facturacion del mes calendario. Para eso haria falta guardar la fecha de
   * cada pago, que hoy el modelo no tiene.
   */
  readonly monthlyIncome = computed(() =>
    this.members()
      .filter(member => member.status === 'Pago')
      .reduce((total, member) => total + this.monthlyValueOf(member.plan), 0)
  );

  /** Ingresos menos gastos. Los gastos siguen siendo un valor fijo. */
  readonly monthlyNet = computed(() => this.monthlyIncome() - this.summaryMetrics.expenses);

  /**
   * Valor mensual equivalente de un plan, tomando un mes como 30 dias.
   * Mensual (30d) -> precio entero. Trimestral (90d) -> precio / 3.
   */
  private monthlyValueOf(planName: string): number {
    const membership = this.findMembershipByName(planName);
    if (!membership) return 0;
    const dias = Number(membership.duration.match(/\d+/)?.[0] ?? 30);
    const meses = dias / 30;
    return meses > 0 ? membership.price / meses : membership.price;
  }

  readonly activeMembersCount = computed(() => this.members().filter(m => m.status === 'Pago').length);
  readonly expiringMembersCount = computed(() => this.members().filter(m => m.status === 'No pago').length);
  readonly assignedRoutinesCount = computed(() => this.members().filter(m => m.routine !== 'Sin asignar').length);

  constructor() {
    if (this.firestore) {
      // Si la coleccion viene vacia dejamos los datos de ejemplo: es un
      // proyecto recien creado, no una lista que el admin vacio a proposito.
      this.watch<Routine>('routines', this.routines);
      this.watch<Membership>('memberships', this.memberships);
    }
    this.destroyRef.onDestroy(() => this.membersSubscription?.unsubscribe());

    effect(() => {
      const email = this.auth.user()?.email ?? null;
      const role = this.auth.role();
      if (!role) return;
      // untracked: sin esto, escribir `members` volveria a disparar el effect.
      untracked(() => this.loadMembers(email, role === 'admin'));
    });
  }

  private watch<T>(path: string, target: ReturnType<typeof signal<T[]>>) {
    collectionData(collection(this.firestore!, path), { idField: 'id' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: records => {
          if (records.length) target.set(records as T[]);
        },
        error: () => undefined
      });
  }

  /** El admin trae todos los socios; el socio, solo su propia ficha. */
  private loadMembers(email: string | null, isAdmin: boolean) {
    if (!this.firestore || !email) return;
    this.membersSubscription?.unsubscribe();
    const membersCollection = collection(this.firestore, 'members');
    const membersQuery = isAdmin
      ? membersCollection
      : query(membersCollection, where('email', '==', email.toLowerCase()));
    this.membersSubscription = collectionData(membersQuery, { idField: 'id' }).subscribe({
      // Ojo: no recrear la ficha si viene vacia. Esa auto-reparacion existia
      // para tapar el bug de las dos copias del SDK, y ahora haria que una
      // baja hecha por el admin se deshiciera sola en el proximo login.
      next: records => this.members.set(records as Member[]),
      error: error => this.dataError.set(describeError(error))
    });
  }

  findMemberById(id: string): Member | undefined {
    return this.members().find(member => member.id === id);
  }

  findMemberByEmail(email: string | null | undefined): Member | undefined {
    if (!email) return undefined;
    const target = email.toLowerCase();
    return this.members().find(member => member.email.toLowerCase() === target);
  }

  findRoutineByName(name: string | undefined): Routine | undefined {
    return this.routines().find(routine => routine.name === name);
  }

  findMembershipByName(name: string | undefined): Membership | undefined {
    return this.memberships().find(membership => membership.name === name);
  }

  // --- Socios ---------------------------------------------------------------

  async saveMember(
    form: { name: string; email: string; plan: string },
    editing: Member | null,
    status: Member['status'] = 'Pago'
  ) {
    const data = {
      ...buildMemberData(form.name, form.email, form.plan),
      status
    };

    if (this.firestore) {
      if (editing?.id) await updateDoc(doc(this.firestore, 'members', editing.id), data);
      else await addDoc(collection(this.firestore, 'members'), data);
      return;
    }
    if (editing) {
      this.members.update(list => list.map(m => m.id === editing.id ? { ...m, ...data } : m));
    } else {
      this.members.update(list => [{ id: Date.now().toString(), ...data }, ...list]);
    }
  }

  /**
   * Crea la ficha del socio que acaba de registrarse, si todavia no tiene una.
   *
   * Registrarse y estar dado de alta como socio son dos cosas distintas: la
   * cuenta vive en Firebase Auth y la ficha en `members`. Sin esto, quien se
   * registra entra pero ve "tu cuenta no esta asociada a un socio".
   *
   * Arranca en 'No pago' porque todavia no abono la cuota.
   */
  async ensureMemberFor(name: string, email: string) {
    if (this.findMemberByEmail(email) || this.creatingMember) return;
    const data = { ...buildMemberData(name, email, 'Plan mensual'), status: 'No pago' as const };

    this.creatingMember = true;
    try {
      if (this.firestore) {
        await addDoc(collection(this.firestore, 'members'), data);
      } else {
        this.members.update(list => [{ id: Date.now().toString(), ...data }, ...list]);
      }
      this.dataError.set('');
    } catch (error) {
      // Antes esto se tragaba en silencio y el socio veia "no estas asociado"
      // sin ninguna pista de por que.
      this.dataError.set(describeError(error));
    } finally {
      this.creatingMember = false;
    }
  }

  /**
   * Registra el cobro de la cuota: deja al socio en 'Pago' y corre el
   * vencimiento segun la duracion de su plan.
   *
   * Las reglas solo permiten esta escritura al admin, a proposito: si un socio
   * pudiera hacerlo, se marcaria como pago sin pagar.
   */
  async markAsPaid(member: Member) {
    const dias = this.planDurationInDays(member.plan);
    const cambios = { status: 'Pago' as const, expires: addDays(new Date(), dias) };

    if (this.firestore && member.id) {
      try {
        await updateDoc(doc(this.firestore, 'members', member.id), cambios);
        this.dataError.set('');
      } catch (error) {
        this.dataError.set(describeError(error));
        return;
      }
    }
    this.members.update(list => list.map(m => m.id === member.id ? { ...m, ...cambios } : m));
  }

  /** Saca los dias del texto del plan ("30 dias"). Si no matchea, asume un mes. */
  private planDurationInDays(planName: string): number {
    const duracion = this.findMembershipByName(planName)?.duration ?? '';
    const match = duracion.match(/\d+/);
    return match ? Number(match[0]) : 30;
  }

  async removeMember(member: Member) {
    if (this.firestore && member.id) {
      await deleteDoc(doc(this.firestore, 'members', member.id));
      return;
    }
    this.members.update(list => list.filter(item => item.id !== member.id));
  }

  async assignRoutine(member: Member, routineName: string) {
    if (this.firestore && member.id) {
      await updateDoc(doc(this.firestore, 'members', member.id), { routine: routineName })
        .catch(() => undefined);
    }
    this.members.update(list => list.map(m => m.id === member.id ? { ...m, routine: routineName } : m));
  }

  // --- Rutinas --------------------------------------------------------------

  async saveRoutine(form: Omit<Routine, 'id'>, editing: Routine | null) {
    const routine = { ...form, name: form.name.trim() };
    if (this.firestore) {
      if (editing?.id) await updateDoc(doc(this.firestore, 'routines', editing.id), routine);
      else await addDoc(collection(this.firestore, 'routines'), routine);
      return;
    }
    if (editing) {
      this.routines.update(list => list.map(r => r === editing ? { ...r, ...routine } : r));
    } else {
      this.routines.update(list => [{ ...routine, id: Date.now().toString() }, ...list]);
    }
  }

  async deleteRoutine(routine: Routine) {
    if (this.firestore && routine.id) {
      await deleteDoc(doc(this.firestore, 'routines', routine.id));
      return;
    }
    // Comparacion por identidad: las rutinas de ejemplo no tienen id.
    this.routines.update(list => list.filter(item => item !== routine));
  }

  // --- Membresias -----------------------------------------------------------

  async saveMembership(form: Omit<Membership, 'id'>, editing: Membership | null) {
    const membership = { ...form, name: form.name.trim() };
    if (this.firestore) {
      if (editing?.id) await updateDoc(doc(this.firestore, 'memberships', editing.id), membership);
      else await addDoc(collection(this.firestore, 'memberships'), membership);
      return;
    }
    if (editing) {
      this.memberships.update(list => list.map(m => m.id === editing.id ? { ...m, ...membership } : m));
    } else {
      this.memberships.update(list => [...list, { id: Date.now().toString(), ...membership }]);
    }
  }

  async deleteMembership(membership: Membership) {
    if (this.firestore && membership.id) {
      await deleteDoc(doc(this.firestore, 'memberships', membership.id));
      return;
    }
    this.memberships.update(list => list.filter(item => item.id !== membership.id));
  }
}

function describeError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code.includes('permission-denied')) {
    return 'Firestore rechazó la operación. Revisá que las reglas estén publicadas.';
  }
  if (code.includes('unavailable')) {
    return 'No hay conexión con Firestore. Revisá tu internet.';
  }
  return error instanceof Error ? error.message : 'Error desconocido de Firestore.';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Mantiene el formato de fecha que ya usaba el resto de la app. */
function addDays(desde: Date, dias: number): string {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + dias);
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${dia} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

/** Campos derivados comunes a toda alta de socio. */
function buildMemberData(name: string, email: string, plan: string) {
  const parts = name.trim().split(' ');
  return {
    name: name.trim(),
    // Normalizado: el portal del socio busca su ficha por correo.
    email: email.trim().toLowerCase(),
    plan,
    expires: '21 sep 2026',
    routine: 'Sin asignar',
    initials: ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'S',
    color: '#c7d9b7'
  };
}

// --- Datos de ejemplo (se usan cuando no hay Firestore) ----------------------

const DEMO_MEMBERS: Member[] = [
  { id: '1', name: 'Sofía Martínez', email: 'sofia.martinez@email.com', plan: 'Plan mensual', expires: '28 ago 2026', status: 'Pago', routine: 'Hipertrofia superior', initials: 'SM', color: '#e7c6a5' },
  { id: '2', name: 'Lucas Fernández', email: 'lucas.fernandez@email.com', plan: 'Plan trimestral', expires: '24 ago 2026', status: 'No pago', routine: 'Fuerza inicial', initials: 'LF', color: '#b8d8d8' },
  { id: '3', name: 'Valentina Rojas', email: 'valentina.rojas@email.com', plan: 'Plan mensual', expires: '15 sep 2026', status: 'Pago', routine: 'Acondicionamiento', initials: 'VR', color: '#d7c6e5' },
  { id: '4', name: 'Mateo Silva', email: 'mateo.silva@email.com', plan: 'Plan mensual', expires: '02 ago 2026', status: 'No pago', routine: 'Sin asignar', initials: 'MS', color: '#f0c7c0' },
];

const DEMO_ROUTINES: Routine[] = [
  { name: 'Fuerza inicial', level: 'Principiante', duration: '45 min', focus: 'Cuerpo completo', exercises: 8 },
  { name: 'Hipertrofia superior', level: 'Intermedio', duration: '60 min', focus: 'Tren superior', exercises: 10 },
  { name: 'Acondicionamiento', level: 'Avanzado', duration: '40 min', focus: 'Cardio y core', exercises: 7 },
];

const DEMO_MEMBERSHIPS: Membership[] = [
  { id: '1', name: 'Plan mensual', price: 15000, duration: '30 días', description: 'Acceso ilimitado a todas las instalaciones' },
  { id: '2', name: 'Plan trimestral', price: 39000, duration: '90 días', description: 'Acceso ilimitado + 1 clase grupal gratis' },
  { id: '3', name: 'Plan anual', price: 150000, duration: '365 días', description: 'Acceso ilimitado + clases + asesoramiento' }
];
