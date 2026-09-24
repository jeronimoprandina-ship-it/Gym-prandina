import { Injectable, signal } from '@angular/core';
import { PaymentMethod, PaymentReceipt } from './models';

/**
 * Cobro simulado. Vive en un servicio porque lo abren dos pantallas distintas:
 * la tabla de socios del admin y el portal del socio.
 *
 * No cobra nada ni guarda datos bancarios: solo arma un comprobante.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  readonly isFormOpen = signal(false);
  readonly isReceiptOpen = signal(false);
  readonly plan = signal('');
  readonly amount = signal('');
  readonly method = signal<PaymentMethod>('Tarjeta');
  readonly error = signal('');
  readonly receipt = signal<PaymentReceipt | null>(null);

  form = { name: '', email: '', lastFour: '' };

  open(plan: string, amount: string, method: PaymentMethod = 'Tarjeta') {
    this.plan.set(plan);
    this.amount.set(amount);
    this.method.set(method);
    this.error.set('');
    this.isFormOpen.set(true);
  }

  close() {
    this.isFormOpen.set(false);
  }

  closeReceipt() {
    this.isReceiptOpen.set(false);
  }

  confirm() {
    this.error.set('');
    if (!this.form.name.trim() || !this.form.email.includes('@')) {
      this.error.set('Completá tu nombre y un correo válido.');
      return;
    }
    if (this.method() === 'Tarjeta' && !/^\d{4}$/.test(this.form.lastFour)) {
      this.error.set('Ingresá los últimos 4 números de la tarjeta.');
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
