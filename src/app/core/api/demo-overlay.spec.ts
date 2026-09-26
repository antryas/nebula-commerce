import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, Paged, Product } from '../../models';
import { AuthService } from '../auth/auth.service';
import { ApiConfigService, BACKEND_STORAGE_KEY } from './api-config.service';
import { CustomerProfile } from './customers-api';
import { DemoApi } from './demo-api';
import { demoOverlayInterceptor } from './demo-overlay.interceptor';
import { OrdersApi } from './orders-api';
import { ProductsApi } from './products-api';
import {
  DEMO_OVERLAY_STORAGE_KEY,
  DemoOverlay,
  orderMatcher,
  overlayPage,
  productMatcher,
} from './demo-overlay';

function product(id: string, patch: Partial<Product> = {}): Product {
  return {
    id,
    sku: `SKU-${id}`,
    name: `Product ${id}`,
    description: '',
    category: 'Home',
    price: 10,
    compareAtPrice: null,
    imageUrl: '',
    stock: 20,
    sold: 3,
    rating: 4,
    variants: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    active: true,
    ...patch,
  };
}

function order(id: string, patch: Partial<Order> = {}): Order {
  return {
    id,
    number: 1000 + Number(id.replace(/\D/g, '') || 0),
    customerId: 'cus_1',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.test',
    customerAvatarUrl: '',
    items: [],
    subtotal: 10,
    shipping: 0,
    tax: 0,
    total: 10,
    status: 'new',
    paymentMethod: 'card',
    createdAt: '2026-01-01T00:00:00.000Z',
    shippingAddress: { line1: '', city: '', country: '', countryCode: '', postalCode: '' },
    history: [{ status: 'new', at: '2026-01-01T00:00:00.000Z' }],
    ...patch,
  };
}

function paged<T>(items: T[], total = items.length, page = 1): Paged<T> {
  return { items, total, page, pageSize: 20 };
}

const MODE_URL = `${environment.liveApiUrl}/demo/mode`;

function setup(opts: { live?: boolean } = {}) {
  if (opts.live ?? true) localStorage.setItem(BACKEND_STORAGE_KEY, 'live');
  const isAuthenticated = signal(true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated } },
    ],
  });
  const overlay = TestBed.inject(DemoOverlay);
  const http = TestBed.inject(HttpTestingController);
  TestBed.tick();
  return { overlay, http, isAuthenticated, config: TestBed.inject(ApiConfigService) };
}

const stored = () => sessionStorage.getItem(DEMO_OVERLAY_STORAGE_KEY);

