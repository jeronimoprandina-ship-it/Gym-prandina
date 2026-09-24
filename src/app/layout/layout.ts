import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth.service';
import { GymDataService } from '../core/gym-data.service';
import { PaymentDialogComponent } from '../shared/payment-dialog';

/**
 * Marco común de la app: barra lateral, encabezado y el hueco donde se
 * renderiza la sección de cada rol. No sabe nada de socios ni de rutinas.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PaymentDialogComponent],
  templateUrl: './layout.html'
})
export class LayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly data = inject(GymDataService);

  protected readonly isMenuOpen = signal(true);
  protected readonly role = this.auth.role;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly currentUser = this.auth.user;

  protected readonly userInitials = computed(() => {
    const source = this.currentUser()?.displayName || this.currentUser()?.email || 'Usuario';
    const initials = source
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || 'U';
  });

  protected readonly currentDateLabel = computed(() => {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(now).toUpperCase();
    const month = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(now).toUpperCase();
    return `${weekday}, ${now.getDate()} DE ${month} DE ${now.getFullYear()}`;
  });

  protected toggleMenu() {
    this.isMenuOpen.update(open => !open);
  }

  protected async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
