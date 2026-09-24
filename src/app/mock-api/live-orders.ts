import { Address, Order, OrderItem } from '../models';
import { MockDb, mockDb } from './db';
import { recomputeCustomer } from './handlers/orders';
import { MockRouter, ok } from './router';
import { MOCK_NOW, round2 } from './seed';

const PAYMENT_METHODS: readonly Order['paymentMethod'][] = ['card', 'card', 'paypal', 'apple_pay'];

/** `POST /api/live/tick` creates one live order; the client decides how often to call it. */
export function registerLiveRoutes(r: MockRouter): void {
  r.add('POST', '/api/live/tick', () =>
    ok(createLiveOrder(mockDb, new Date(Math.max(Date.now(), MOCK_NOW.getTime()))), 201),
  );
}

/**
 * Simulates a customer checking out right now: picks a random existing customer and
 * 1-3 random active products, stores a `new` order and keeps aggregates consistent.
 * Timing is driven by the client (`POST /api/live/tick`), so no timers live here.
 */
export function createLiveOrder(db: MockDb, now: Date, random: () => number = Math.random): Order {
  const { customers, products, orders } = db.data;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];

  const customer = pick(customers);
  const catalog = products.filter((p) => p.active);
  const pool = catalog.length ? catalog : products;
  const itemCount = Math.min(pool.length, 1 + Math.floor(random() * 3));

  const chosen = new Set<number>();
  while (chosen.size < itemCount) chosen.add(Math.floor(random() * pool.length));
  const items: OrderItem[] = [...chosen].map((idx) => {
    const p = pool[idx];
    return {
      productId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      sku: p.sku,
      quantity: random() < 0.8 ? 1 : 2,
      unitPrice: p.price,
    };
  });

  const subtotal = round2(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
  const shipping = subtotal >= 100 ? 0 : 7.99;
  const tax = round2(subtotal * 0.08);
  const createdAt = now.toISOString();
  const number = db.nextOrderNumber();

  const order: Order = {
    id: `ord_${String(number - 1000).padStart(6, '0')}`,
    number,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerAvatarUrl: customer.avatarUrl,
    items,
    subtotal,
    shipping,
    tax,
    total: round2(subtotal + shipping + tax),
    status: 'new',
    paymentMethod: pick(PAYMENT_METHODS),
    createdAt,
    shippingAddress: lastAddress(orders, customer.id) ?? {
      line1: '1 Market Street',
      city: customer.country,
      country: customer.country,
      countryCode: customer.countryCode,
      postalCode: '00000',
    },
    history: [{ status: 'new', at: createdAt, note: 'Order placed' }],
  };

  orders.push(order);
  for (const it of items) {
    const product = products.find((p) => p.id === it.productId);
    if (product) product.sold += it.quantity;
  }
  recomputeCustomer(db, customer.id);
  return order;
}

function lastAddress(orders: Order[], customerId: string): Address | undefined {
  for (let i = orders.length - 1; i >= 0; i--) {
    if (orders[i].customerId === customerId) return { ...orders[i].shippingAddress };
  }
  return undefined;
}
