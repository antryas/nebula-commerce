import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
import { mockDb } from '../db';
import { Customer, Order, Paged } from '../../models';

describe('customers mock API', () => {
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

  it('lists customers with paging', async () => {
    const r = await firstValueFrom(http.get<Paged<Customer>>('/api/customers?page=2&pageSize=50'));
    expect(r).toMatchObject({ total: 700, page: 2, pageSize: 50 });
    expect(r.items).toHaveLength(50);
  });

  it('searches by country', async () => {
    const r = await firstValueFrom(
      http.get<Paged<Customer>>('/api/customers?pageSize=100&search=germany'),
    );
    const expected = mockDb.data.customers.filter((c) => c.country === 'Germany').length;
    expect(expected).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThanOrEqual(expected);
    expect(r.items.some((c) => c.country === 'Germany')).toBe(true);
  });

  it('sorts by lifetime value', async () => {
    const r = await firstValueFrom(
      http.get<Paged<Customer>>('/api/customers?pageSize=10&sort=lifetimeValue&dir=desc'),
    );
    const max = Math.max(...mockDb.data.customers.map((c) => c.lifetimeValue));
    expect(r.items[0].lifetimeValue).toBe(max);
  });

  it('returns a profile with orders sorted newest first', async () => {
    const customer = [...mockDb.data.customers].sort((a, b) => b.ordersCount - a.ordersCount)[0];
    const r = await firstValueFrom(
      http.get<{ customer: Customer; orders: Order[] }>(`/api/customers/${customer.id}`),
    );
    expect(r.customer.id).toBe(customer.id);
    expect(r.orders.length).toBeGreaterThan(1);
    expect(r.orders.every((o) => o.customerId === customer.id)).toBe(true);
    for (let i = 1; i < r.orders.length; i++) {
      expect(r.orders[i - 1].createdAt >= r.orders[i].createdAt).toBe(true);
    }
  });

  it('returns 404 for unknown customer', async () => {
    await expect(firstValueFrom(http.get('/api/customers/nope'))).rejects.toMatchObject({
      status: 404,
    });
  });
});
