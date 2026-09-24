import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../mock-backend';
import { mockDb } from '../db';
import {
  CategorySales,
  FunnelStep,
  GeoSales,
  HeatCell,
  Kpi,
  Order,
  Product,
  TimePoint,
} from '../../models';

describe('analytics mock API', () => {
  let http: HttpClient;

  beforeEach(() => {
    mockDb.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));

  it('returns 4 KPIs with deltas', async () => {
    const k = await get<Kpi[]>('/api/analytics/overview?range=30d');
    expect(k.map((x) => x.key)).toEqual(['revenue', 'orders', 'aov', 'conversion']);
    for (const x of k) {
      expect(x.spark).toHaveLength(12);
      const expected = x.previous === 0 ? 0 : ((x.value - x.previous) / x.previous) * 100;
      expect(x.deltaPct).toBeCloseTo(expected, 1);
    }
  });

  it('produces dashboard-friendly KPI values for 30d', async () => {
    const k = await get<Kpi[]>('/api/analytics/overview?range=30d');
    const byKey = Object.fromEntries(k.map((x) => [x.key, x]));
    expect(byKey['revenue'].deltaPct).toBeGreaterThan(0);
    expect(byKey['revenue'].deltaPct).toBeLessThan(40);
    expect(byKey['orders'].value).toBeGreaterThan(50);
    expect(byKey['aov'].value).toBeCloseTo(byKey['revenue'].value / byKey['orders'].value, 1);
    expect(byKey['conversion'].format).toBe('percent');
    expect(byKey['conversion'].value).toBeGreaterThan(2);
    expect(byKey['conversion'].value).toBeLessThan(4);
  });

  it('counts revenue from non-cancelled orders in the last 30 days', async () => {
    const k = await get<Kpi[]>('/api/analytics/overview?range=30d');
    const from = Date.parse('2026-09-24T12:00:00Z') - 30 * 86_400_000;
    const own = mockDb.data.orders.filter(
      (o) => o.status !== 'cancelled' && Date.parse(o.createdAt) >= from,
    );
    expect(k[1].value).toBe(own.length);
    expect(k[0].value).toBeCloseTo(
      own.reduce((s, o) => s + o.total, 0),
      1,
    );
  });

  it('revenue series has one point per day for 30d', async () => {
    const s = await get<TimePoint[]>('/api/analytics/revenue?range=30d');
    expect(s).toHaveLength(30);
    expect(Date.parse(s[0].date)).toBeLessThan(Date.parse(s[29].date));
    expect(s[29].date).toBe('2026-09-24');
  });

  it('revenue series is monthly for 12m', async () => {
    const s = await get<TimePoint[]>('/api/analytics/revenue?range=12m');
    expect(s).toHaveLength(12);
    expect(s.every((p) => p.orders > 0)).toBe(true);
  });

  it('rejects an unknown range', async () => {
    await expect(get('/api/analytics/revenue?range=5y')).rejects.toMatchObject({ status: 422 });
  });

  it('returns category sales sorted descending', async () => {
    const c = await get<CategorySales[]>('/api/analytics/categories?range=90d');
    expect(c).toHaveLength(6);
    for (let i = 1; i < c.length; i++) expect(c[i].revenue).toBeLessThanOrEqual(c[i - 1].revenue);
  });

  it('heatmap has 168 cells', async () => {
    expect(await get<HeatCell[]>('/api/analytics/heatmap?range=90d')).toHaveLength(168);
  });

  it('heatmap shows an evening peak', async () => {
    const h = await get<HeatCell[]>('/api/analytics/heatmap?range=90d');
    const sum = (from: number, to: number) =>
      h.filter((c) => c.hour >= from && c.hour < to).reduce((s, c) => s + c.orders, 0);
    expect(sum(18, 22)).toBeGreaterThan(3 * sum(2, 6));
    expect(h.every((c) => c.weekday >= 0 && c.weekday <= 6)).toBe(true);
  });

  it('returns geo sales sorted by revenue', async () => {
    const g = await get<GeoSales[]>('/api/analytics/geo?range=12m');
    expect(g[0].countryCode).toBe('US');
    for (let i = 1; i < g.length; i++) expect(g[i].revenue).toBeLessThanOrEqual(g[i - 1].revenue);
  });

  it('funnel decreases', async () => {
    const f = await get<FunnelStep[]>('/api/analytics/funnel?range=30d');
    expect(f.map((s) => s.step)).toEqual([
      'Visits',
      'Product views',
      'Added to cart',
      'Checkout',
      'Paid',
    ]);
    for (let i = 1; i < f.length; i++) expect(f[i].value).toBeLessThanOrEqual(f[i - 1].value);
    const k = await get<Kpi[]>('/api/analytics/overview?range=30d');
    expect(f[4].value).toBe(k[1].value);
  });

  it('returns top products limited and sorted by revenue', async () => {
    const t = await get<{ product: Product; unitsSold: number; revenue: number }[]>(
      '/api/analytics/top-products?range=30d&limit=3',
    );
    expect(t).toHaveLength(3);
    expect(t[0].product.id).toMatch(/^prd_/);
    expect(t[0].unitsSold).toBeGreaterThan(0);
    for (let i = 1; i < t.length; i++) expect(t[i].revenue).toBeLessThanOrEqual(t[i - 1].revenue);
  });

  it('live tick creates an order that shows up in the KPIs', async () => {
    const before = await get<Kpi[]>('/api/analytics/overview?range=7d');
    const order = await firstValueFrom(http.post<Order>('/api/live/tick', {}));
    expect(order.status).toBe('new');
    expect(mockDb.data.orders.at(-1)?.id).toBe(order.id);
    const after = await get<Kpi[]>('/api/analytics/overview?range=7d');
    expect(after[1].value).toBe(before[1].value + 1);
  });
});
