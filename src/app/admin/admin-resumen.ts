import { Component, computed, inject } from '@angular/core';
import { GymDataService } from '../core/gym-data.service';

/** Panel de métricas del gimnasio. Solo admin. */
@Component({
  selector: 'app-admin-resumen',
  standalone: true,
  templateUrl: './admin-resumen.html'
})
export class AdminResumenComponent {
  protected readonly data = inject(GymDataService);
  protected readonly metrics = this.data.summaryMetrics;

  protected readonly incomeDisplay = computed(() => money(this.metrics.income));
  protected readonly expensesDisplay = computed(() => money(this.metrics.expenses));
  protected readonly netDisplay = computed(() => money(this.metrics.net));
  protected readonly attendanceProgress = computed(() => Math.min(this.metrics.attendance, 100));

  /** Fijos por ahora: no hay una fuente real de gastos todavía. */
  protected readonly expenses = [
    { label: 'Sueldos', amount: '$180.000' },
    { label: 'Servicios', amount: '$95.000' },
    { label: 'Equipamiento', amount: '$120.000' },
    { label: 'Marketing', amount: '$85.000' }
  ];
}

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(value);
}
