import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExercisesService } from '../core/exercises.service';
import { GymDataService } from '../core/gym-data.service';
import { Routine } from '../core/models';

/** Alta, edición y baja de rutinas. Solo admin. */
@Component({
  selector: 'app-admin-rutinas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-rutinas.html'
})
export class AdminRutinasComponent {
  protected readonly data = inject(GymDataService);
  protected readonly exercises = inject(ExercisesService);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<Routine | null>(null);
  protected form = emptyRoutine();

  /** Muestra de ejercicios para la vista rápida de una rutina. */
  protected readonly sampleExercises = computed(() => this.exercises.filter('', 'Todos').slice(0, 4));

  protected readonly isExercisesOpen = signal(false);
  protected readonly viewingRoutine = signal<Routine | null>(null);

  constructor() {
    this.exercises.load();
  }

  protected openForm(routine: Routine | null = null) {
    this.editing.set(routine);
    this.form = routine
      ? { name: routine.name, level: routine.level, duration: routine.duration, focus: routine.focus, exercises: routine.exercises }
      : emptyRoutine();
    this.isFormOpen.set(true);
  }

  protected closeForm() {
    this.isFormOpen.set(false);
  }

  protected async save() {
    if (!this.form.name.trim()) return;
    await this.data.saveRoutine(this.form, this.editing());
    this.editing.set(null);
    this.isFormOpen.set(false);
  }

  protected async remove(routine: Routine) {
    if (!confirm(`¿Eliminar la rutina ${routine.name}?`)) return;
    await this.data.deleteRoutine(routine);
  }

  protected openExercises(routine: Routine) {
    this.viewingRoutine.set(routine);
    this.isExercisesOpen.set(true);
  }

  protected closeExercises() {
    this.isExercisesOpen.set(false);
  }
}

function emptyRoutine() {
  return { name: '', level: 'Principiante', duration: '45 min', focus: 'Cuerpo completo', exercises: 8 };
}
