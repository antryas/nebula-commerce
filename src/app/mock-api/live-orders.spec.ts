import { MockDb } from './db';
import { createLiveOrder } from './live-orders';

describe('createLiveOrder', () => {
  it('adds a new order and bumps customer aggregates', () => {
    const db = new MockDb();
    const before = db.data.orders.length;
    const order = createLiveOrder(db, new Date('2026-09-24T12:00:00Z'));
    expect(db.data.orders).toHaveLength(before + 1);
    expect(order.status).toBe('new');
    expect(order.number).toBe(Math.max(...db.data.orders.map((o) => o.number)));
    const c = db.data.customers.find((x) => x.id === order.customerId)!;
    expect(c.lastOrderAt).toBe(order.createdAt);
  });

  it('builds a consistent order with 1-3 items and unique id', () => {
    const db = new MockDb();
    const ids = new Set(db.data.orders.map((o) => o.id));
    for (let i = 0; i < 20; i++) {
      const o = createLiveOrder(db, new Date('2026-09-24T12:00:00Z'));
      expect(ids.has(o.id)).toBe(false);
      ids.add(o.id);
      expect(o.items.length).toBeGreaterThanOrEqual(1);
      expect(o.items.length).toBeLessThanOrEqual(3);
      const subtotal = o.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      expect(o.subtotal).toBeCloseTo(subtotal, 2);
      expect(o.total).toBeCloseTo(o.subtotal + o.shipping + o.tax, 2);
      expect(o.history).toEqual([{ status: 'new', at: o.createdAt, note: 'Order placed' }]);
    }
  });

  it('updates customer lifetime value and product sales', () => {
    const db = new MockDb();
    const order = createLiveOrder(db, new Date('2026-09-24T12:00:00Z'));
    const original = new MockDb();
    const c0 = original.data.customers.find((x) => x.id === order.customerId)!;
    const c1 = db.data.customers.find((x) => x.id === order.customerId)!;
    expect(c1.ordersCount).toBe(c0.ordersCount + 1);
    expect(c1.lifetimeValue).toBeCloseTo(c0.lifetimeValue + order.total, 2);
    const item = order.items[0];
    const p0 = original.data.products.find((p) => p.id === item.productId)!;
    const p1 = db.data.products.find((p) => p.id === item.productId)!;
    expect(p1.sold).toBe(p0.sold + item.quantity);
  });
});
