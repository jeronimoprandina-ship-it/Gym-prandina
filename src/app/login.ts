import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, authErrorCode, authErrorMessage } from './auth.service';
import { GymDataService } from './core/gym-data.service';

type LoginMode = 'login' | 'register' | 'forgot';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(GymDataService);

  readonly mode = signal<LoginMode>('login');
  readonly error = signal('');
  readonly resetSent = signal(false);
  readonly isSubmitting = signal(false);

  loginForm = { email: '', password: '' };
  registerForm = { name: '', email: '', password: '', confirmPassword: '' };

  setMode(mode: LoginMode) {
    this.mode.set(mode);
    this.error.set('');
    this.resetSent.set(false);
  }

  async submit() {
    if (this.isSubmitting()) return;
    this.error.set('');

    const isRegistering = this.mode() === 'register';
    const email = normalizeEmail(isRegistering ? this.registerForm.email : this.loginForm.email);

    const problem = isRegistering
      ? this.validateRegistration(email)
      : this.validateLogin(email);
    if (problem) {
      this.error.set(problem);
      return;
    }

    this.isSubmitting.set(true);
    try {
      if (isRegistering) {
        const name = this.registerForm.name.trim();
        await this.auth.register(name, email, this.registerForm.password);
        // Quien se registra queda habilitado como socio en el acto: sin esto
        // entraria a un portal que le dice que no esta asociado a nadie.
        await this.data.ensureMemberFor(name, email);
      } else {
        await this.auth.login(email, this.loginForm.password);
      }
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.error.set(authErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async sendReset() {
    if (this.isSubmitting()) return;
    this.error.set('');
    this.resetSent.set(false);

    const email = normalizeEmail(this.loginForm.email);
    if (!EMAIL_PATTERN.test(email)) {
      this.error.set('Ingresá un correo electrónico válido.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.auth.resetPassword(email);
      this.resetSent.set(true);
    } catch (error) {
      const code = authErrorCode(error);
      if (code.includes('network') || code.includes('timeout')) {
        this.error.set(authErrorMessage(error));
      } else {
        // Un "esa cuenta no existe" revelaría qué correos están registrados,
        // así que respondemos siempre lo mismo.
        this.resetSent.set(true);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private validateLogin(email: string): string {
    if (!EMAIL_PATTERN.test(email)) return 'Ingresá un correo electrónico válido.';
    if (!this.loginForm.password) return 'Ingresá tu contraseña.';
    return '';
  }

  private validateRegistration(email: string): string {
    if (this.registerForm.name.trim().length < 2) return 'Ingresá tu nombre completo.';
    if (!EMAIL_PATTERN.test(email)) return 'Ingresá un correo electrónico válido.';
    if (this.registerForm.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
    if (this.registerForm.password !== this.registerForm.confirmPassword) return 'Las contraseñas no coinciden.';
    return '';
  }

  /** Solo aceptamos rutas internas, para que `returnUrl` no redirija fuera del sitio. */
  private returnUrl(): string {
    const target = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard';
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
