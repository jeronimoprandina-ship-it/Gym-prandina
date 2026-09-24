import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, roleRedirectGuard, socioGuard } from './auth.guard';

/**
 * Cada rol tiene su propio árbol de rutas y sus propios componentes:
 *
 *   /login                  público
 *   /admin/resumen          \
 *   /admin/socios            |  solo admin
 *   /admin/socios/:id        |
 *   /admin/rutinas           |
 *   /admin/membresias       /
 *   /socio                  solo socio
 *
 * La raíz no tiene pantalla propia: redirige según el rol.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./login').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then(m => m.LayoutComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [roleRedirectGuard], children: [] },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'resumen' },
          {
            path: 'resumen',
            loadComponent: () => import('./admin/admin-resumen').then(m => m.AdminResumenComponent)
          },
          {
            path: 'socios',
            loadComponent: () => import('./admin/admin-socios').then(m => m.AdminSociosComponent)
          },
          {
            // El admin abriendo la ficha de un socio: reusa el mismo portal.
            path: 'socios/:id',
            loadComponent: () => import('./socio/socio-portal').then(m => m.SocioPortalComponent)
          },
          {
            path: 'rutinas',
            loadComponent: () => import('./admin/admin-rutinas').then(m => m.AdminRutinasComponent)
          },
          {
            path: 'membresias',
            loadComponent: () => import('./admin/admin-membresias').then(m => m.AdminMembresiasComponent)
          }
        ]
      },
      {
        path: 'socio',
        canActivate: [socioGuard],
        loadComponent: () => import('./socio/socio-portal').then(m => m.SocioPortalComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
