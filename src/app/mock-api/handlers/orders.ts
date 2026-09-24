import { Order, OrderStatus } from '../../models';
import { MockDb, mockDb } from '../db';
import { applyListQuery, parseListQuery } from '../query';
import { MockRouter, bodyOf, fail, notFound, ok } from '../router';
import { MOCK_NOW, round2 } from '../seed';

const STATUSES: readonly OrderStatus[] = ['new', 'packing', 'shipped', 'delivered', 'cancelled'];
const CLOSED: readonly OrderStatus[] = ['delivered', 'cancelled'];

export function registerOrderRoutes(r: MockRouter): void {
  r.add('GET', '/api/orders', (req) => {
    const q = parseListQuery(req.query);
    const statuses = (req.query.get('status') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const from = parseTime(req.query.get('from'));
    const to = parseTime(req.query.get('to'));

    const rows = mockDb.data.orders.filter((o) => {
      if (statuses.length && !statuses.includes(o.status)) return false;
      const at = Date.parse(o.createdAt);
      return (from === null || at >= from) && (to === null || at <= to);
    });
    return ok(
      applyListQuery(
        rows,
        { ...q, sort: q.sort ?? 'createdAt' },
        { searchFields: ['number', 'customerName', 'customerEmail'] },
      ),
    );
  });

  r.add('GET', '/api/orders/:id', (req) => {
    const order = findOrder(req.params['id']);
    return order ? ok(order) : notFound('Order');
  });

  r.add('PATCH', '/api/orders/:id/status', (req) => {
    const order = findOrder(req.params['id']);
    if (!order) return notFound('Order');
    const { status } = bodyOf(req);
    if (!isStatus(status)) {
      return fail(422, 'validation', 'Unknown order status', { status: 'Unknown order status' });
    }
    if (CLOSED.includes(order.status)) {
      return fail(
        422,
        'invalid_transition',
        `Order #${order.number} is ${order.status} and can no longer change status`,
      );
    }
    changeStatus(mockDb, order, status);
    return ok(order);
  });

  r.add('POST', '/api/orders/bulk-status', (req) => {
    const { ids, status } = bodyOf(req);
    if (!Array.isArray(ids) || !isStatus(status)) {
      return fail(422, 'validation', 'Expected { ids: string[]; status }');
    }
    const wanted = new Set(ids.map(String));
    let updated = 0;
    for (const order of mockDb.data.orders) {
      if (!wanted.has(order.id) || CLOSED.includes(order.status)) continue;
      changeStatus(mockDb, order, status);
      updated++;
    }
    return ok({ updated });
  });
}

/** Moves an order to a new status, recording history and keeping aggregates consistent. */
export function changeStatus(db: MockDb, order: Order, status: OrderStatus): void {
  if (order.status === status) return;
  order.status = status;
  order.history.push({ status, at: currentTime().toISOString() });
  if (status === 'cancelled') {
    for (const item of order.items) {
      const product = db.data.products.find((p) => p.id === item.productId);
      if (product) product.sold = Math.max(0, product.sold - item.quantity);
    }
    recomputeCustomer(db, order.customerId);
  }
}

/** Recalculates ordersCount / lifetimeValue / lastOrderAt from non-cancelled orders. */
export function recomputeCustomer(db: MockDb, customerId: string): void {
  const customer = db.data.customers.find((c) => c.id === customerId);
  if (!customer) return;
  const own = db.data.orders.filter((o) => o.customerId === customerId && o.status !== 'cancelled');
  customer.ordersCount = own.length;
  customer.lifetimeValue = round2(own.reduce((s, o) => s + o.total, 0));
  customer.lastOrderAt = own.reduce<string | null>(
    (latest, o) => (latest === null || o.createdAt > latest ? o.createdAt : latest),
    null,
  );
}

/** Wall-clock time, but never earlier than the seed's fixed "now". */
function currentTime(): Date {
  return new Date(Math.max(Date.now(), MOCK_NOW.getTime()));
}

function findOrder(id: string | undefined): Order | undefined {
  return mockDb.data.orders.find((o) => o.id === id);
}

function isStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function parseTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}
