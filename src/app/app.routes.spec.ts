import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { LiveOrdersService } from './core/live/live-orders.service';

async function setup(authenticated: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(authenticated), user: signal(null), logout: vi.fn() },
      },
      {
        provide: LiveOrdersService,
        useValue: { enabled: signal(false), count: signal(0), start: vi.fn(), stop: vi.fn() },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  return { harness, router: TestBed.inject(Router) };
}

function shellChildren(): Route[] {
  return routes.find((r) => r.path === '' && r.children)?.children ?? [];
}

describe('app routes', () => {
  // jsdom has no scrolling; the shell scrolls to the top after each navigation.
  let scrollTo: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lazy-loads every titled feature route under the shell', () => {
    const lazy = shellChildren().filter((r) => r.loadComponent);
    expect(lazy.map((r) => r.path)).toEqual([
      'overview',
      'orders',
      'orders/:id',
      'fulfillment',
      'products',
      'products/new',
      'products/:id/edit',
      'customers',
      'customers/:id',
      'analytics',
      'settings',
    ]);
    for (const r of lazy) expect(r.data?.['title']).toBeTruthy();
  });

  it('redirects anonymous users to /login with a returnUrl', async () => {
    const { harness, router } = await setup(false);
    await harness.navigateByUrl('/orders');
    expect(router.url).toBe('/login?returnUrl=%2Forders');
    expect(harness.routeNativeElement?.querySelector('form')).not.toBeNull();
  });

  it('sends signed-in users from /, /login and unknown urls to /overview', async () => {
    const { harness, router } = await setup(true);
    await harness.navigateByUrl('/');
    expect(router.url).toBe('/overview');
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/overview');
    await harness.navigateByUrl('/does-not-exist');
    expect(router.url).toBe('/overview');
    await harness.navigateByUrl('/orders');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 });
  });
});
