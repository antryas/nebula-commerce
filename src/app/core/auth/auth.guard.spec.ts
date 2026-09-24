import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

function run(authenticated: boolean, url: string): ReturnType<typeof authGuard> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: signal(authenticated) } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('authGuard', () => {
  it('allows authenticated users', () => {
    expect(run(true, '/orders')).toBe(true);
  });

  it('redirects to /login with returnUrl', () => {
    const result = run(false, '/orders?status=new');
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?returnUrl=%2Forders%3Fstatus%3Dnew');
  });
});
