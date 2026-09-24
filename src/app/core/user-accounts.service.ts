import { Injectable } from '@angular/core';
import { deleteApp, initializeApp } from '@angular/fire/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut, updateProfile
} from '@angular/fire/auth';
import { environment } from '../../environments/environments';
import { authErrorCode } from '../auth.service';

export interface AccountResult {
  /** true si la cuenta ya existia y se reutilizo en vez de crearse. */
  alreadyExisted: boolean;
}

/**
 * Da de alta cuentas de Firebase Auth sin tocar la sesion de quien las crea.
 *
 * El problema: `createUserWithEmailAndPassword` del SDK de cliente deja al
 * usuario recien creado como sesion activa. Si el admin lo llamara directo,
 * quedaria logueado como el socio que acaba de dar de alta.
 *
 * La solucion: levantar un segundo FirebaseApp con la misma configuracion,
 * crear ahi la cuenta y descartarlo. La sesion del admin vive en la app
 * principal y no se entera de nada.
 */
@Injectable({ providedIn: 'root' })
export class UserAccountsService {
  async create(name: string, email: string, password: string): Promise<AccountResult> {
    const secondary = initializeApp(environment.firebase, `alta-socio-${Date.now()}`);
    try {
      const auth = getAuth(secondary);
      if (environment.useEmulators.auth) {
        connectAuthEmulator(auth, environment.emulatorHosts.auth, { disableWarnings: true });
      }

      try {
        const credentials = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credentials.user, { displayName: name });
        await signOut(auth);
        return { alreadyExisted: false };
      } catch (error) {
        // Que el correo ya tenga cuenta no es un fallo: es el caso de alguien
        // que se registro solo y al que ahora le estamos creando la ficha.
        if (authErrorCode(error) === 'auth/email-already-in-use') {
          return { alreadyExisted: true };
        }
        throw error;
      }
    } finally {
      await deleteApp(secondary).catch(() => undefined);
    }
  }
}
