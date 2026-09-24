import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LoginComponent } from './login';
import { AuthService } from './auth.service';

/** Registra las llamadas en vez de hablar con Firebase. */
class AuthServiceStub {
  calls: string[] = [];
  async login(email: string) { this.calls.push(`login:${email}`); }
  async register(name: string, email: string) { this.calls.push(`register:${name}|${email}`); }
  async resetPassword(email: string) { this.calls.push(`reset:${email}`); }
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let auth: AuthServiceStub;

  beforeEach(async () => {
    auth = new AuthServiceStub();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    component = TestBed.createComponent(LoginComponent).componentInstance;
  });

  // Este es el agujero que se cerró: antes `normalizeEmail` convertía cualquier
  // texto sin arroba en "<texto>@admin.com", y ese dominio daba permisos de
  // administrador. Escribir "pepe" alcanzaba para entrar como admin.
  it('rechaza un usuario sin arroba en vez de completarlo con @admin.com', async () => {
    component.loginForm = { email: 'pepe', password: 'secreto123' };
    await component.submit();

    expect(component.error()).toBe('Ingresá un correo electrónico válido.');
    expect(auth.calls).toEqual([]);
  });

  it('normaliza el correo antes de mandarlo a Firebase', async () => {
    component.loginForm = { email: '  Juan@Gym.COM ', password: 'secreto123' };
    await component.submit();

    expect(auth.calls).toEqual(['login:juan@gym.com']);
  });

  it('pide la contraseña si viene vacía', async () => {
    component.loginForm = { email: 'juan@gym.com', password: '' };
    await component.submit();

    expect(component.error()).toBe('Ingresá tu contraseña.');
    expect(auth.calls).toEqual([]);
  });

  it('no registra si las contraseñas no coinciden', async () => {
    component.setMode('register');
    component.registerForm = {
      name: 'Juan Prandina',
      email: 'juan@gym.com',
      password: 'secreto123',
      confirmPassword: 'otracosa'
    };
    await component.submit();

    expect(component.error()).toBe('Las contraseñas no coinciden.');
    expect(auth.calls).toEqual([]);
  });

  it('no registra con contraseñas de menos de 6 caracteres', async () => {
    component.setMode('register');
    component.registerForm = { name: 'Juan Prandina', email: 'juan@gym.com', password: '123', confirmPassword: '123' };
    await component.submit();

    expect(component.error()).toBe('La contraseña debe tener al menos 6 caracteres.');
    expect(auth.calls).toEqual([]);
  });

  it('confirma el envío de recuperación sin revelar si la cuenta existe', async () => {
    auth.resetPassword = async () => { throw { code: 'auth/user-not-found' }; };
    component.setMode('forgot');
    component.loginForm = { email: 'noexiste@gym.com', password: '' };
    await component.sendReset();

    expect(component.resetSent()).toBe(true);
    expect(component.error()).toBe('');
  });
});
