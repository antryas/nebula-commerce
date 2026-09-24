import { MockDb } from './db';
import { createSeed, MOCK_NOW } from './seed';

describe('createSeed', () => {
  it('is deterministic for the same seed', () => {
    const a = createSeed(42);
    const b = createSeed(42);
    expect(a.orders[10]).toEqual(b.orders[10]);
    expect(a.products.map((p) => p.name)).toEqual(b.products.map((p) => p.name));
  });

  it('creates expected volumes', () => {
    const d = createSeed(42);
    expect(d.products).toHaveLength(60);
    expect(d.customers).toHaveLength(700);
    expect(d.orders).toHaveLength(4800);
  });

  it('keeps order totals consistent', () => {
    for (const o of createSeed(42).orders.slice(0, 50)) {
      const subtotal = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      expect(o.subtotal).toBeCloseTo(subtotal, 2);
      expect(o.total).toBeCloseTo(o.subtotal + o.shipping + o.tax, 2);
    }
  });

  it('computes customer aggregates from orders', () => {
    const d = createSeed(42);
    const c = d.customers[0];
    const own = d.orders.filter((o) => o.customerId === c.id && o.status !== 'cancelled');
    expect(c.ordersCount).toBe(own.length);
    expect(c.lifetimeValue).toBeCloseTo(
      own.reduce((s, o) => s + o.total, 0),
      2,
    );
  });

  it('never creates orders in the future', () => {
    const now = new Date('2026-09-24T12:00:00Z').getTime();
    expect(createSeed(42).orders.every((o) => Date.parse(o.createdAt) <= now)).toBe(true);
  });

  it('exports MOCK_NOW as the default reference time', () => {
    expect(MOCK_NOW.toISOString()).toBe('2026-09-24T12:00:00.000Z');
  });

  it('produces valid unique SKUs and ids', () => {
    const d = createSeed(42);
    const skus = d.products.map((p) => p.sku);
    expect(skus.every((s) => /^[A-Z0-9-]{4,20}$/.test(s))).toBe(true);
    expect(new Set(skus).size).toBe(skus.length);
    expect(new Set(d.orders.map((o) => o.id)).size).toBe(4800);
    expect(new Set(d.orders.map((o) => o.number)).size).toBe(4800);
  });

  it('spreads orders over roughly the last 13 months', () => {
    const d = createSeed(42);
    const oldest = Math.min(...d.orders.map((o) => Date.parse(o.createdAt)));
    const days = (MOCK_NOW.getTime() - oldest) / 86_400_000;
    expect(days).toBeGreaterThan(330);
    expect(days).toBeLessThanOrEqual(400);
  });

  it('assigns statuses by order age', () => {
    const d = createSeed(42);
    const cancelled = d.orders.filter((o) => o.status === 'cancelled').length;
    expect(cancelled / d.orders.length).toBeGreaterThan(0.01);
    expect(cancelled / d.orders.length).toBeLessThan(0.08);
    const old = d.orders.filter(
      (o) => MOCK_NOW.getTime() - Date.parse(o.createdAt) > 4 * 86_400_000,
    );
    expect(old.every((o) => o.status === 'delivered' || o.status === 'cancelled')).toBe(true);
    const fresh = d.orders.filter(
      (o) => MOCK_NOW.getTime() - Date.parse(o.createdAt) < 0.5 * 86_400_000,
    );
    expect(fresh.every((o) => ['new', 'packing', 'cancelled'].includes(o.status))).toBe(true);
    expect(fresh.some((o) => o.status === 'new')).toBe(true);
    for (const o of d.orders) {
      expect(o.history.at(-1)?.status).toBe(o.status);
    }
  });

  it('has enough in-flight orders to fill the fulfillment board', () => {
    const d = createSeed(42);
    const count = (s: string) => d.orders.filter((o) => o.status === s).length;
    expect(count('new')).toBeGreaterThanOrEqual(12);
    expect(count('new')).toBeLessThanOrEqual(18);
    expect(count('packing')).toBeGreaterThanOrEqual(10);
    expect(count('packing')).toBeLessThanOrEqual(15);
    expect(count('shipped')).toBeGreaterThanOrEqual(15);
    expect(count('shipped')).toBeLessThanOrEqual(25);
  });
});

describe('MockDb', () => {
  it('resets data to the initial seed', () => {
    const db = new MockDb();
    db.data.orders.length = 0;
    db.reset();
    expect(db.data.orders).toHaveLength(4800);
  });

  it('issues increasing order numbers after the highest existing one', () => {
    const db = new MockDb();
    const max = Math.max(...db.data.orders.map((o) => o.number));
    expect(db.nextOrderNumber()).toBe(max + 1);
    expect(db.nextOrderNumber()).toBe(max + 2);
  });
});
