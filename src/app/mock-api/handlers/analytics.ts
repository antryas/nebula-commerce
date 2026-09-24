import {
  CategorySales,
  FunnelStep,
  GeoSales,
  HeatCell,
  Kpi,
  Order,
  Product,
  ProductCategory,
  RevenueRange,
  TimePoint,
} from '../../models';
import { mockDb } from '../db';
import { MockRequest, MockResponse, MockRouter, fail, ok } from '../router';
import { MOCK_NOW, round2 } from '../seed';

const DAY_MS = 86_400_000;
const RANGES: readonly RevenueRange[] = ['7d', '30d', '90d', '12m'];
const CATEGORIES: readonly ProductCategory[] = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Electronics',
  'Home',
  'Beauty',
];
const SPARK_BUCKETS = 12;

/** Synthetic storefront traffic: visits per paid order today, and how fast conversion improves. */
const VISITS_PER_ORDER = 38;
const CONVERSION_GAIN_PER_MONTH = 0.03;

/**
 * Time windows are rolling and end at the demo's fixed "now" (`MOCK_NOW`), so the last
 * bucket is a full day/month instead of a half-finished one. The newest bucket is open-ended:
 * live orders created after `MOCK_NOW` land in it, which makes KPIs tick up in real time.
 */
interface Period {
  /** Bucket boundaries, oldest first; `edges.length - 1` buckets. */
  edges: number[];
  /** Start of the previous period of equal length. */
  previousStart: number;
}

export function registerAnalyticsRoutes(r: MockRouter): void {
  r.add(
    'GET',
    '/api/analytics/overview',
    withRange((range) => ok(overview(range))),
  );
  r.add(
    'GET',
    '/api/analytics/revenue',
    withRange((range) => ok(revenueSeries(range))),
  );
  r.add(
    'GET',
    '/api/analytics/categories',
    withRange((range) => ok(categorySales(range))),
  );
  r.add(
    'GET',
    '/api/analytics/heatmap',
    withRange((range) => ok(heatmap(range))),
  );
  r.add(
    'GET',
    '/api/analytics/geo',
    withRange((range) => ok(geoSales(range))),
  );
  r.add(
    'GET',
    '/api/analytics/funnel',
    withRange((range) => ok(funnel(range))),
  );
  r.add(
    'GET',
    '/api/analytics/top-products',
    withRange((range, req) => {
      const limit = Number.parseInt(req.query.get('limit') ?? '5', 10);
      return ok(topProducts(range, Number.isFinite(limit) ? Math.min(50, Math.max(1, limit)) : 5));
    }),
  );
}

function withRange(
  handler: (range: RevenueRange, req: MockRequest) => MockResponse,
): (req: MockRequest) => MockResponse {
  return (req) => {
    const range = req.query.get('range') ?? '30d';
    if (!(RANGES as readonly string[]).includes(range)) {
      return fail(422, 'validation', `Unknown range "${range}"`, {
        range: `Expected one of ${RANGES.join(', ')}`,
      });
    }
    return handler(range as RevenueRange, req);
  };
}

// ---------------------------------------------------------------------------------------------
// Endpoints

