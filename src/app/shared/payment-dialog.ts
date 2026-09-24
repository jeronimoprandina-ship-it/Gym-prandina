import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../core/payment.service';

/** Modales de cobro simulado y comprobante. Se monta una sola vez, en el layout. */
@Component({
  selector: 'app-payment-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './payment-dialog.html'
})
export class PaymentDialogComponent {
  protected readonly payment = inject(PaymentService);
}
