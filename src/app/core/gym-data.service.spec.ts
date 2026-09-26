import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from '../auth.service';
import { GymDataService } from './gym-data.service';
import { Member, Membership } from './models';

const PLANES: Membership[] = [
  { id: '1', name: 'Plan mensual', price: 15000, duration: '30 días', description: '' },
  { id: '2', name: 'Plan trimestral', price: 39000, duration: '90 días', description: '' },
  { id: '3', name: 'Plan anual', price: 150000, duration: '365 días', description: '' }
];

function socio(nombre: string, plan: string, status: Member['status']): Member {
  return {
    id: nombre, name: nombre, email: `${nombre}@test.com`, plan,
    expires: '21 sep 2026', status, routine: 'Sin asignar', initials: 'XX', color: '#000'
  };
}

describe('GymDataService — ingresos del mes', () => {
  let data: GymDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // Sin Firestore el servicio trabaja solo con sus signals en memoria.
        { provide: Firestore, useValue: null },
        { provide: AuthService, useValue: { user: signal(null), role: signal(null) } }
      ]
    });
    data = TestBed.inject(GymDataService);
    data.memberships.set(PLANES);
  });

  it('suma solo a los socios en Pago', () => {
    data.members.set([
      socio('Ana', 'Plan mensual', 'Pago'),
      socio('Beto', 'Plan mensual', 'No pago'),
      socio('Cora', 'Plan mensual', 'Pago')
    ]);

    // Beto no abonó, así que no es un ingreso.
    expect(data.monthlyIncome()).toBe(30000);
  });

  it('da cero si nadie está al día', () => {
    data.members.set([socio('Ana', 'Plan anual', 'No pago')]);
    expect(data.monthlyIncome()).toBe(0);
  });

  it('prorratea el trimestral a su valor mensual', () => {
    data.members.set([socio('Ana', 'Plan trimestral', 'Pago')]);
    // 39.000 cada 3 meses = 13.000 por mes.
    expect(data.monthlyIncome()).toBe(13000);
  });

  it('prorratea el anual en vez de sumarlo entero', () => {
    data.members.set([socio('Ana', 'Plan anual', 'Pago')]);
    // 150.000 / (365 días / 30) ≈ 12.329. Sin prorrateo daría 150.000.
    expect(data.monthlyIncome()).toBeCloseTo(12328.77, 1);
    expect(data.monthlyIncome()).toBeLessThan(15000);
  });

  it('mezcla planes distintos correctamente', () => {
    data.members.set([
      socio('Ana', 'Plan mensual', 'Pago'),
      socio('Beto', 'Plan trimestral', 'Pago'),
      socio('Cora', 'Plan anual', 'Pago')
    ]);
    expect(data.monthlyIncome()).toBeCloseTo(15000 + 13000 + 12328.77, 1);
  });

  it('ignora un plan que ya no existe en vez de romper', () => {
    data.members.set([
      socio('Ana', 'Plan mensual', 'Pago'),
      socio('Beto', 'Plan que se borró', 'Pago')
    ]);
    expect(data.monthlyIncome()).toBe(15000);
  });

  it('reacciona al cambiar el precio de un plan', () => {
    data.members.set([socio('Ana', 'Plan mensual', 'Pago')]);
    expect(data.monthlyIncome()).toBe(15000);

    data.memberships.set([{ ...PLANES[0], price: 20000 }]);
    expect(data.monthlyIncome()).toBe(20000);
  });

  it('el neto resta los gastos a los ingresos', () => {
    data.members.set([socio('Ana', 'Plan mensual', 'Pago')]);
    expect(data.monthlyNet()).toBe(15000 - data.summaryMetrics.expenses);
  });
});
