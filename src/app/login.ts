import { Component, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  constructor(@Optional() private auth: Auth | null, private router: Router) {}

  mode: 'login' | 'register' | 'forgot' = 'login';
  error = '';
  resetSent = false;
  isSubmitting = false;
  login = { email: '', password: '' };
  register = { name: '', email: '', password: '', confirmPassword: '' };

  private normalizeEmail(value: string) {
    const email = value.trim().toLowerCase();
    return email.includes('@') ? email : `${email}@admin.com`;
  }

  async resetPassword() {
    this.error = '';
    this.resetSent = false;
    if (!this.auth) {
      this.error = 'Firebase Authentication no está disponible.';
      return;
    }
    try {
      await sendPasswordResetEmail(this.auth, this.login.email);
      this.resetSent = true;
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : '';
      this.error = code.includes('auth/user-not-found')
        ? 'No encontramos una cuenta con ese correo.'
        : 'Ingresá un correo válido para recuperar tu contraseña.';
    }
  }

  async submit() {
    this.error = '';
    this.isSubmitting = true;
    if (!this.auth) {
      this.error = 'Firebase Authentication no está disponible.';
      this.isSubmitting = false;
      return;
    }
    const auth = this.auth;

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('auth-timeout')), 10000);
      });
      const authOperation = async () => {
      if (this.mode === 'login') {
        await signInWithEmailAndPassword(auth, this.normalizeEmail(this.login.email), this.login.password);
      } else {
        if (this.register.password.length < 6) {
          this.error = 'La contraseña debe tener al menos 6 caracteres.';
          return;
        }
        if (this.register.password !== this.register.confirmPassword) {
          this.error = 'Las contraseñas no coinciden.';
          return;
        }
        const credentials = await createUserWithEmailAndPassword(auth, this.normalizeEmail(this.register.email), this.register.password);
        await updateProfile(credentials.user, { displayName: this.register.name });
      }
      };
      await Promise.race([authOperation(), timeout]);
      await this.router.navigateByUrl('/dashboard');
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : error instanceof Error ? error.message : '';
      if (code.includes('auth/operation-not-allowed')) this.error = 'Activá Email/Password en Firebase Console.';
      else if (code.includes('auth/email-already-in-use')) this.error = 'Ese correo ya está registrado. Iniciá sesión.';
      else if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) this.error = 'El correo o la contraseña no son correctos.';
      else if (code.includes('auth/invalid-email')) this.error = 'Ingresá un correo electrónico válido.';
      else if (code.includes('auth/invalid-api-key')) this.error = 'La configuración de Firebase es inválida.';
      else if (code.includes('auth-timeout')) this.error = 'Firebase está tardando demasiado. Revisá tu conexión e intentá nuevamente.';
      else this.error = 'No se pudo conectar con Firebase. Revisá los datos e intentá nuevamente.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
