import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Exercise, ExerciseResponse } from './models';

const WGER_URL = 'https://wger.de/api/v2/exerciseinfo/?language=2&limit=100';

/** Biblioteca de ejercicios traida de la API publica de wger, traducida al español. */
@Injectable({ providedIn: 'root' })
export class ExercisesService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly exercises = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  private loaded = false;

  /** Idempotente: la llaman varias pantallas pero la API se consulta una sola vez. */
  load() {
    if (this.loaded || !this.http) return;
    this.loaded = true;
    this.loading.set(true);
    this.http.get<ExerciseResponse>(WGER_URL)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.exercises.set(response.results ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar los ejercicios. Revisá tu conexión.');
          this.loading.set(false);
        }
      });
  }

  /** Filtra por texto y grupo muscular, y descarta nombres repetidos. */
  filter(term: string, category: string): Exercise[] {
    const needle = term.toLowerCase().trim();
    const seen = new Set<string>();
    return this.exercises().filter(exercise => {
      const haystack = [
        this.nameOf(exercise),
        exercise.name,
        exercise.description,
        ...(exercise.muscles ?? []).map(muscle => muscle.name)
      ].join(' ').toLowerCase();

      if (!haystack.includes(needle)) return false;
      if (category !== 'Todos' && !this.groupsOf(exercise).includes(category)) return false;

      const name = this.nameOf(exercise).toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  groupsOf(exercise: Exercise): string[] {
    const text = [
      exercise.name,
      exercise.category?.name,
      ...(exercise.muscles ?? []).map(muscle => muscle.name)
    ].join(' ').toLowerCase();

    const groups: string[] = [];
    if (/chest|pectoral|pecho/.test(text)) groups.push('Pecho');
    if (/back|latissimus|dorsal|espalda/.test(text)) groups.push('Espalda');
    if (/shoulder|deltoid|hombro/.test(text)) groups.push('Hombros');
    if (/biceps|bíceps/.test(text)) groups.push('Bíceps');
    if (/triceps|tríceps/.test(text)) groups.push('Tríceps');
    if (/quadriceps|quad|hamstring|calf|leg|pierna|cuádriceps|femoral|pantorrilla/.test(text)) groups.push('Piernas');
    if (/glute|glúteo/.test(text)) groups.push('Glúteos');
    if (/abdom|core|oblique|lumbar|abdomen|\babs\b/.test(text)) groups.push('Core');
    if (/\barms\b/.test(text) && !groups.includes('Bíceps') && !groups.includes('Tríceps')) {
      groups.push('Bíceps', 'Tríceps');
    }
    return groups.length ? [...new Set(groups)] : ['General'];
  }

  nameOf(exercise: Exercise): string {
    const original = (exercise.name ?? '').trim();
    const name = original.toLowerCase();

    const match = TRANSLATIONS.find(([pattern]) => pattern.test(name));
    if (match) {
      const options = VARIANTS[match[1]];
      return options ? `${match[1]} ${options[exercise.id % options.length]}` : match[1];
    }
    if (original) return original.charAt(0).toUpperCase() + original.slice(1);

    const group = this.groupsOf(exercise)[0] || 'General';
    const names = FALLBACK_NAMES[group] || FALLBACK_NAMES['General'];
    return names[exercise.id % names.length];
  }

  descriptionOf(exercise: Exercise): string {
    const clean = (exercise.description ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean) return clean;
    return `Realizá ${this.nameOf(exercise).toLowerCase()} con movimiento controlado, espalda estable y respiración constante.`;
  }
}

const TRANSLATIONS: [RegExp, string][] = [
  [/bench press|barbell bench|chest press|press de banca/, 'Press de banca'],
  [/push.?up|pushup|flexion/, 'Flexiones de pecho'],
  [/chest fly|cable fly|pec deck|apertura/, 'Aperturas de pecho'],
  [/incline press/, 'Press inclinado'],
  [/deadlift|peso muerto/, 'Peso muerto'],
  [/squat|sentadilla/, 'Sentadilla'],
  [/leg press|prensa/, 'Prensa de piernas'],
  [/leg extension|extensión de pierna/, 'Extensión de piernas'],
  [/leg curl|femoral/, 'Curl femoral'],
  [/lunge|zancada/, 'Zancadas'],
  [/hip thrust|glute bridge|puente de glúteos/, 'Hip thrust'],
  [/calf raise|pantorrilla/, 'Elevación de pantorrillas'],
  [/shoulder press|military press|press militar/, 'Press militar'],
  [/lateral raise|elevación lateral/, 'Elevaciones laterales'],
  [/front raise|elevación frontal/, 'Elevaciones frontales'],
  [/pull.?up|chin.?up|dominada/, 'Dominadas'],
  [/lat pull|jalón/, 'Jalón al pecho'],
  [/barbell row|cable row|remo/, 'Remo'],
  [/biceps curl|barbell curl|curl/, 'Curl de bíceps'],
  [/triceps extension|triceps pushdown|extensión de tríceps/, 'Extensión de tríceps'],
  [/dip|fondo/, 'Fondos de tríceps'],
  [/crunch|sit.?up|abdominal/, 'Abdominales'],
  [/plank|plancha/, 'Plancha']
];

const VARIANTS: Record<string, string[]> = {
  'Press de banca': ['con barra', 'con mancuernas', 'inclinado', 'declinado', 'con agarre cerrado'],
  'Aperturas de pecho': ['con mancuernas', 'en polea', 'inclinadas'],
  'Press militar': ['con barra', 'con mancuernas', 'sentado'],
  'Remo': ['con barra', 'con mancuernas', 'en polea'],
  'Sentadilla': ['libre', 'frontal', 'sumo', 'con mancuernas'],
  'Curl de bíceps': ['con barra', 'alternado', 'martillo', 'concentrado'],
  'Extensión de tríceps': ['en polea', 'sobre la cabeza', 'con mancuerna'],
  'Abdominales': ['cortos', 'con piernas elevadas', 'en bicicleta']
};

const FALLBACK_NAMES: Record<string, string[]> = {
  Pecho: ['Press de banca', 'Aperturas con mancuernas', 'Press inclinado'],
  Espalda: ['Remo con barra', 'Jalón al pecho', 'Dominadas'],
  Hombros: ['Press militar', 'Elevaciones laterales', 'Elevaciones frontales'],
  Bíceps: ['Curl de bíceps con barra', 'Curl alternado', 'Curl martillo'],
  Tríceps: ['Extensión de tríceps', 'Fondos de tríceps', 'Press cerrado'],
  Piernas: ['Sentadilla', 'Prensa de piernas', 'Extensión de piernas'],
  Glúteos: ['Hip thrust', 'Puente de glúteos', 'Patada de glúteo'],
  Core: ['Abdominales', 'Plancha', 'Elevación de piernas'],
  General: ['Ejercicio funcional']
};
