import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
import { mockDb } from '../db';
import { Order, Paged } from '../../models';

describe('orders mock API', () => {
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

  it('lists orders newest first with paging', async () => {
    const r = await firstValueFrom(
      http.get<Paged<Order>>('/api/orders?page=1&pageSize=20&sort=createdAt'),
    );
    expect(r.items).toHaveLength(20);
    expect(r.total).toBe(4800);
    expect(Date.parse(r.items[0].createdAt)).toBeGreaterThanOrEqual(
      Date.parse(r.items[1].createdAt),
    );
  });

  it('filters by status list', async () => {
    const r = await firstValueFrom(
      http.get<Paged<Order>>('/api/orders?page=1&pageSize=100&status=new,packing'),
    );
    expect(r.total).toBeGreaterThan(0);
    expect(r.items.every((o) => o.status === 'new' || o.status === 'packing')).toBe(true);
  });

  it('filters by date range', async () => {
    const from = '2026-09-01T00:00:00.000Z';
    const to = '2026-09-10T00:00:00.000Z';
    const r = await firstValueFrom(
      http.get<Paged<Order>>('/api/orders', { params: { page: 1, pageSize: 100, from, to } }),
    );
    expect(r.total).toBeGreaterThan(0);
    for (const o of r.items) {
      expect(o.createdAt >= from && o.createdAt <= to).toBe(true);
    }
  });

  it('searches by order number', async () => {
    const r = await firstValueFrom(http.get<Paged<Order>>('/api/orders?search=1042'));
    expect(r.items.map((o) => o.number)).toContain(1042);
  });

  it('gets a single order as a copy of the stored one', async () => {
    const target = mockDb.data.orders.find((x) => x.status !== 'cancelled')!;
    const o = await firstValueFrom(http.get<Order>(`/api/orders/${target.id}`));
    expect(o).toEqual(target);
    o.status = 'cancelled';
    expect(target.status).not.toBe('cancelled');
  });

  it('updates status and appends history', async () => {
    const target = mockDb.data.orders.find((o) => o.status === 'new')!;
    const updated = await firstValueFrom(
      http.patch<Order>(`/api/orders/${target.id}/status`, { status: 'packing' }),
    );
    expect(updated.status).toBe('packing');
    expect(updated.history.at(-1)?.status).toBe('packing');
    expect(mockDb.data.orders.find((o) => o.id === target.id)?.status).toBe('packing');
  });

  it('rejects transition from delivered', async () => {
    const target = mockDb.data.orders.find((o) => o.status === 'delivered')!;
    await expect(
      firstValueFrom(http.patch(`/api/orders/${target.id}/status`, { status: 'new' })),
    ).rejects.toMatchObject({ status: 422, error: { code: 'invalid_transition' } });
  });

  it('rejects unknown statuses', async () => {
    const target = mockDb.data.orders.find((o) => o.status === 'new')!;
    await expect(
      firstValueFrom(http.patch(`/api/orders/${target.id}/status`, { status: 'lost' })),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('updates customer aggregates when an order is cancelled', async () => {
    const target = mockDb.data.orders.find((o) => o.status === 'new')!;
    const before = mockDb.data.customers.find((c) => c.id === target.customerId)!.ordersCount;
    await firstValueFrom(
      http.patch<Order>(`/api/orders/${target.id}/status`, { status: 'cancelled' }),
    );
    const after = mockDb.data.customers.find((c) => c.id === target.customerId)!.ordersCount;
    expect(after).toBe(before - 1);
  });

  it('bulk-updates statuses, skipping closed orders', async () => {
    const open = mockDb.data.orders.filter((o) => o.status === 'new').slice(0, 3);
    const closed = mockDb.data.orders.find((o) => o.status === 'delivered')!;
    const r = await firstValueFrom(
      http.post<{ updated: number }>('/api/orders/bulk-status', {
        ids: [...open.map((o) => o.id), closed.id],
        status: 'packing',
      }),
    );
    expect(r.updated).toBe(3);
    const statuses = open.map((o) => mockDb.data.orders.find((x) => x.id === o.id)?.status);
    expect(statuses).toEqual(['packing', 'packing', 'packing']);
    expect(closed.status).toBe('delivered');
  });

  it('returns 404 for unknown order', async () => {
    await expect(firstValueFrom(http.get('/api/orders/nope'))).rejects.toMatchObject({
      status: 404,
      error: { code: 'not_found' },
    });
  });

  it('returns 404 for unknown routes', async () => {
    await expect(firstValueFrom(http.get('/api/unknown'))).rejects.toMatchObject({ status: 404 });
  });
});
