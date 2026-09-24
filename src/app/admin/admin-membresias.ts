import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GymDataService } from '../core/gym-data.service';
import { Membership } from '../core/models';

/** Planes, precios y descripciones. Solo admin. */
@Component({
  selector: 'app-admin-membresias',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './admin-membresias.html'
})
export class AdminMembresiasComponent {
  protected readonly data = inject(GymDataService);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<Membership | null>(null);
  protected form = emptyMembership();

  protected openForm(membership: Membership | null = null) {
    this.editing.set(membership);
    this.form = membership
      ? { name: membership.name, price: membership.price, duration: membership.duration, description: membership.description }
      : emptyMembership();
    this.isFormOpen.set(true);
  }

  protected closeForm() {
    this.isFormOpen.set(false);
  }

  protected async save() {
    if (!this.form.name.trim() || this.form.price <= 0) return;
    await this.data.saveMembership(this.form, this.editing());
    this.editing.set(null);
    this.isFormOpen.set(false);
  }

  protected async remove(membership: Membership) {
    if (!confirm(`¿Eliminar ${membership.name}?`)) return;
    await this.data.deleteMembership(membership);
  }
}

function emptyMembership() {
  return { name: '', price: 0, duration: '', description: '' };
}
