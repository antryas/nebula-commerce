import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../notifications/toast.service';
import { ApiConfigService, BACKEND_STORAGE_KEY } from './api-config.service';
import { BackendStatus, BackendStatusService } from './backend-status.service';
import { BackendSwitch } from './backend-switch';

function setup(checkResult: BackendStatus = 'online') {
  const authenticated = signal(true);
  const auth = {
    isAuthenticated: authenticated,
    logout: vi.fn(() => authenticated.set(false)),
  };
  const status = { check: vi.fn(() => Promise.resolve(checkResult)) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: BackendStatusService, useValue: status },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return {
    auth,
    status,
    navigate,
    config: TestBed.inject(ApiConfigService),
    toasts: TestBed.inject(ToastService),
    switcher: TestBed.inject(BackendSwitch),
  };
}

describe('BackendSwitch', () => {
  beforeEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));

  it('switches to live: persists the mode, signs out, goes to /login and toasts', () => {
    const { switcher, config, auth, navigate, toasts } = setup();
    switcher.switchTo('live');
    expect(config.mode()).toBe('live');
    expect(localStorage.getItem(BACKEND_STORAGE_KEY)).toBe('live');
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(toasts.toasts()[0].title).toBe('Switched to live .NET backend');
  });

  it('switches back to mock with its own toast', () => {
    const { switcher, config, toasts } = setup();
    config.setMode('live');
    switcher.switchTo('mock');
    expect(config.mode()).toBe('mock');
    expect(toasts.toasts()[0].title).toBe('Switched to mock data');
  });

  it('does nothing when the mode is already selected', () => {
    const { switcher, auth, navigate, toasts } = setup();
    switcher.switchTo('mock');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('ends an expired session once, however many requests failed', () => {
    const { switcher, auth, navigate, toasts } = setup();
    switcher.sessionExpired();
    switcher.sessionExpired();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(toasts.toasts().map((t) => t.title)).toEqual(['Session expired, please sign in again']);
  });

  it('falls back to mock at startup when the persisted live API is offline', async () => {
    localStorage.setItem(BACKEND_STORAGE_KEY, 'live');
    const { switcher, config, auth, toasts, status } = setup('offline');
    await switcher.fallBackIfOffline();
    expect(status.check).toHaveBeenCalledTimes(1);
    expect(config.mode()).toBe('mock');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(toasts.toasts()[0].title).toBe('Live API unavailable — using mock data');
  });

  it('keeps live mode at startup when the API answers', async () => {
    localStorage.setItem(BACKEND_STORAGE_KEY, 'live');
    const { switcher, config, toasts } = setup('online');
    await switcher.fallBackIfOffline();
    expect(config.mode()).toBe('live');
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('skips the startup check in mock mode', async () => {
    const { switcher, status } = setup();
    await switcher.fallBackIfOffline();
    expect(status.check).not.toHaveBeenCalled();
  });
});
