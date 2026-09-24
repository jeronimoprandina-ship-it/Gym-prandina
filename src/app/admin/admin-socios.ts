import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GymDataService } from '../core/gym-data.service';
import { PaymentService } from '../core/payment.service';
import { UserAccountsService } from '../core/user-accounts.service';
import { authErrorMessage } from '../auth.service';
import { Member, Routine } from '../core/models';

/** Alta, edición, baja y asignación de rutinas. Solo admin. */
@Component({
  selector: 'app-admin-socios',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-socios.html'
})
export class AdminSociosComponent {
  protected readonly data = inject(GymDataService);
  private readonly payment = inject(PaymentService);
  private readonly accounts = inject(UserAccountsService);
  private readonly router = inject(Router);

  protected readonly searchTerm = signal('');

  protected readonly filteredMembers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return this.data.members().filter(member =>
      member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term));
  });

  // --- Modal de alta / edición ---
  protected readonly isMemberModalOpen = signal(false);
  protected readonly editingMember = signal<Member | null>(null);
  protected readonly formError = signal('');
  protected readonly isSaving = signal(false);
  /** Aviso cuando el correo ya tenia cuenta y solo se vinculo la ficha. */
  protected readonly formNotice = signal('');
  protected memberForm = { name: '', email: '', password: '', plan: 'Plan mensual' };

  protected openMemberModal(member: Member | null = null) {
    this.editingMember.set(member);
    this.formError.set('');
    this.formNotice.set('');
    this.memberForm = member
      ? { name: member.name, email: member.email, password: '', plan: member.plan }
      : { name: '', email: '', password: '', plan: 'Plan mensual' };
    this.isMemberModalOpen.set(true);
  }

  protected closeMemberModal() {
    this.isMemberModalOpen.set(false);
  }

  protected async saveMember() {
    if (this.isSaving()) return;
    this.formError.set('');
    this.formNotice.set('');

    const editing = this.editingMember();
    const name = this.memberForm.name.trim();
    const email = this.memberForm.email.trim().toLowerCase();

    if (!name || !email) {
      this.formError.set('Completá el nombre y el correo.');
      return;
    }
    // Al editar no se toca la contrasena: la cuenta ya existe.
    if (!editing && this.memberForm.password.length < 6) {
      this.formError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isSaving.set(true);
    try {
      if (!editing) {
        // Primero la cuenta: si falla, no queremos una ficha sin acceso.
        const result = await this.accounts.create(name, email, this.memberForm.password);
        if (result.alreadyExisted) {
          this.formNotice.set('Ese correo ya tenía cuenta. Le vinculamos la ficha de socio.');
        }
      }
      await this.data.saveMember({ name, email, plan: this.memberForm.plan }, editing);

      // Con un aviso que mostrar, dejamos el modal abierto para que se lea.
      if (!this.formNotice()) {
        this.editingMember.set(null);
        this.isMemberModalOpen.set(false);
      }
    } catch (error) {
      this.formError.set(authErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async removeMember(member: Member) {
    // La cuenta de Firebase no se puede borrar desde el navegador: el SDK de
    // cliente solo permite borrar la sesion propia. Hace falta una Cloud
    // Function con el Admin SDK. Lo decimos en vez de aparentar que se borro.
    const aviso = `¿Eliminar a ${member.name}?

`
      + `Se borra su ficha de socio y pierde el acceso al portal.

`
      + `Su cuenta de Firebase (${member.email}) NO se elimina: eso requiere `
      + `una Cloud Function. Va a poder iniciar sesion, pero sin ficha asociada.`;
    if (!confirm(aviso)) return;
    await this.data.removeMember(member);
  }

  // --- Modal de asignar rutina ---
  protected readonly isRoutineModalOpen = signal(false);
  protected readonly selectedMember = signal<Member | null>(null);

  protected openRoutineModal(member: Member) {
    this.selectedMember.set(member);
    this.isRoutineModalOpen.set(true);
  }

  protected closeRoutineModal() {
    this.isRoutineModalOpen.set(false);
  }

  protected async assignRoutine(routine: Routine) {
    const member = this.selectedMember();
    if (member) await this.data.assignRoutine(member, routine.name);
    this.isRoutineModalOpen.set(false);
  }

  // --- Acciones sueltas ---
  protected managePayment(member: Member) {
    this.payment.open(member);
  }

  /** Abre la ficha del socio en su propio portal, en modo lectura. */
  protected viewPortal(member: Member) {
    this.router.navigate(['/admin/socios', member.id]);
  }
}
