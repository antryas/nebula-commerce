import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { LiveOrdersService } from '../live/live-orders.service';
import { NAV_ITEMS } from './nav-items';
import { Shell } from './shell';

function setup() {
  const live = {
    enabled: signal(true),
    count: signal(3),
    latest: signal(null),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const auth = {
    user: signal({ id: 'usr_1', name: 'Alex Morgan', email: 'alex@nebula.store', avatarUrl: '' }),
    isAuthenticated: signal(true),
    logout: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LiveOrdersService, useValue: live },
      { provide: AuthService, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(Shell);
  return { fixture, live, auth, el: fixture.nativeElement as HTMLElement };
}

describe('Shell', () => {
  beforeEach(() => localStorage.clear());

  it('starts the live order feed on init and stops it on destroy', async () => {
    const { fixture, live } = setup();
    await fixture.whenStable();
    expect(live.start).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(live.stop).toHaveBeenCalledTimes(1);
  });

  it('renders every nav item as a link', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const links = [...el.querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(NAV_ITEMS.map((n) => `/${n.path}`));
  });

  it('shows the live order count on the Orders nav item', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const orders = el.querySelector('nav a[href="/orders"]');
    expect(orders?.querySelector('.nb-nav__badge')?.textContent?.trim()).toBe('3');
  });

  it('collapses the sidebar and remembers the choice', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('nb-sidebar')?.classList).toContain('nb-sidebar--collapsed');
    expect(localStorage.getItem('nebula.sidebar')).toBe('collapsed');
  });

  it('restores the collapsed sidebar from storage', async () => {
    localStorage.setItem('nebula.sidebar', 'collapsed');
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(el.querySelector('nb-sidebar')?.classList).toContain('nb-sidebar--collapsed');
  });

  it('toggles live orders from the topbar indicator', async () => {
    const { fixture, el, live } = setup();
    await fixture.whenStable();
    const btn = el.querySelector<HTMLButtonElement>('button.nb-live')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    await fixture.whenStable();
    expect(live.enabled()).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens and closes the mobile drawer', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('nb-sidebar')?.classList).toContain('nb-sidebar--open');
    el.querySelector<HTMLElement>('.nb-shell__scrim')!.click();
    await fixture.whenStable();
    expect(el.querySelector('nb-sidebar')?.classList).not.toContain('nb-sidebar--open');
  });
});
