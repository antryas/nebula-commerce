import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { mockDb } from '../../mock-api/db';
import { ToastService } from '../../core/notifications/toast.service';
import { PRODUCTS_VIEW_KEY, ProductsStore } from './products.store';

/** jsdom rendering is slow when the whole suite runs in parallel. */
const WAIT = { timeout: 5000 };
const SLOW = 15000;

function setup(): ProductsStore {
  TestBed.configureTestingModule({
    providers: [
      ProductsStore,
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  return TestBed.inject(ProductsStore);
}

describe('ProductsStore', () => {
  beforeEach(() => {
    mockDb.reset();
    localStorage.removeItem(PRODUCTS_VIEW_KEY);
  });

  it(
    'loads the first page on init',
    async () => {
      const store = setup();
      await vi.waitFor(() => expect(store.result()?.items.length).toBe(12), WAIT);
      expect(store.result()?.total).toBe(mockDb.data.products.length);
      expect(store.loading()).toBe(false);
    },
    SLOW,
  );

  it(
    "filters stock 'out' to sold-out products only",
    async () => {
      const store = setup();
      store.setPage(3, 12);
      store.setStock('out');
      await vi.waitFor(() => expect(store.query().page).toBe(1), WAIT);
      await vi.waitFor(() => {
        const items = store.result()!.items;
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((p) => p.stock === 0)).toBe(true);
      }, WAIT);
    },
    SLOW,
  );

  it(
    'filters by category',
    async () => {
      const store = setup();
      store.setCategory('Footwear');
      await vi.waitFor(
        () => expect(store.result()!.items.every((p) => p.category === 'Footwear')).toBe(true),
        WAIT,
      );
    },
    SLOW,
  );

  it(
    'removes a product, toasts and reloads',
    async () => {
      const store = setup();
      const toast = TestBed.inject(ToastService);
      await vi.waitFor(() => expect(store.result()?.items.length).toBe(12), WAIT);
      const total = store.result()!.total;
      const id = store.result()!.items[0].id;

      await store.remove(id);

      expect(mockDb.data.products.some((p) => p.id === id)).toBe(false);
      expect(toast.toasts().some((t) => t.title === 'Product deleted')).toBe(true);
      await vi.waitFor(() => expect(store.result()!.total).toBe(total - 1), WAIT);
      expect(store.result()!.items.some((p) => p.id === id)).toBe(false);
    },
    SLOW,
  );

  it(
    'persists the view mode in localStorage (grid by default)',
    async () => {
      const store = setup();
      expect(store.view()).toBe('grid');
      store.view.set('table');
      await vi.waitFor(() => expect(localStorage.getItem(PRODUCTS_VIEW_KEY)).toBe('table'), WAIT);
    },
    SLOW,
  );

  it(
    'toggles active status through the API',
    async () => {
      const store = setup();
      await vi.waitFor(() => expect(store.result()?.items.length).toBe(12), WAIT);
      const product = store.result()!.items[0];
      await store.setActive(product, !product.active);
      expect(mockDb.data.products.find((p) => p.id === product.id)!.active).toBe(!product.active);
      expect(store.result()!.items[0].active).toBe(!product.active);
    },
    SLOW,
  );
});
