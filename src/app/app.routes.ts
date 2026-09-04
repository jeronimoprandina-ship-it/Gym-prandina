import { Routes } from '@angular/router';
import { AppComponent } from './app';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{ path: 'login', redirectTo: 'dashboard' },
	{ path: 'dashboard', component: AppComponent },
	{ path: '**', redirectTo: 'dashboard' }
];
