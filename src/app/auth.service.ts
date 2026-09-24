import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  User,
  authState,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from '@angular/fire/auth';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Observable, catchError, map, of, switchMap, timeout } from 'rxjs';
import { environment } from '../environments/environments';

export type UserRole = 'admin' | 'socio';

/** Cuánto esperamos a Firebase antes de dar el intento por fallido. */
const AUTH_TIMEOUT_MS = 10_000;

/**
 * Los guards de ruta esperan a que el rol se resuelva antes de navegar. Si
 * Firestore no esta disponible y nunca contesta, sin este limite la app
 * quedaria colgada en blanco. Pasado el plazo asumimos el rol mas acotado.
 */
const ROLE_TIMEOUT_MS = 4_000;

/**
 * Única fuente de verdad de la sesión y del rol.
 *
 * En produccion es admin quien tenga un documento en `admins/{uid}`, que solo
 * se crea desde la consola de Firebase; las reglas de Firestore verifican lo
 * mismo, asi que el cliente no puede mentir sobre su rol.
 *
 * En desarrollo local, environment.adminEmails permite entrar como admin sin
 * Firestore. Esa lista va vacia en produccion.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** Emite recién cuando Firebase terminó de restaurar la sesión guardada. */
  readonly user$ = authState(this.auth);

  /** Mismo flujo, tipado más ancho para poder arrancar el signal en `undefined`. */
  private readonly pendingUser$: Observable<User | null | undefined> = this.user$;

  /** `undefined` mientras Firebase resuelve, `null` si no hay sesión. */
  readonly user = toSignal(this.pendingUser$, { initialValue: undefined });

  readonly role$ = this.user$.pipe(
    switchMap(user => {
      if (!user) return of<UserRole | null>(null);

      // Atajo de desarrollo local: environment.adminEmails permite entrar como
      // admin sin tener Firestore levantado. En produccion la lista va vacia y
      // el rol sale unicamente del documento admins/{uid}.
      const email = user.email?.toLowerCase() ?? '';
      if (environment.adminEmails.some(entry => entry.toLowerCase() === email)) {
        return of<UserRole>('admin');
      }

      return docData(doc(this.firestore, 'admins', user.uid)).pipe(
        map(adminDoc => (adminDoc ? 'admin' : 'socio') as UserRole),
        // Si Firestore tarda demasiado o falla, el usuario queda con el rol de
        // menor privilegio en vez de dejar la navegacion esperando para siempre.
        timeout({ first: ROLE_TIMEOUT_MS, with: () => of<UserRole>('socio') }),
        catchError(() => of<UserRole>('socio'))
      );
    })
  );

  readonly role = toSignal(this.role$, { initialValue: null as UserRole | null });

  /** false mientras Firebase todavía no dijo si hay sesión o no. */
  readonly isReady = computed(() => this.user() !== undefined);
  readonly isAuthenticated = computed(() => !!this.user());
  readonly isAdmin = computed(() => this.role() === 'admin');

  login(email: string, password: string) {
    return withTimeout(signInWithEmailAndPassword(this.auth, email, password));
  }

  /** Toda cuenta nueva nace como socio: el rol admin solo se otorga a mano. */
  async register(name: string, email: string, password: string) {
    const credentials = await withTimeout(createUserWithEmailAndPassword(this.auth, email, password));
    await updateProfile(credentials.user, { displayName: name });
    return credentials;
  }

  resetPassword(email: string) {
    return withTimeout(sendPasswordResetEmail(this.auth, email));
  }

  logout() {
    return signOut(this.auth);
  }
}

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('auth/timeout')), AUTH_TIMEOUT_MS);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Credenciales inválidas, usuario inexistente y contraseña equivocada comparten
 * mensaje a propósito: distinguirlos permitiría averiguar qué correos están
 * registrados en el gimnasio.
 */
const AUTH_ERRORS: Record<string, string> = {
  'auth/timeout': 'Firebase está tardando demasiado. Revisá tu conexión e intentá de nuevo.',
  'auth/network-request-failed': 'No hay conexión con Firebase. Revisá tu internet e intentá de nuevo.',
  'auth/operation-not-allowed': 'El acceso por correo y contraseña no está habilitado en Firebase.',
  'auth/invalid-api-key': 'La configuración de Firebase es inválida.',
  'auth/email-already-in-use': 'Ese correo ya está registrado. Iniciá sesión.',
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/wrong-password': 'El correo o la contraseña no son correctos.',
  'auth/user-not-found': 'El correo o la contraseña no son correctos.',
  'auth/invalid-email': 'Ingresá un correo electrónico válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Consultá al administrador.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.'
};

export function authErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.message : '';
}

export function authErrorMessage(error: unknown): string {
  return AUTH_ERRORS[authErrorCode(error)] ?? 'No se pudo completar la operación. Intentá de nuevo.';
}
