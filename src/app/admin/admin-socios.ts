import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GymDataService } from '../core/gym-data.service';
import { PaymentService } from '../core/payment.service';
import { Member, PLAN_AMOUNTS, Routine } from '../core/models';

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
  protected memberForm = { name: '', email: '', plan: 'Plan mensual' };

  protected openMemberModal(member: Member | null = null) {
    this.editingMember.set(member);
    this.memberForm = member
      ? { name: member.name, email: member.email, plan: member.plan }
      : { name: '', email: '', plan: 'Plan mensual' };
    this.isMemberModalOpen.set(true);
  }

  protected closeMemberModal() {
    this.isMemberModalOpen.set(false);
  }

  protected async saveMember() {
    if (!this.memberForm.name.trim() || !this.memberForm.email.trim()) return;
    await this.data.saveMember(this.memberForm, this.editingMember());
    this.editingMember.set(null);
    this.isMemberModalOpen.set(false);
  }

  protected async removeMember(member: Member) {
    if (!confirm(`¿Eliminar a ${member.name}?`)) return;
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
    this.payment.open(member.plan, PLAN_AMOUNTS[member.plan] ?? '$15.000', 'Tarjeta');
  }

  /** Abre la ficha del socio en su propio portal, en modo lectura. */
  protected viewPortal(member: Member) {
    this.router.navigate(['/admin/socios', member.id]);
  }
}