function overview(range: RevenueRange): Kpi[] {
  const { edges, previousStart } = period(range);
  const start = edges[0];
  const current = paidOrdersSince(start);
  const previous = paidOrders().filter((o) => inWindow(o, previousStart, start));

  // The seed only covers ~13 months, so the previous 12m window is mostly empty. Extrapolate
  // additive metrics (revenue, orders) from the part of that window that has data;
  // ratios (AOV, conversion) are unaffected by coverage.
  const coverage = previousCoverage(previousStart, start);
  const extrapolate = coverage > 0 && coverage < 1 ? 1 / coverage : 1;

  const sparkEdges = splitEvenly(start, edges[edges.length - 1], SPARK_BUCKETS);
  const sparkBuckets = bucketize(current, sparkEdges);

  const revenue = (list: Order[]) => round2(sum(list, (o) => o.total));
  const aov = (list: Order[]) => (list.length ? round2(revenue(list) / list.length) : 0);
  const conversion = (list: Order[]) => {
    const visits = visitsFor(list);
    return visits ? round2((list.length / visits) * 100) : 0;
  };

  const kpi = (
    key: Kpi['key'],
    label: string,
    format: Kpi['format'],
    metric: (list: Order[]) => number,
    additive = false,
  ): Kpi => {
    const value = metric(current);
    const scaled = metric(previous) * (additive ? extrapolate : 1);
    const prev = format === 'number' ? Math.round(scaled) : round2(scaled);
    return {
      key,
      label,
      value,
      previous: prev,
      deltaPct: prev === 0 ? 0 : round2(((value - prev) / prev) * 100),
      spark: sparkBuckets.map(metric),
      format,
    };
  };

  return [
    kpi('revenue', 'Revenue', 'currency', revenue, true),
    kpi('orders', 'Orders', 'number', (list) => list.length, true),
    kpi('aov', 'Avg. order value', 'currency', aov),
    kpi('conversion', 'Conversion rate', 'percent', conversion),
  ];
}

function revenueSeries(range: RevenueRange): TimePoint[] {
  const { edges } = period(range);
  const buckets = bucketize(paidOrdersSince(edges[0]), edges);
  return buckets.map((list, i) => ({
    date: bucketLabel(range, edges[i + 1]),
    revenue: round2(sum(list, (o) => o.total)),
    orders: list.length,
  }));
}

