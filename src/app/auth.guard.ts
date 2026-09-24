import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Deja pasar solo con sesión iniciada. `authState` emite recién cuando Firebase
 * terminó de restaurar la sesión guardada, así que un F5 no expulsa al usuario.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService).user$.pipe(
    take(1),
    map(user => user
      ? true
      : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))
  );
};

/** Evita que alguien con sesión activa vuelva a la pantalla de login. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).user$.pipe(
    take(1),
    map(user => user ? router.createUrlTree(['/']) : true)
  );
};

/** Manda a cada rol a su sección. Es lo que resuelve la ruta raíz. */
export const roleRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).role$.pipe(
    // El rol arranca en null mientras Firebase resuelve: esperamos al primero real.
    filter((role): role is 'admin' | 'socio' => role !== null),
    take(1),
    map(role => router.createUrlTree([role === 'admin' ? '/admin' : '/socio']))
  );
};

/** Solo admin. Un socio que escriba /admin a mano termina en su portal. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).role$.pipe(
    filter((role): role is 'admin' | 'socio' => role !== null),
    take(1),
    map(role => role === 'admin' ? true : router.createUrlTree(['/socio']))
  );
};

/** Solo socio. El admin que entre a /socio va a su panel. */
export const socioGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).role$.pipe(
    filter((role): role is 'admin' | 'socio' => role !== null),
    take(1),
    map(role => role === 'socio' ? true : router.createUrlTree(['/admin']))
  );
};
