import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { GymDataService } from './gym-data.service';
import { Member, PLAN_AMOUNTS, PaymentMethod, PaymentReceipt } from './models';

/**
 * Cobro de la cuota. Lo abren dos pantallas: la tabla de socios del admin y el
 * portal del socio, asi que el estado vive en un servicio.
 *
 * El cobro en si es simulado (no hay pasarela de pago), pero el efecto sobre
 * el socio es real: queda en 'Pago' y se le corre el vencimiento.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly data = inject(GymDataService);
  private readonly auth = inject(AuthService);

  readonly isFormOpen = signal(false);
  readonly isReceiptOpen = signal(false);
  readonly member = signal<Member | null>(null);
  readonly plan = signal('');
  readonly amount = signal('');
  readonly method = signal<PaymentMethod>('Tarjeta');
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly receipt = signal<PaymentReceipt | null>(null);

  form = { name: '', email: '', lastFour: '' };

  open(member: Member, method: PaymentMethod = 'Tarjeta') {
    this.member.set(member);
    this.plan.set(member.plan);
    this.amount.set(this.priceOf(member.plan));
    this.method.set(method);
    this.error.set('');
    // Precargado con los datos del socio: es su cuota, no la de cualquiera.
    this.form = { name: member.name, email: member.email, lastFour: '' };
    this.isFormOpen.set(true);
  }

  close() {
    this.isFormOpen.set(false);
  }

  closeReceipt() {
    this.isReceiptOpen.set(false);
  }

  async confirm() {
    if (this.submitting()) return;
    this.error.set('');

    if (!this.form.name.trim() || !this.form.email.includes('@')) {
      this.error.set('Completá tu nombre y un correo válido.');
      return;
    }
    if (this.method() === 'Tarjeta' && !/^\d{4}$/.test(this.form.lastFour)) {
      this.error.set('Ingresá los últimos 4 números de la tarjeta.');
      return;
    }

    const member = this.member();
    if (!member) {
      this.error.set('No sabemos de qué socio es este pago.');
      return;
    }

    this.submitting.set(true);
    try {
      // Esto es lo que convierte el cobro en algo real: el socio pasa a 'Pago'
      // y se le corre el vencimiento segun la duracion de su plan.
      await this.data.markAsPaid(member);
      if (this.data.dataError()) {
        // Que un socio no pueda marcarse como pago no es una falla: es la
        // regla que impide que se ponga al dia sin pagar. Decirlo asi y no
        // con un error tecnico de Firestore.
        this.error.set(this.auth.isAdmin()
          ? this.data.dataError()
          : 'Tu pago quedó registrado, pero solo el gimnasio puede confirmarlo. Acercate o escribiles.');
        return;
      }

      this.receipt.set({
        number: `GP-${Date.now().toString().slice(-8)}`,
        plan: this.plan(),
        amount: this.amount(),
        method: this.method(),
        email: this.form.email.trim().toLowerCase(),
        date: new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
      });
      this.isFormOpen.set(false);
      this.isReceiptOpen.set(true);
    } finally {
      this.submitting.set(false);
    }
  }

  private priceOf(planName: string): string {
    const membership = this.data.findMembershipByName(planName);
    if (!membership) return PLAN_AMOUNTS[planName] ?? '$15.000';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    }).format(membership.price);
  }

  downloadReceipt() {
    const receipt = this.receipt();
    if (!receipt) return;
    const content = [
      'PRANDINA PERFORMANCE LAB',
      'Comprobante de pago',
      '',
      `Número: ${receipt.number}`,
      `Plan: ${receipt.plan}`,
      `Importe: ${receipt.amount}`,
      `Medio de pago: ${receipt.method}`,
      `Correo: ${receipt.email}`,
      `Fecha: ${receipt.date}`
    ].join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    link.download = `${receipt.number}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  emailReceipt() {
    const receipt = this.receipt();
    if (!receipt) return;
    const subject = encodeURIComponent(`Comprobante Prandina Performance Lab ${receipt.number}`);
    const body = encodeURIComponent([
      'Tu pago fue registrado.',
      '',
      `Plan: ${receipt.plan}`,
      `Importe: ${receipt.amount}`,
      `Medio de pago: ${receipt.method}`,
      `Número: ${receipt.number}`,
      `Fecha: ${receipt.date}`
    ].join('\n'));
    window.location.href = `mailto:${receipt.email}?subject=${subject}&body=${body}`;
  }
}
