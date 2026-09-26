import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiConfigService } from '../../core/api/api-config.service';
import { BackendSwitch } from '../../core/api/backend-switch';
import { DemoOverlay } from '../../core/api/demo-overlay';
import { AuthService } from '../../core/auth/auth.service';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ThemeService } from '../../core/theme/theme.service';
import { User } from '../../models';
import { Settings } from './settings';

const USER: User = {
  id: 'usr_1',
  name: 'Alex Morgan',
  email: 'alex@nebula.store',
  avatarUrl: '',
  role: 'Admin',
};

async function setup(overlay?: { readOnly: () => boolean; changeCount: () => number }) {
  localStorage.clear();
  const live = { enabled: signal(true), count: signal(0) };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: signal(USER) } },
      { provide: LiveOrdersService, useValue: live },
      ...(overlay ? [{ provide: DemoOverlay, useValue: { ...overlay, clear: vi.fn() } }] : []),
    ],
  });
  if (overlay) TestBed.inject(ApiConfigService).setMode('live');
  const fixture = TestBed.createComponent(Settings);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    )!;
  return { fixture, el, live, button };
}

describe('Settings', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prefills the profile form from the signed-in user', async () => {
    const { el } = await setup();
    expect(el.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe('Alex Morgan');
    expect(el.querySelector<HTMLInputElement>('input[name="email"]')!.value).toBe(
      'alex@nebula.store',
    );
  });

  it('clicking the "rose" swatch sets the accent', async () => {
    const { el, fixture } = await setup();
    const theme = TestBed.inject(ThemeService);
    const setAccent = vi.spyOn(theme, 'setAccent');
    el.querySelector<HTMLButtonElement>('[data-accent-swatch="rose"]')!.click();
    await fixture.whenStable();
    expect(setAccent).toHaveBeenCalledWith('rose');
    expect(el.querySelector('[data-accent-swatch="rose"]')!.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('switches the theme mode', async () => {
    const { button, fixture } = await setup();
    const theme = TestBed.inject(ThemeService);
    button('Light').click();
    await fixture.whenStable();
    expect(theme.mode()).toBe('light');
  });

  it('toggles live orders', async () => {
    const { el, live, fixture } = await setup();
    el.querySelector<HTMLButtonElement>(
      '[role="switch"][aria-labelledby="nb-live-label"]',
    )!.click();
    await fixture.whenStable();
    expect(live.enabled()).toBe(false);
  });

  it('the data source switch selects the live .NET backend', async () => {
    const { el } = await setup();
    const switchTo = vi
      .spyOn(TestBed.inject(BackendSwitch), 'switchTo')
      .mockImplementation(() => undefined);
    const toggle = el.querySelector<HTMLButtonElement>('[aria-labelledby="nb-backend-label"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(el.textContent).toContain('In-browser mock API');
    toggle.click();
    expect(switchTo).toHaveBeenCalledWith('live');
  });

  it('"Reset demo data" after confirm sends POST /api/demo/reset and toasts', async () => {
    const { button, fixture } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    button('Reset demo data').click();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/demo/reset');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Demo data reset');
  });

  it('explains a read-only live backend and discards the kept changes', async () => {
    const { el, button } = await setup({ readOnly: () => true, changeCount: () => 2 });
    expect(el.textContent).toContain('kept only in this browser tab');
    expect(el.textContent).toContain('2 changes kept.');
    button('Discard my changes').click();
    expect(TestBed.inject(DemoOverlay).clear).toHaveBeenCalledTimes(1);
    localStorage.clear();
  });

  it('has no read-only notice in mock mode', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('Read-only live demo');
  });

  it('does nothing when the reset is not confirmed', async () => {
    const { button } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    button('Reset demo data').click();
    TestBed.inject(HttpTestingController).expectNone('/api/demo/reset');
  });
});