function categorySales(range: RevenueRange): CategorySales[] {
  const categoryOf = new Map(mockDb.data.products.map((p) => [p.id, p.category]));
  const totals = new Map<ProductCategory, number>(CATEGORIES.map((c) => [c, 0]));
  for (const o of paidOrdersSince(period(range).edges[0])) {
    for (const it of o.items) {
      const category = categoryOf.get(it.productId);
      if (category) totals.set(category, (totals.get(category) ?? 0) + it.quantity * it.unitPrice);
    }
  }
  return [...totals]
    .map(([category, revenue]) => ({ category, revenue: round2(revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
}

function heatmap(range: RevenueRange): HeatCell[] {
  const counts = Array.from({ length: 7 * 24 }, () => 0);
  for (const o of paidOrdersSince(period(range).edges[0])) {
    const at = new Date(o.createdAt);
    const weekday = (at.getUTCDay() + 6) % 7; // 0 = Monday
    counts[weekday * 24 + at.getUTCHours()]++;
  }
  return counts.map((orders, i) => ({ weekday: Math.floor(i / 24), hour: i % 24, orders }));
}

function geoSales(range: RevenueRange): GeoSales[] {
  const byCountry = new Map<string, GeoSales>();
  for (const o of paidOrdersSince(period(range).edges[0])) {
    const { countryCode, country } = o.shippingAddress;
    const row = byCountry.get(countryCode) ?? { countryCode, country, revenue: 0, orders: 0 };
    row.revenue += o.total;
    row.orders += 1;
    byCountry.set(countryCode, row);
  }
  return [...byCountry.values()]
    .map((row) => ({ ...row, revenue: round2(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
}

function funnel(range: RevenueRange): FunnelStep[] {
  const orders = paidOrdersSince(period(range).edges[0]);
  const paid = orders.length;
  const visits = visitsFor(orders);
  // Typical e-commerce drop-off: ~64% of checkouts pay, ~42% of carts reach checkout.
  const checkout = Math.max(paid, Math.round(paid / 0.64));
  const cart = Math.max(checkout, Math.round(checkout / 0.42));
  const views = Math.min(visits, Math.max(cart, Math.round(visits * 0.46)));
  return [
    { step: 'Visits', value: Math.max(visits, views) },
    { step: 'Product views', value: views },
    { step: 'Added to cart', value: cart },
    { step: 'Checkout', value: checkout },
    { step: 'Paid', value: paid },
  ];
}

function topProducts(
  range: RevenueRange,
  limit: number,
): { product: Product; unitsSold: number; revenue: number }[] {
  const stats = new Map<string, { unitsSold: number; revenue: number }>();
  for (const o of paidOrdersSince(period(range).edges[0])) {
    for (const it of o.items) {
      const row = stats.get(it.productId) ?? { unitsSold: 0, revenue: 0 };
      row.unitsSold += it.quantity;
      row.revenue += it.quantity * it.unitPrice;
      stats.set(it.productId, row);
    }
  }
  const products = new Map(mockDb.data.products.map((p) => [p.id, p]));
  return [...stats]
    .flatMap(([id, s]) => {
      const product = products.get(id);
      return product ? [{ product, unitsSold: s.unitsSold, revenue: round2(s.revenue) }] : [];
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Helpers

function period(range: RevenueRange): Period {
  const end = MOCK_NOW.getTime();
  if (range === '12m') {
    const edges = Array.from({ length: 13 }, (_, i) => addMonths(end, i - 12));
    return { edges, previousStart: addMonths(end, -24) };
  }
  const days = Number.parseInt(range, 10);
  const edges = Array.from({ length: days + 1 }, (_, i) => end - (days - i) * DAY_MS);
  return { edges, previousStart: end - 2 * days * DAY_MS };
}

/** Share of `[from, to)` that lies after the first recorded order (0..1). */
function previousCoverage(from: number, to: number): number {
  const first = mockDb.data.orders.reduce(
    (min, o) => Math.min(min, Date.parse(o.createdAt)),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(first) || first >= to) return 0;
  return (to - Math.max(from, first)) / (to - from);
}

function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

function splitEvenly(from: number, to: number, parts: number): number[] {
  return Array.from({ length: parts + 1 }, (_, i) => from + ((to - from) * i) / parts);
}

/** Groups orders into `edges.length - 1` buckets; the last bucket has no upper bound. */
function bucketize(orders: Order[], edges: number[]): Order[][] {
  const buckets: Order[][] = Array.from({ length: edges.length - 1 }, () => []);
  for (const o of orders) {
    const at = Date.parse(o.createdAt);
    if (at < edges[0]) continue;
    let i = buckets.length - 1;
    while (i > 0 && at < edges[i]) i--;
    buckets[i].push(o);
  }
  return buckets;
}

/** Daily buckets are labelled by the day they end on, monthly ones by that month. */
function bucketLabel(range: RevenueRange, bucketEnd: number): string {
  const iso = new Date(bucketEnd).toISOString();
  return range === '12m' ? `${iso.slice(0, 7)}-01` : iso.slice(0, 10);
}

function paidOrders(): Order[] {
  return mockDb.data.orders.filter((o) => o.status !== 'cancelled');
}

function paidOrdersSince(from: number): Order[] {
  return paidOrders().filter((o) => Date.parse(o.createdAt) >= from);
}

function inWindow(o: Order, from: number, to: number): boolean {
  const at = Date.parse(o.createdAt);
  return at >= from && at < to;
}

function sum<T>(list: T[], pick: (x: T) => number): number {
  return list.reduce((s, x) => s + pick(x), 0);
}

/**
 * Synthetic visits behind a set of paid orders: ~38 visits per order with deterministic
 * day-level noise (±15%), and slightly more visits per order further in the past so the
 * conversion rate trends gently upward.
 */
function visitsFor(orders: Order[]): number {
  const now = MOCK_NOW.getTime();
  return Math.round(
    sum(orders, (o) => {
      const at = Date.parse(o.createdAt);
      const day = Math.floor(at / DAY_MS);
      const monthsAgo = Math.max(0, (now - at) / (30.4 * DAY_MS));
      return VISITS_PER_ORDER * (1 + CONVERSION_GAIN_PER_MONTH * monthsAgo) * dayNoise(day);
    }),
  );
}

/** Deterministic pseudo-random factor in [0.85, 1.15] for a given day number. */
function dayNoise(day: number): number {
  let h = Math.imul(day ^ 0x5bd1e995, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
  h ^= h >>> 13;
  return 0.85 + ((h >>> 0) / 0xffffffff) * 0.3;
}
