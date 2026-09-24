import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { signal } from '@angular/core';
import { throwError } from 'rxjs';
import { OrdersApi } from '../../core/api/orders-api';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { ToastService } from '../../core/notifications/toast.service';
import { mockDb } from '../../mock-api/db';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { Order } from '../../models';
import { FulfillmentStore, nextStatus } from './fulfillment.store';

describe('FulfillmentStore', () => {
  const latest = signal<Order | null>(null);

  beforeEach(() => {
    mockDb.reset();
    latest.set(null);
    TestBed.configureTestingModule({
      providers: [
        FulfillmentStore,
        provideHttpClient(withInterceptors([mockApiInterceptor, errorInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
        { provide: LiveOrdersService, useValue: { latest } },
      ],
    });
  });

  it('groups orders by status', async () => {
    const s = TestBed.inject(FulfillmentStore);
    await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(0));
    expect(s.loading()).toBe(false);
    expect(s.columns().new.every((o) => o.status === 'new')).toBe(true);
    expect(s.columns().packing.every((o) => o.status === 'packing')).toBe(true);
    expect(s.columns().shipped.every((o) => o.status === 'shipped')).toBe(true);
    expect(s.columns().delivered.every((o) => o.status === 'delivered')).toBe(true);
    expect(s.columns().delivered.length).toBeLessThanOrEqual(20);
  });

  it('shows the most recent delivered orders first', async () => {
    const s = TestBed.inject(FulfillmentStore);
    await vi.waitFor(() => expect(s.columns().delivered.length).toBeGreaterThan(1));
    const dates = s.columns().delivered.map((o) => o.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const newestDelivered = mockDb.data.orders
      .filter((o) => o.status === 'delivered')
      .reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    expect(dates[0]).toBe(newestDelivered.createdAt);
  });

  it('moves forward optimistically and persists', async () => {
    const s = TestBed.inject(FulfillmentStore);
    await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(0));
    const id = s.columns().new[0].id;
    const p = s.move(id, 'packing', 0);
    expect(s.columns().packing[0].id).toBe(id);
    expect(s.columns().packing[0].status).toBe('packing');
    expect(s.columns().new.some((o) => o.id === id)).toBe(false);
    expect(s.pending().has(id)).toBe(true);
    await p;
    expect(s.pending().has(id)).toBe(false);
    expect(mockDb.data.orders.find((o) => o.id === id)!.status).toBe('packing');
  });

  it('rejects backward moves without API call', async () => {
    const s = TestBed.inject(FulfillmentStore);
    const toasts = TestBed.inject(ToastService);
    const api = TestBed.inject(OrdersApi);
    await vi.waitFor(() => expect(s.columns().shipped.length).toBeGreaterThan(0));
    const spy = vi.spyOn(api, 'updateStatus');
    const id = s.columns().shipped[0].id;
    await s.move(id, 'new', 0);
    expect(spy).not.toHaveBeenCalled();
    expect(s.columns().shipped.some((o) => o.id === id)).toBe(true);
    expect(s.columns().new.some((o) => o.id === id)).toBe(false);
    expect(mockDb.data.orders.find((o) => o.id === id)!.status).toBe('shipped');
    expect(toasts.toasts().map((t) => t.title)).toContain('Orders can only move forward');
  });

  it('reorders within a column locally without an API call', async () => {
    const s = TestBed.inject(FulfillmentStore);
    const api = TestBed.inject(OrdersApi);
    await vi.waitFor(() => expect(s.columns().packing.length).toBeGreaterThan(1));
    const spy = vi.spyOn(api, 'updateStatus');
    const [first, second] = s.columns().packing;
    await s.move(first.id, 'packing', 1);
    expect(spy).not.toHaveBeenCalled();
    expect(s.columns().packing[0].id).toBe(second.id);
    expect(s.columns().packing[1].id).toBe(first.id);
  });

  it('rolls back on API error', async () => {
    const s = TestBed.inject(FulfillmentStore);
    const toasts = TestBed.inject(ToastService);
    const api = TestBed.inject(OrdersApi);
    await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(1));
    vi.spyOn(api, 'updateStatus').mockReturnValue(
      throwError(() => ({ status: 500, code: 'unknown', message: 'x' })),
    );
    const before = s.columns().new.map((o) => o.id);
    const order = s.columns().new[1];

    const p = s.move(order.id, 'shipped', 0);
    expect(s.columns().shipped[0].id).toBe(order.id);
    await p;

    expect(s.columns().new.map((o) => o.id)).toEqual(before);
    expect(s.columns().new[1].status).toBe('new');
    expect(s.columns().shipped.some((o) => o.id === order.id)).toBe(false);
    expect(s.pending().has(order.id)).toBe(false);
    expect(mockDb.data.orders.find((o) => o.id === order.id)!.status).toBe('new');
    expect(toasts.toasts().map((t) => t.title)).toEqual([`Could not move order #${order.number}`]);
  });

  it('shows a single toast when the server rejects the move', async () => {
    const s = TestBed.inject(FulfillmentStore);
    const toasts = TestBed.inject(ToastService);
    await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(0));
    const order = s.columns().new[0];
    // Someone else cancelled it meanwhile: the mock API refuses closed orders.
    mockDb.data.orders.find((o) => o.id === order.id)!.status = 'cancelled';
    await s.move(order.id, 'packing', 0);
    expect(s.columns().new[0].id).toBe(order.id);
    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0].title).toBe(`Could not move order #${order.number}`);
  });

  it('advances an order to the next status', async () => {
    const s = TestBed.inject(FulfillmentStore);
    await vi.waitFor(() => expect(s.columns().shipped.length).toBeGreaterThan(0));
    const id = s.columns().shipped[0].id;
    await s.advance(id);
    expect(s.columns().delivered[0].id).toBe(id);
    expect(mockDb.data.orders.find((o) => o.id === id)!.status).toBe('delivered');
  });

  it('knows the next status in the pipeline', () => {
    expect(nextStatus('new')).toBe('packing');
    expect(nextStatus('packing')).toBe('shipped');
    expect(nextStatus('shipped')).toBe('delivered');
    expect(nextStatus('delivered')).toBeNull();
  });

  it('prepends live orders to New and marks them fresh', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const s = TestBed.inject(FulfillmentStore);
      await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(0));
      const live: Order = {
        ...s.columns().packing[0],
        id: 'ord_live',
        number: 9999,
        status: 'new',
      };
      latest.set(live);
      TestBed.tick();
      expect(s.columns().new[0].id).toBe('ord_live');
      expect(s.fresh().has('ord_live')).toBe(true);

      // The same order arriving again (e.g. re-emitted) is not duplicated.
      latest.set({ ...live });
      TestBed.tick();
      expect(s.columns().new.filter((o) => o.id === 'ord_live')).toHaveLength(1);

      vi.advanceTimersByTime(5000);
      expect(s.fresh().has('ord_live')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes column totals', async () => {
    const s = TestBed.inject(FulfillmentStore);
    await vi.waitFor(() => expect(s.columns().new.length).toBeGreaterThan(0));
    const expected = s.columns().new.reduce((sum, o) => sum + o.total, 0);
    expect(s.totals().new).toBeCloseTo(expected, 2);
  });
});
