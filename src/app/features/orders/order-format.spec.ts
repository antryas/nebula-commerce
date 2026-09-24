import { Order } from '../../models';
import { buildTimeline, flagEmoji, ordersToCsv, statusTargets } from './order-format';

const ORDER = {
  id: 'ord_000001',
  number: 1042,
  customerName: 'Ada "The Countess" Lovelace',
  customerEmail: 'ada@example.com',
  items: [
    { quantity: 2, unitPrice: 10 },
    { quantity: 1, unitPrice: 5 },
  ],
  total: 27.5,
  status: 'shipped',
  paymentMethod: 'apple_pay',
  createdAt: '2026-09-20T10:00:00.000Z',
  history: [
    { status: 'new', at: '2026-09-20T10:00:00.000Z' },
    { status: 'packing', at: '2026-09-21T10:00:00.000Z' },
    { status: 'shipped', at: '2026-09-22T10:00:00.000Z' },
  ],
} as Order;

describe('order-format', () => {
  it('turns a country code into a flag emoji', () => {
    expect(flagEmoji('US')).toBe('🇺🇸');
    expect(flagEmoji('de')).toBe('🇩🇪');
    expect(flagEmoji('')).toBe('');
  });

  it('exports CSV with a header and escaped values', () => {
    const csv = ordersToCsv([ORDER]);
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('Order,Date,Customer,Email,Items,Total,Payment,Status');
    expect(row).toBe(
      '#1042,2026-09-20T10:00:00.000Z,"Ada ""The Countess"" Lovelace",ada@example.com,3,27.50,Apple Pay,Shipped',
    );
  });

  it('builds a timeline with done, current and upcoming steps', () => {
    const steps = buildTimeline(ORDER);
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['new', 'done'],
      ['packing', 'done'],
      ['shipped', 'current'],
      ['delivered', 'upcoming'],
    ]);
    expect(steps[1].at).toBe('2026-09-21T10:00:00.000Z');
    expect(steps[3].at).toBeNull();
  });

  it('ends the timeline at cancellation', () => {
    const cancelled = {
      ...ORDER,
      status: 'cancelled',
      history: [...ORDER.history.slice(0, 1), { status: 'cancelled', at: '2026-09-21T00:00:00Z' }],
    } as Order;
    expect(buildTimeline(cancelled).map((s) => [s.status, s.state])).toEqual([
      ['new', 'done'],
      ['cancelled', 'current'],
    ]);
  });

  it('offers status targets only for open orders', () => {
    expect(statusTargets('packing')).toEqual(['new', 'shipped', 'delivered', 'cancelled']);
    expect(statusTargets('delivered')).toEqual([]);
    expect(statusTargets('cancelled')).toEqual([]);
  });
});
