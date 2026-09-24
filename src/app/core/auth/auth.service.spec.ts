import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { User } from '../../models';
import { AuthService } from './auth.service';

const USER: User = {
  id: 'usr_1',
  name: 'Alex Morgan',
  email: 'alex@nebula.store',
  avatarUrl: 'https://example.test/a.png',
  role: 'Admin',
};

function setup(): { auth: AuthService; ctrl: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return { auth: TestBed.inject(AuthService), ctrl: TestBed.inject(HttpTestingController) };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('starts signed out', () => {
    const { auth } = setup();
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('login sets the user and persists the session', async () => {
    const { auth, ctrl } = setup();
    const p = firstValueFrom(auth.login('alex@nebula.store', 'demo1234'));
    ctrl.expectOne('/api/auth/login').flush({ token: 'demo-token', user: USER });
    expect(await p).toEqual(USER);
    expect(auth.user()).toEqual(USER);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('demo-token');
    expect(JSON.parse(localStorage.getItem('nebula.auth') ?? 'null')).toEqual({
      token: 'demo-token',
      user: USER,
    });
  });

  it('failed login keeps the user signed out', async () => {
    const { auth, ctrl } = setup();
    const p = firstValueFrom(auth.login('alex@nebula.store', '1'));
    ctrl
      .expectOne('/api/auth/login')
      .flush({ code: 'invalid_credentials' }, { status: 401, statusText: 'x' });
    await expect(p).rejects.toBeTruthy();
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('nebula.auth')).toBeNull();
  });

  it('logout clears user and storage', () => {
    localStorage.setItem('nebula.auth', JSON.stringify({ token: 't', user: USER }));
    const { auth } = setup();
    auth.logout();
    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem('nebula.auth')).toBeNull();
  });

  it('restores the session on a new injector', () => {
    localStorage.setItem('nebula.auth', JSON.stringify({ token: 't', user: USER }));
    const { auth } = setup();
    expect(auth.user()).toEqual(USER);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem('nebula.auth', '{"token":');
    expect(setup().auth.isAuthenticated()).toBe(false);
    TestBed.resetTestingModule();
    localStorage.setItem('nebula.auth', JSON.stringify({ token: 42, user: null }));
    expect(setup().auth.isAuthenticated()).toBe(false);
  });
});
