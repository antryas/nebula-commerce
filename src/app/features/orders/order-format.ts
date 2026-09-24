import { Order, OrderStatus } from '../../models';
import { STATUS_META } from '../../shared/ui/status-chip';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'new',
  'packing',
  'shipped',
  'delivered',
  'cancelled',
];

/** Happy-path progression shown on the timeline. */
const FLOW: readonly OrderStatus[] = ['new', 'packing', 'shipped', 'delivered'];
const CLOSED: readonly OrderStatus[] = ['delivered', 'cancelled'];

export const PAYMENT_META: Record<Order['paymentMethod'], { label: string; icon: string }> = {
  card: { label: 'Card', icon: 'credit_card' },
  paypal: { label: 'PayPal', icon: 'account_balance_wallet' },
  apple_pay: { label: 'Apple Pay', icon: 'smartphone' },
};

export const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Regional-indicator flag for an ISO 3166-1 alpha-2 code: `US` → 🇺🇸. */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function itemCount(order: Pick<Order, 'items'>): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Statuses an order can be moved to; delivered and cancelled orders are final. */
export function statusTargets(status: OrderStatus): OrderStatus[] {
  return CLOSED.includes(status) ? [] : ORDER_STATUSES.filter((s) => s !== status);
}

export function isClosed(status: OrderStatus): boolean {
  return CLOSED.includes(status);
}

/** RFC 4180 CSV (CRLF line breaks) of the given orders. */
export function ordersToCsv(orders: readonly Order[]): string {
  const header = ['Order', 'Date', 'Customer', 'Email', 'Items', 'Total', 'Payment', 'Status'];
  const rows = orders.map((o) => [
    `#${o.number}`,
    o.createdAt,
    o.customerName,
    o.customerEmail,
    String(itemCount(o)),
    o.total.toFixed(2),
    PAYMENT_META[o.paymentMethod].label,
    STATUS_META[o.status].label,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export type TimelineState = 'done' | 'current' | 'upcoming';

export interface TimelineStep {
  status: OrderStatus;
  state: TimelineState;
  /** When the order reached this status; `null` for upcoming steps. */
  at: string | null;
  note?: string;
}

/**
 * Timeline for an order: every recorded status change, then (for open orders) the
 * remaining happy-path steps as upcoming. The latest change is the current step.
 */
export function buildTimeline(order: Pick<Order, 'status' | 'history'>): TimelineStep[] {
  const steps: TimelineStep[] = order.history.map((h, i, all) => {
    const step: TimelineStep = {
      status: h.status,
      state: i === all.length - 1 ? 'current' : 'done',
      at: h.at,
    };
    if (h.note) step.note = h.note;
    return step;
  });
  if (!steps.length) steps.push({ status: order.status, state: 'current', at: null });
  if (order.status !== 'cancelled') {
    const reached = FLOW.indexOf(order.status);
    for (const status of FLOW.slice(reached + 1)) {
      steps.push({ status, state: 'upcoming', at: null });
    }
  }
  return steps;
}

/** Triggers a client-side file download. */
export function downloadText(doc: Document, filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
