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

  readonly members = signal<Member[]>(DEMO_MEMBERS);
  readonly routines = signal<Routine[]>(DEMO_ROUTINES);
  readonly memberships = signal<Membership[]>(DEMO_MEMBERSHIPS);

  /** Metricas del panel. Hoy son fijas: no hay una fuente real todavia. */
  readonly summaryMetrics = {
    income: 1240000,
    expenses: 480000,
    net: 760000,
    attendance: 84,
    adherence: 72,
    retention: 91
  };

  readonly activeMembersCount = computed(() => this.members().filter(m => m.status === 'Pago').length);
  readonly expiringMembersCount = computed(() => this.members().filter(m => m.status === 'No pago').length);
  readonly assignedRoutinesCount = computed(() => this.members().filter(m => m.routine !== 'Sin asignar').length);

  constructor() {
    if (this.firestore) {
      collectionData(collection(this.firestore, 'routines'), { idField: 'id' })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: records => {
            if (records.length) this.routines.set(records as Routine[]);
          },
          error: () => undefined
        });
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

  /** El admin trae todos los socios; el socio, solo su propia ficha. */
  private loadMembers(email: string | null, isAdmin: boolean) {
    if (!this.firestore || !email) return;
    this.membersSubscription?.unsubscribe();
    const membersCollection = collection(this.firestore, 'members');
    const membersQuery = isAdmin
      ? membersCollection
      : query(membersCollection, where('email', '==', email.toLowerCase()));
    this.membersSubscription = collectionData(membersQuery, { idField: 'id' }).subscribe({
      next: records => this.members.set(records as Member[]),
      error: () => undefined
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

  async saveMember(form: { name: string; email: string; plan: string }, editing: Member | null) {
    const parts = form.name.trim().split(' ');
    const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
    const data = {
      name: form.name.trim(),
      // Normalizado: el portal del socio busca su ficha por correo.
      email: form.email.trim().toLowerCase(),
      plan: form.plan,
      expires: '21 sep 2026',
      status: 'Pago' as const,
      routine: 'Sin asignar',
      initials,
      color: '#c7d9b7'
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

  saveMembership(form: Omit<Membership, 'id'>, editing: Membership | null) {
    const membership = { ...form, name: form.name.trim() };
    if (editing) {
      this.memberships.update(list => list.map(m => m.id === editing.id ? { ...m, ...membership } : m));
    } else {
      this.memberships.update(list => [...list, { id: Date.now().toString(), ...membership }]);
    }
  }

  deleteMembership(membership: Membership) {
    this.memberships.update(list => list.filter(item => item.id !== membership.id));
  }
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
