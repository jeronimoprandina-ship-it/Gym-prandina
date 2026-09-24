export interface Member {
  id: string;
  name: string;
  email: string;
  plan: string;
  expires: string;
  status: 'Pago' | 'No pago';
  routine: string;
  initials: string;
  color: string;
}

export interface Routine {
  id?: string;
  name: string;
  level: string;
  duration: string;
  focus: string;
  exercises: number;
}

export interface Membership {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
}

export interface Exercise {
  id: number;
  name: string;
  description: string;
  category: { name: string };
  muscles: { name: string }[];
}

export interface ExerciseResponse {
  results: Exercise[];
}

export interface PaymentReceipt {
  number: string;
  plan: string;
  amount: string;
  method: string;
  email: string;
  date: string;
}

export type PaymentMethod = 'Tarjeta' | 'Mercado Pago';

export const MUSCLE_GROUPS = [
  'Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Core'
];

export const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export const WEEK_SCHEDULE: Record<string, { name: string; exercises: number; focus: string }> = {
  'Lunes': { name: 'Pecho y Tríceps', exercises: 5, focus: 'Tren superior' },
  'Martes': { name: 'Espalda y Bíceps', exercises: 5, focus: 'Tren superior' },
  'Miércoles': { name: 'Piernas', exercises: 6, focus: 'Tren inferior' },
  'Jueves': { name: 'Hombros', exercises: 4, focus: 'Tren superior' },
  'Viernes': { name: 'Core', exercises: 3, focus: 'Abdominales' }
};

/** Precio de referencia por plan, usado al abrir el cobro desde la tabla de socios. */
export const PLAN_AMOUNTS: Record<string, string> = {
  'Plan mensual': '$15.000',
  'Plan trimestral': '$40.000',
  'Plan anual': '$140.000'
};
