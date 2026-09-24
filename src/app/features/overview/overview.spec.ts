import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { AuthService } from '../../core/auth/auth.service';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
import { mockDb } from '../../mock-api/db';
import { Order } from '../../models';
import { Overview, greeting } from './overview';

class NoopResizeObserver {
  observe(): void {
    /* jsdom has no layout */
  }
  unobserve(): void {
    /* noop */
  }
  disconnect(): void {
    /* noop */
  }
}

function setup(failing: (path: string) => boolean = () => false) {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
  const fail = { fn: failing };
  const live = { enabled: signal(true), latest: signal<Order | null>(null), count: signal(0) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      {
        provide: MOCK_API_OPTIONS,
        useValue: { delayMs: () => 0, shouldFail: (_: string, path: string) => fail.fn(path) },
      },
      // Charts never initialize in jsdom: the ECharts loader stays pending.
      provideEchartsCore({ echarts: () => new Promise(() => undefined) }),
      { provide: LiveOrdersService, useValue: live },
      {
        provide: AuthService,
        useValue: { user: signal({ id: 'usr_1', name: 'Alex Morgan', email: 'a@b.c' }) },
      },
    ],
  });
  const overviewSpy = vi.spyOn(TestBed.inject(AnalyticsApi), 'overview');
  const fixture = TestBed.createComponent(Overview);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, live, fail, overviewSpy };
}

const liveOrder = (): Order => ({
  ...structuredClone(mockDb.data.orders[0]),
  id: 'ord_live_1',
  number: 99999,
  customerName: 'Live Shopper',
  createdAt: new Date().toISOString(),
});

describe('Overview', () => {
  beforeEach(() => {
    mockDb.reset();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('greets the user by first name', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent?.trim()).toMatch(
      /^Good (morning|afternoon|evening), Alex$/,
    );
  });

  it('renders 4 KPI cards with revenue highlighted', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const cards = el.querySelectorAll('nb-kpi-card');
    expect(cards).toHaveLength(4);
    expect(cards[0].textContent).toContain('Revenue');
    expect(cards[0].querySelector('.nb-gradient-border')).not.toBeNull();
    expect(cards[1].querySelector('.nb-gradient-border')).toBeNull();
  });

  it('renders the chart cards', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(el.querySelector('nb-revenue-chart [echarts]')).not.toBeNull();
    expect(el.querySelector('nb-category-donut [echarts]')).not.toBeNull();
    expect(el.querySelectorAll('nb-category-donut .nb-legend li')).toHaveLength(6);
  });

  it('renders the 6 latest orders linking to their details', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const rows = [...el.querySelectorAll<HTMLAnchorElement>('nb-recent-orders a.nb-order')];
    expect(rows).toHaveLength(6);
    expect(rows[0].getAttribute('href')).toMatch(/^\/orders\/ord_/);
  });

  it('renders "Top products" with 5 items', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    const card = el.querySelector('nb-top-products')!;
    expect(card.textContent).toContain('Top products');
    expect(card.querySelectorAll('li')).toHaveLength(5);
  });

  it('prepends live orders, keeps 6 and refreshes KPIs', async () => {
    const { fixture, el, live, overviewSpy } = setup();
    await fixture.whenStable();
    expect(overviewSpy).toHaveBeenCalledTimes(1);

    live.latest.set(liveOrder());
    await fixture.whenStable();

    const rows = el.querySelectorAll('nb-recent-orders a.nb-order');
    expect(rows).toHaveLength(6);
    expect(rows[0].textContent).toContain('Live Shopper');
    expect(rows[0].classList).toContain('nb-order--fresh');
    expect(overviewSpy).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('nb-kpi-card')).toHaveLength(4);
  });

  it('shows a per-card error with a working retry', async () => {
    const { fixture, el, fail } = setup((path) => path.endsWith('/top-products'));
    await fixture.whenStable();
    const card = el.querySelector('nb-top-products')!;
    expect(card.querySelector('nb-error-state')).not.toBeNull();
    expect(el.querySelectorAll('nb-kpi-card')).toHaveLength(4);

    fail.fn = () => false;
    card.querySelector<HTMLButtonElement>('nb-error-state button')!.click();
    await fixture.whenStable();
    expect(card.querySelector('nb-error-state')).toBeNull();
    expect(card.querySelectorAll('li')).toHaveLength(5);
  });
});

describe('greeting', () => {
  it.each([
    [8, 'Good morning'],
    [14, 'Good afternoon'],
    [20, 'Good evening'],
    [2, 'Good evening'],
  ])('at %i h says %s', (hour, text) => {
    expect(greeting(new Date(2026, 8, 24, hour))).toBe(text);
  });
});
