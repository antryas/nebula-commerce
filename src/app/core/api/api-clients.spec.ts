import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { AnalyticsApi } from './analytics-api';
import { AuthApi } from './auth-api';
import { CustomersApi } from './customers-api';
import { LiveApi } from './live-api';
import { OrdersApi } from './orders-api';
import { ProductInput, ProductsApi } from './products-api';

describe('API clients', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('OrdersApi builds list, get, status and bulk requests', () => {
    const api = TestBed.inject(OrdersApi);
    api
      .list({ page: 1, pageSize: 10, status: ['new', 'packing'], search: '', from: '2026-01-01' })
      .subscribe();
    ctrl
      .expectOne(
        (r) =>
          r.method === 'GET' &&
          r.urlWithParams === '/api/orders?page=1&pageSize=10&status=new,packing&from=2026-01-01',
      )
      .flush({ items: [], total: 0, page: 1, pageSize: 10 });

    api.get('ord_1').subscribe();
    ctrl.expectOne({ method: 'GET', url: '/api/orders/ord_1' }).flush({});

    api.updateStatus('ord_1', 'shipped').subscribe();
    const patch = ctrl.expectOne({ method: 'PATCH', url: '/api/orders/ord_1/status' });
    expect(patch.request.body).toEqual({ status: 'shipped' });
    patch.flush({});

    api.bulkStatus(['a', 'b'], 'cancelled').subscribe();
    const bulk = ctrl.expectOne({ method: 'POST', url: '/api/orders/bulk-status' });
    expect(bulk.request.body).toEqual({ ids: ['a', 'b'], status: 'cancelled' });
    bulk.flush({ updated: 2 });
  });

  it('ProductsApi covers CRUD', () => {
    const api = TestBed.inject(ProductsApi);
    const input = { name: 'Tee', price: 10 } as ProductInput;

    api.list({ page: 1, pageSize: 20, category: 'Home', stock: 'low' }).subscribe();
    ctrl
      .expectOne('/api/products?page=1&pageSize=20&category=Home&stock=low')
      .flush({ items: [], total: 0, page: 1, pageSize: 20 });

    api.get('prd_1').subscribe();
    ctrl.expectOne({ method: 'GET', url: '/api/products/prd_1' }).flush({});

    api.create(input).subscribe();
    const post = ctrl.expectOne({ method: 'POST', url: '/api/products' });
    expect(post.request.body).toEqual(input);
    post.flush({});

    api.update('prd_1', input).subscribe();
    ctrl.expectOne({ method: 'PUT', url: '/api/products/prd_1' }).flush({});

    api.remove('prd_1').subscribe();
    ctrl.expectOne({ method: 'DELETE', url: '/api/products/prd_1' }).flush(null);
  });

  it('CustomersApi lists and gets a profile', () => {
    const api = TestBed.inject(CustomersApi);
    api.list({ page: 3, pageSize: 25, sort: 'name', dir: 'asc' }).subscribe();
    ctrl.expectOne('/api/customers?page=3&pageSize=25&sort=name&dir=asc').flush({});
    api.get('cus_1').subscribe();
    ctrl.expectOne('/api/customers/cus_1').flush({ customer: {}, orders: [] });
  });

  it('AnalyticsApi passes range (and limit for top products)', () => {
    const api = TestBed.inject(AnalyticsApi);
    const endpoints = ['overview', 'revenue', 'categories', 'heatmap', 'geo', 'funnel'] as const;
    for (const e of endpoints) {
      (api[e]('7d') as Observable<unknown>).subscribe();
      ctrl.expectOne(`/api/analytics/${e}?range=7d`).flush([]);
    }
    api.topProducts('30d').subscribe();
    ctrl.expectOne('/api/analytics/top-products?range=30d&limit=5').flush([]);
    api.topProducts('12m', 3).subscribe();
    ctrl.expectOne('/api/analytics/top-products?range=12m&limit=3').flush([]);
  });

  it('AuthApi and LiveApi post to their endpoints', async () => {
    const login = firstValueFrom(TestBed.inject(AuthApi).login('a@b.c', 'secret1'));
    const req = ctrl.expectOne({ method: 'POST', url: '/api/auth/login' });
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'secret1' });
    req.flush({ token: 't', user: { id: 'usr_1' } });
    expect(await login).toMatchObject({ token: 't' });

    TestBed.inject(LiveApi).tick().subscribe();
    ctrl
      .expectOne({ method: 'POST', url: '/api/live/tick' })
      .flush({}, { status: 201, statusText: 'Created' });
  });
});
