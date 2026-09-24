import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { mockDb } from '../../mock-api/db';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { Order } from '../../models';
import { OrdersStore } from './orders.store';

/** Generous timeout: the first request lazily loads the mock backend. */
const waitFor = (fn: () => void) => vi.waitFor(fn, { timeout: 5000 });

describe('OrdersStore', () => {
  let latest: WritableSignal<Order | null>;

  beforeEach(() => {
    mockDb.reset();
    latest = signal<Order | null>(null);
    TestBed.configureTestingModule({
      providers: [
        OrdersStore,
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
        { provide: LiveOrdersService, useValue: { latest } },
      ],
    });
  });

  it('loads first page on init', async () => {
    const store = TestBed.inject(OrdersStore);
    await waitFor(() => expect(store.result()?.items.length).toBe(20));
    expect(store.result()?.total).toBe(4800);
    expect(store.loading()).toBe(false);
  });

  it('resets to page 1 when status changes', async () => {
    const store = TestBed.inject(OrdersStore);
    store.setPage(3, 20);
    store.setStatus(['new']);
    await waitFor(() => expect(store.query().page).toBe(1));
    await waitFor(() => expect(store.result()!.items.every((o) => o.status === 'new')).toBe(true));
  });

  it('debounces search and resets the page', async () => {
    const store = TestBed.inject(OrdersStore);
    store.setPage(2, 20);
    store.setSearch('zzzz_nomatch');
    expect(store.query().search).toBe('');
    await waitFor(() => expect(store.query().search).toBe('zzzz_nomatch'));
    expect(store.query().page).toBe(1);
    await waitFor(() => expect(store.result()?.total).toBe(0));
  });

  it('toggles the selection for the whole page', async () => {
    const store = TestBed.inject(OrdersStore);
    await waitFor(() => expect(store.result()?.items.length).toBe(20));
    store.toggleAllOnPage();
    expect(store.selection().size).toBe(20);
    expect(store.allOnPageSelected()).toBe(true);
    store.toggleAllOnPage();
    expect(store.selection().size).toBe(0);
  });

  it('bulk updates selected orders', async () => {
    const store = TestBed.inject(OrdersStore);
    store.setStatus(['new']);
    await waitFor(() => expect(store.result()!.items.length).toBeGreaterThan(1));
    const ids = store
      .result()!
      .items.slice(0, 2)
      .map((o) => o.id);
    ids.forEach((id) => store.toggle(id));
    await store.bulkUpdate('packing');
    expect(
      mockDb.data.orders.filter((o) => ids.includes(o.id)).every((o) => o.status === 'packing'),
    ).toBe(true);
    expect(store.selection().size).toBe(0);
  });

  it('prepends live orders on the default view and flashes them', async () => {
    const store = TestBed.inject(OrdersStore);
    await waitFor(() => expect(store.result()?.items.length).toBe(20));
    const live = { ...store.result()!.items[5], id: 'ord_live_1', number: 99999 };
    latest.set(live);
    await waitFor(() => expect(store.result()!.items[0].id).toBe('ord_live_1'));
    expect(store.result()!.items).toHaveLength(20);
    expect(store.result()!.total).toBe(4801);
    expect(store.isFresh('ord_live_1')).toBe(true);
  });

  it('ignores live orders while filters are active', async () => {
    const store = TestBed.inject(OrdersStore);
    store.setStatus(['delivered']);
    await waitFor(() =>
      expect(store.result()!.items.every((o) => o.status === 'delivered')).toBe(true),
    );
    const live = { ...store.result()!.items[0], id: 'ord_live_2', status: 'new' as const };
    latest.set(live);
    await new Promise((r) => setTimeout(r, 20));
    expect(store.result()!.items.some((o) => o.id === 'ord_live_2')).toBe(false);
  });
});
