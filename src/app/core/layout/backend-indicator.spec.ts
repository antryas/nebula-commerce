import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ApiConfigService, BACKEND_STORAGE_KEY, BackendMode } from '../api/api-config.service';
import { BackendStatus, BackendStatusService } from '../api/backend-status.service';
import { BackendSwitch } from '../api/backend-switch';
import { DemoOverlay } from '../api/demo-overlay';
import { BackendIndicator, backendStatusText } from './backend-indicator';

async function setup(initial: BackendStatus = 'mock', latency: number | null = null) {
  const status = signal<BackendStatus>(initial);
  const latencyMs = signal<number | null>(latency);
  const mode = signal<BackendMode>(initial === 'mock' ? 'mock' : 'live');
  const switcher = { switchTo: vi.fn() };
  const readOnly = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: BackendStatusService, useValue: { status, latencyMs } },
      { provide: BackendSwitch, useValue: switcher },
      { provide: DemoOverlay, useValue: { readOnly } },
      {
        provide: ApiConfigService,
        useValue: { mode, liveOrigin: 'https://api.example.test' },
      },
    ],
  });
  const fixture = TestBed.createComponent(BackendIndicator);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const pill = el.querySelector<HTMLButtonElement>('.nb-backend')!;
  const label = () => pill.querySelector('.nb-backend__label')?.textContent?.trim();
  const openMenu = async () => {
    pill.click();
    await fixture.whenStable();
  };
  return { fixture, el, pill, label, status, latencyMs, mode, switcher, readOnly, openMenu };
}

describe('backendStatusText', () => {
  it('describes every status', () => {
    expect(backendStatusText('mock', null).label).toBe('Mock data');
    expect(backendStatusText('checking', null).label).toBe('Connecting…');
    expect(backendStatusText('online', 42).label).toBe('Live .NET · 42 ms');
    expect(backendStatusText('offline', null).label).toBe('API offline');
  });

  it('keeps latency out of the screen-reader announcement', () => {
    expect(backendStatusText('online', 42).announcement).toBe('Live .NET backend online');
  });
});

describe('BackendIndicator', () => {
  afterEach(() => {
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    document.querySelectorAll('.cdk-overlay-container').forEach((n) => (n.innerHTML = ''));
  });

  it('shows "Mock data" in mock mode', async () => {
    const { pill, label } = await setup('mock');
    expect(label()).toBe('Mock data');
    expect(pill.dataset['status']).toBe('mock');
    expect(pill.getAttribute('aria-label')).toBe('Data source: Mock data. Change data source');
  });

  it('follows the status: connecting, online with latency, offline', async () => {
    const { fixture, pill, label, status, latencyMs, el } = await setup('checking');
    expect(label()).toBe('Connecting…');

    status.set('online');
    latencyMs.set(37);
    await fixture.whenStable();
    expect(label()).toBe('Live .NET · 37 ms');
    expect(pill.dataset['status']).toBe('online');

    status.set('offline');
    latencyMs.set(null);
    await fixture.whenStable();
    expect(label()).toBe('API offline');
    expect(el.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('Live API offline');
  });

  it('opens a menu with the switch, an explanation and the API docs link', async () => {
    const { openMenu, pill } = await setup('mock');
    await openMenu();
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const toggle = document.querySelector<HTMLElement>('[role="menuitemcheckbox"]')!;
    expect(toggle.textContent).toContain('Live .NET backend');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(document.querySelector('.nb-backend-menu__hint')?.textContent).toContain(
      'ASP.NET Core API',
    );
    const docs = document.querySelector<HTMLAnchorElement>('a[mat-menu-item]')!;
    expect(docs.href).toBe('https://api.example.test/swagger');
    expect(docs.target).toBe('_blank');
    expect(docs.rel).toBe('noopener');
  });

  it('the switch asks BackendSwitch for the other mode', async () => {
    const { openMenu, switcher } = await setup('mock');
    await openMenu();
    document.querySelector<HTMLElement>('[role="menuitemcheckbox"]')!.click();
    expect(switcher.switchTo).toHaveBeenCalledWith('live');
  });

  it('explains a read-only live backend in the menu', async () => {
    const { openMenu, readOnly } = await setup('online', 20);
    readOnly.set(true);
    await openMenu();
    expect(document.querySelector('.nb-backend-menu__note')?.textContent).toContain(
      'kept only in this browser tab',
    );
  });

  it('has no read-only note for a writable backend', async () => {
    const { openMenu } = await setup('online', 20);
    await openMenu();
    expect(document.querySelector('.nb-backend-menu__note')).toBeNull();
  });

  it('switches back to mock from live mode', async () => {
    const { openMenu, switcher } = await setup('online', 20);
    await openMenu();
    const toggle = document.querySelector<HTMLElement>('[role="menuitemcheckbox"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    expect(switcher.switchTo).toHaveBeenCalledWith('mock');
  });
});
