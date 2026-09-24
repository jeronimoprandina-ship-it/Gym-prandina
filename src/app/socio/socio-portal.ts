import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../auth.service';
import { ExercisesService } from '../core/exercises.service';
import { GymDataService } from '../core/gym-data.service';
import { PaymentService } from '../core/payment.service';
import { MUSCLE_GROUPS, WEEK_DAYS, WEEK_SCHEDULE } from '../core/models';

type SocioTab = 'resumen' | 'ejercicios' | 'pagos' | 'rutina';

/**
 * Portal del socio.
 *
 * Se usa en dos rutas:
 *   /socio             el socio viendo su propia ficha (se busca por correo)
 *   /admin/socios/:id  el admin viendo la ficha de alguien (se busca por id)
 *
 * El `:id` en la ruta es lo único que cambia entre ambos casos.
 */
@Component({
  selector: 'app-socio-portal',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './socio-portal.html'
})
export class SocioPortalComponent {
  private readonly auth = inject(AuthService);
  protected readonly data = inject(GymDataService);
  private readonly payment = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly exercises = inject(ExercisesService);
  protected readonly weekDays = WEEK_DAYS;
  protected readonly weekSchedule = WEEK_SCHEDULE;
  protected readonly categories = MUSCLE_GROUPS;

  private readonly memberId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id'))),
    { initialValue: null as string | null }
  );

  /** true cuando lo abre un admin desde la tabla de socios. */
  protected readonly isViewedByAdmin = computed(() => this.memberId() !== null);

  protected readonly member = computed(() => {
    const id = this.memberId();
    return id
      ? this.data.findMemberById(id) ?? null
      : this.data.findMemberByEmail(this.auth.user()?.email) ?? null;
  });

  protected readonly accessMessage = computed(() => {
    if (this.member()) return '';
    if (this.isViewedByAdmin()) return 'No encontramos ese socio.';
    // Si Firestore fallo, decir "consultá al administrador" es enganoso:
    // el problema es tecnico y conviene que se vea.
    if (this.data.dataError()) return this.data.dataError();
    return 'Estamos preparando tu ficha de socio. Recargá en unos segundos.';
  });

  protected readonly routine = computed(() => this.data.findRoutineByName(this.member()?.routine));
  protected readonly membership = computed(() => this.data.findMembershipByName(this.member()?.plan));

  protected readonly tab = signal<SocioTab>('resumen');
  protected readonly search = signal('');
  protected readonly category = signal('Todos');

  protected readonly filteredExercises = computed(() =>
    this.exercises.filter(this.search(), this.category()));

  constructor() {
    this.exercises.load();
  }

  protected setTab(tab: SocioTab) {
    this.tab.set(tab);
  }

  protected back() {
    this.router.navigate(['/admin/socios']);
  }

  protected managePayment() {
    const member = this.member();
    if (member) this.payment.open(member);
  }
}