describe('DemoOverlay', () => {
  beforeEach(() => sessionStorage.removeItem(DEMO_OVERLAY_STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_OVERLAY_STORAGE_KEY);
  });

  it('asks the live backend whether it is read-only', () => {
    const { overlay, http } = setup();
    http.expectOne(MODE_URL).flush({ readOnly: true });
    expect(overlay.readOnly()).toBe(true);
  });

  it('treats a backend without /demo/mode (404) as writable', () => {
    const { overlay, http } = setup();
    http.expectOne(MODE_URL).flush(null, { status: 404, statusText: 'Not Found' });
    expect(overlay.readOnly()).toBe(false);
  });

  it('never asks in mock mode', () => {
    const { overlay, http } = setup({ live: false });
    http.expectNone(MODE_URL);
    expect(overlay.readOnly()).toBe(false);
  });

  it('upserts, creates and deletes products', () => {
    const { overlay } = setup();
    overlay.rememberProducts([product('p1'), product('p2')]);

    overlay.saveProduct(product('p1', { name: 'Renamed' }));
    const created = overlay.saveProduct(product('p9'), { created: true });
    overlay.deleteProduct('p2');

    expect(overlay.applyProduct(product('p1')).name).toBe('Renamed');
    expect(overlay.localProduct(created.id)).toEqual(created);
    expect(overlay.isDeletedProduct('p2')).toBe(true);
    expect(overlay.state().products['p1'].before?.name).toBe('Product p1');
    expect(overlay.changeCount()).toBe(3);
  });

  it('gives each dry-run create its own id', () => {
    const { overlay } = setup();
    const a = overlay.saveProduct(product('prd_000061'), { created: true });
    const b = overlay.saveProduct(product('prd_000061'), { created: true });
    expect(a.id).toBe('prd_000061');
    expect(b.id).toBe('prd_000061_2');
  });

  it('forgets a created product when it is deleted', () => {
    const { overlay } = setup();
    const created = overlay.saveProduct(product('p9'), { created: true });
    overlay.deleteProduct(created.id);
    expect(overlay.changeCount()).toBe(0);
    expect(overlay.isDeletedProduct(created.id)).toBe(false);
  });

  it('rebuilds bulk status changes from known orders and skips closed ones', () => {
    const { overlay } = setup();
    overlay.rememberOrders([order('o1'), order('o2', { status: 'delivered' })]);
    overlay.bulkStatus(['o1', 'o2', 'unknown'], 'shipped');

    const o1 = overlay.applyOrder(order('o1'));
    expect(o1.status).toBe('shipped');
    expect(o1.history.at(-1)?.status).toBe('shipped');
    expect(overlay.applyOrder(order('o2', { status: 'delivered' })).status).toBe('delivered');
    expect(overlay.changeCount()).toBe(1);
  });

  it('persists to sessionStorage and restores it in a new instance', () => {
    const { overlay } = setup();
    overlay.saveOrder(order('o1', { status: 'packing' }));
    expect(JSON.parse(stored()!).orders.o1.value.status).toBe('packing');

    TestBed.resetTestingModule();
    const again = setup();
    expect(again.overlay.applyOrder(order('o1')).status).toBe('packing');
  });

  it('clears on sign-out', () => {
    const { overlay, isAuthenticated } = setup();
    overlay.saveOrder(order('o1', { status: 'packing' }));
    isAuthenticated.set(false);
    TestBed.tick();
    expect(overlay.changeCount()).toBe(0);
    expect(stored()).toBeNull();
  });

  it('clears on switching backend', () => {
    const { overlay, config } = setup();
    overlay.saveProduct(product('p1', { name: 'Renamed' }));
    config.setMode('mock');
    TestBed.tick();
    expect(overlay.changeCount()).toBe(0);
    expect(stored()).toBeNull();
  });

  it('clear() discards every change', () => {
    const { overlay } = setup();
    overlay.saveProduct(product('p1'));
    overlay.deleteProduct('p2');
    overlay.clear();
    expect(overlay.changeCount()).toBe(0);
    expect(stored()).toBeNull();
  });
});

describe('overlayPage', () => {
  const none = {};

  it('replaces changed items and drops deleted ones', () => {
    const page = paged([product('p1'), product('p2'), product('p3')], 30);
    const out = overlayPage(
      page,
      { p1: { value: product('p1', { price: 99 }), before: product('p1') } },
      { p2: product('p2') },
      () => true,
    );
    expect(out.items.map((p) => [p.id, p.price])).toEqual([
      ['p1', 99],
      ['p3', 10],
    ]);
    expect(out.total).toBe(29);
  });

  it('prepends created items on page 1 only', () => {
    const entries = { p9: { value: product('p9'), before: null, created: true as const } };
    expect(overlayPage(paged([product('p1')]), entries, none, () => true).items[0].id).toBe('p9');
    const page2 = overlayPage(paged([product('p1')], 30, 2), entries, none, () => true);
    expect(page2.items.map((p) => p.id)).toEqual(['p1']);
    expect(page2.total).toBe(31);
  });

  it('moves a changed order between status filters', () => {
    const moved = {
      o1: {
        value: order('o1', { status: 'delivered' }),
        before: order('o1', { status: 'shipped' }),
      },
    };
    const open = new URLSearchParams('status=new,packing,shipped');
    const delivered = new URLSearchParams('status=delivered');

    const openPage = overlayPage(
      paged([order('o1', { status: 'shipped' })]),
      moved,
      none,
      orderMatcher(open),
    );
    expect(openPage.items).toEqual([]);
    expect(openPage.total).toBe(0);

    const deliveredPage = overlayPage(
      paged([order('o2', { status: 'delivered' })]),
      moved,
      none,
      orderMatcher(delivered),
    );
    expect(deliveredPage.items.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(deliveredPage.total).toBe(2);
  });

  it('does not pull an unchanged-bucket item onto page 1', () => {
    const edited = { p5: { value: product('p5', { price: 12 }), before: product('p5') } };
    const out = overlayPage(paged([product('p1')], 30), edited, none, () => true);
    expect(out.items.map((p) => p.id)).toEqual(['p1']);
    expect(out.total).toBe(30);
  });
});

describe('matchers', () => {
  it('match products by category, stock and search', () => {
    const m = productMatcher(new URLSearchParams('category=Home&stock=low&search=lamp'));
    expect(m(product('p1', { name: 'Desk lamp', stock: 3 }))).toBe(true);
    expect(m(product('p1', { name: 'Desk lamp', stock: 30 }))).toBe(false);
    expect(m(product('p1', { name: 'Desk lamp', stock: 3, category: 'Beauty' }))).toBe(false);
    expect(m(product('p1', { name: 'Chair', stock: 3 }))).toBe(false);
  });

  it('match orders by status, date range and search', () => {
    const m = orderMatcher(
      new URLSearchParams(
        'status=packing&from=2025-12-31T00:00:00Z&to=2026-01-02T00:00:00Z&search=ada',
      ),
    );
    expect(m(order('o1', { status: 'packing' }))).toBe(true);
    expect(m(order('o1', { status: 'new' }))).toBe(false);
    expect(m(order('o1', { status: 'packing', createdAt: '2026-02-01T00:00:00Z' }))).toBe(false);
    expect(m(order('o1', { status: 'packing', customerName: 'Grace', customerEmail: 'g@x' }))).toBe(
      false,
    );
  });
});

describe('demoOverlayInterceptor', () => {
  const API = environment.liveApiUrl;
  const DRY_RUN = { headers: { 'X-Nebula-Dry-Run': 'true' } };

  function setupInterceptor(opts: { live?: boolean } = {}) {
    if (opts.live ?? true) localStorage.setItem(BACKEND_STORAGE_KEY, 'live');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([demoOverlayInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
        { provide: DemoApi, useValue: { mode: () => of({ readOnly: false }) } },
      ],
    });
    return {
      http: TestBed.inject(HttpClient),
      ctrl: TestBed.inject(HttpTestingController),
      products: TestBed.inject(ProductsApi),
      orders: TestBed.inject(OrdersApi),
      overlay: TestBed.inject(DemoOverlay),
    };
  }

  beforeEach(() => sessionStorage.removeItem(DEMO_OVERLAY_STORAGE_KEY));
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_OVERLAY_STORAGE_KEY);
  });

  /** Answers the one pending request for `url` with `body` and resolves with what the caller got. */
  function answer<T>(
    ctrl: HttpTestingController,
    pending: Promise<T>,
    url: string,
    body: unknown,
    init: { headers?: Record<string, string>; status?: number; statusText?: string } = {},
  ): Promise<T> {
    ctrl.expectOne((r) => r.urlWithParams === url).flush(body as never, init);
    return pending;
  }

  const listUrl = `${API}/products?page=1&pageSize=12`;
  const listProducts = (products: ProductsApi) =>
    firstValueFrom(products.list({ page: 1, pageSize: 12 }));

  it('keeps a dry-run product update and shows it in the list and the detail', async () => {
    const { ctrl, products, overlay } = setupInterceptor();
    await answer(ctrl, listProducts(products), listUrl, paged([product('p1'), product('p2')]));
    const saved = product('p1', { name: 'Renamed', price: 42 });
    const res = await answer(
      ctrl,
      firstValueFrom(products.update('p1', saved)),
      `${API}/products/p1`,
      saved,
      DRY_RUN,
    );
    expect(res.name).toBe('Renamed');
    expect(overlay.readOnly()).toBe(true);

    const list = await answer(
      ctrl,
      listProducts(products),
      listUrl,
      paged([product('p1'), product('p2')]),
    );
    expect(list.items.map((p) => p.name)).toEqual(['Renamed', 'Product p2']);

    const detail = await answer(
      ctrl,
      firstValueFrom(products.get('p1')),
      `${API}/products/p1`,
      product('p1'),
    );
    expect(detail.price).toBe(42);
  });

  it('ignores writes without the dry-run header', async () => {
    const { ctrl, products, overlay } = setupInterceptor();
    const saved = product('p1', { name: 'Saved for real' });
    await answer(ctrl, firstValueFrom(products.update('p1', saved)), `${API}/products/p1`, saved);
    expect(overlay.changeCount()).toBe(0);
    expect(overlay.readOnly()).toBe(false);
  });

  it('never records reads, even with the header', async () => {
    const { ctrl, products, overlay } = setupInterceptor();
    await answer(
      ctrl,
      firstValueFrom(products.get('p1')),
      `${API}/products/p1`,
      product('p1'),
      DRY_RUN,
    );
    expect(overlay.changeCount()).toBe(0);
    expect(overlay.readOnly()).toBe(false);
  });

  it('leaves mock mode alone', async () => {
    const { http, ctrl, overlay } = setupInterceptor({ live: false });
    const res = await answer(
      ctrl,
      firstValueFrom(http.put<Product>('/api/products/p1', product('p1'))),
      '/api/products/p1',
      product('p1', { name: 'x' }),
      DRY_RUN,
    );
    expect(res.name).toBe('x');
    expect(overlay.changeCount()).toBe(0);
  });

  it('removes a deleted product from lists and 404s its detail', async () => {
    const { ctrl, products } = setupInterceptor();
    await answer(ctrl, firstValueFrom(products.remove('p2')), `${API}/products/p2`, null, {
      ...DRY_RUN,
      status: 204,
      statusText: 'No Content',
    });
    const list = await answer(
      ctrl,
      listProducts(products),
      listUrl,
      paged([product('p1'), product('p2')]),
    );
    expect(list.items.map((p) => p.id)).toEqual(['p1']);
    await expect(firstValueFrom(products.get('p2'))).rejects.toMatchObject({ status: 404 });
  });

  it('shows a created product first and serves it locally', async () => {
    const { ctrl, products } = setupInterceptor();
    const input = product('prd_000061', { name: 'New lamp' });
    const created = await answer(
      ctrl,
      firstValueFrom(products.create(input)),
      `${API}/products`,
      input,
      DRY_RUN,
    );

    const list = await answer(ctrl, listProducts(products), listUrl, paged([product('p1')], 60));
    expect(list.items.map((p) => p.name)).toEqual(['New lamp', 'Product p1']);
    expect(list.total).toBe(61);

    // Its detail and delete are answered locally; an edit is validated as a create.
    expect((await firstValueFrom(products.get(created.id))).name).toBe('New lamp');
    const edit = firstValueFrom(products.update(created.id, { ...input, name: 'Lamp v2' }));
    const req = ctrl.expectOne(`${API}/products`);
    expect(req.request.method).toBe('POST');
    req.flush(product('prd_000061', { name: 'Lamp v2' }), DRY_RUN);
    expect((await edit).id).toBe(created.id);
    expect((await firstValueFrom(products.get(created.id))).name).toBe('Lamp v2');

    await firstValueFrom(products.remove(created.id));
    const gone = await answer(ctrl, listProducts(products), listUrl, paged([product('p1')], 60));
    expect(gone.items.map((p) => p.id)).toEqual(['p1']);
  });

  it('keeps an order status change on the fulfillment board and in the detail', async () => {
    const { ctrl, orders } = setupInterceptor();
    const shipped = order('o1', { status: 'shipped' });
    const openUrl = `${API}/orders?status=new,packing,shipped&page=1&pageSize=100`;
    const doneUrl = `${API}/orders?status=delivered&page=1&pageSize=20&sort=createdAt&dir=desc`;
    const open = () =>
      firstValueFrom(
        orders.list({ status: ['new', 'packing', 'shipped'], page: 1, pageSize: 100 }),
      );
    const done = () =>
      firstValueFrom(
        orders.list({
          status: ['delivered'],
          page: 1,
          pageSize: 20,
          sort: 'createdAt',
          dir: 'desc',
        }),
      );

    await answer(ctrl, open(), openUrl, paged([shipped]));
    const moved = order('o1', {
      status: 'delivered',
      history: [...shipped.history, { status: 'delivered', at: '2026-01-02T00:00:00.000Z' }],
    });
    await answer(
      ctrl,
      firstValueFrom(orders.updateStatus('o1', 'delivered')),
      `${API}/orders/o1/status`,
      moved,
      DRY_RUN,
    );

    expect((await answer(ctrl, open(), openUrl, paged([shipped]))).items).toEqual([]);
    const delivered = await answer(
      ctrl,
      done(),
      doneUrl,
      paged([order('o2', { status: 'delivered' })]),
    );
    expect(delivered.items.map((o) => o.id)).toEqual(['o1', 'o2']);

    const detail = await answer(
      ctrl,
      firstValueFrom(orders.get('o1')),
      `${API}/orders/o1`,
      shipped,
    );
    expect(detail.status).toBe('delivered');
  });

  it('applies a dry-run bulk update to the orders it has seen', async () => {
    const { ctrl, orders } = setupInterceptor();
    const url = `${API}/orders?page=1&pageSize=20`;
    const list = () => firstValueFrom(orders.list({ page: 1, pageSize: 20 }));
    const page = paged([order('o1'), order('o2'), order('o3', { status: 'cancelled' })]);
    await answer(ctrl, list(), url, page);
    await answer(
      ctrl,
      firstValueFrom(orders.bulkStatus(['o1', 'o3'], 'packing')),
      `${API}/orders/bulk-status`,
      { updated: 1 },
      DRY_RUN,
    );
    const after = await answer(ctrl, list(), url, page);
    expect(after.items.map((o) => o.status)).toEqual(['packing', 'new', 'cancelled']);
  });

  it("patches the orders in a customer's profile", async () => {
    const { ctrl, http, orders } = setupInterceptor();
    await answer(
      ctrl,
      firstValueFrom(orders.updateStatus('o1', 'packing')),
      `${API}/orders/o1/status`,
      order('o1', { status: 'packing' }),
      DRY_RUN,
    );
    const profile = await answer(
      ctrl,
      firstValueFrom(http.get<CustomerProfile>(`${API}/customers/cus_1`)),
      `${API}/customers/cus_1`,
      { customer: {}, orders: [order('o1'), order('o2')] },
    );
    expect(profile.orders.map((o) => o.status)).toEqual(['packing', 'new']);
  });

  it('a dry-run demo reset discards the changes', async () => {
    const { ctrl, http, overlay } = setupInterceptor();
    overlay.saveOrder(order('o1', { status: 'packing' }));
    await answer(
      ctrl,
      firstValueFrom(http.post(`${API}/demo/reset`, null)),
      `${API}/demo/reset`,
      null,
      { ...DRY_RUN, status: 204, statusText: 'No Content' },
    );
    expect(overlay.changeCount()).toBe(0);
  });
});
