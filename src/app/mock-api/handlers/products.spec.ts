import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
import { mockDb } from '../db';
import { Paged, Product } from '../../models';

function draft(overrides: Partial<Product> = {}): Partial<Product> {
  return {
    sku: 'NEW-SKU-001',
    name: 'Nova Test Jacket',
    description: 'Test product',
    category: 'Apparel',
    price: 99.99,
    compareAtPrice: null,
    imageUrl: 'https://picsum.photos/seed/test/400/400',
    variants: [{ id: 'v1', size: 'M', color: 'Black', stock: 5 }],
    active: true,
    ...overrides,
  };
}

describe('products mock API', () => {
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

  it('lists products with paging', async () => {
    const r = await firstValueFrom(http.get<Paged<Product>>('/api/products?page=1&pageSize=12'));
    expect(r.items).toHaveLength(12);
    expect(r.total).toBe(60);
  });

  it('filters by category and low stock', async () => {
    const r = await firstValueFrom(
      http.get<Paged<Product>>('/api/products?pageSize=100&category=Apparel&stock=low'),
    );
    const expected = mockDb.data.products.filter(
      (p) => p.category === 'Apparel' && p.stock >= 1 && p.stock <= 10,
    );
    expect(r.total).toBe(expected.length);
    expect(r.items.every((p) => p.category === 'Apparel' && p.stock >= 1 && p.stock <= 10)).toBe(
      true,
    );
  });

  it('filters out-of-stock and in-stock products', async () => {
    const out = await firstValueFrom(
      http.get<Paged<Product>>('/api/products?pageSize=100&stock=out'),
    );
    expect(out.total).toBeGreaterThan(0);
    expect(out.items.every((p) => p.stock === 0)).toBe(true);
    const inStock = await firstValueFrom(
      http.get<Paged<Product>>('/api/products?pageSize=100&stock=in'),
    );
    expect(inStock.items.every((p) => p.stock > 10)).toBe(true);
  });

  it('searches by sku', async () => {
    const target = mockDb.data.products[7];
    const r = await firstValueFrom(
      http.get<Paged<Product>>(`/api/products?search=${target.sku.toLowerCase()}`),
    );
    expect(r.items.map((p) => p.id)).toContain(target.id);
  });

  it('creates a product with a new id', async () => {
    const created = await firstValueFrom(http.post<Product>('/api/products', draft()));
    expect(created.id).toMatch(/^prd_\d{6}$/);
    expect(created.stock).toBe(5);
    expect(created.sold).toBe(0);
    const fetched = await firstValueFrom(http.get<Product>(`/api/products/${created.id}`));
    expect(fetched.name).toBe('Nova Test Jacket');
  });

  it('rejects duplicate SKU with field details', async () => {
    const existing = mockDb.data.products[0];
    await expect(
      firstValueFrom(http.post('/api/products', draft({ sku: existing.sku }))),
    ).rejects.toMatchObject({
      status: 422,
      error: { code: 'validation', details: { sku: expect.any(String) } },
    });
  });

  it('validates name and price', async () => {
    await expect(
      firstValueFrom(http.post('/api/products', draft({ name: '  ', price: 0 }))),
    ).rejects.toMatchObject({
      status: 422,
      error: { details: { name: expect.any(String), price: expect.any(String) } },
    });
  });

  it('updates a product', async () => {
    const target = mockDb.data.products[3];
    const updated = await firstValueFrom(
      http.put<Product>(`/api/products/${target.id}`, { ...target, name: 'Renamed', price: 42 }),
    );
    expect(updated).toMatchObject({ id: target.id, name: 'Renamed', price: 42 });
    expect(mockDb.data.products[3].name).toBe('Renamed');
  });

  it('allows an update that keeps its own SKU', async () => {
    const target = mockDb.data.products[4];
    const updated = await firstValueFrom(
      http.put<Product>(`/api/products/${target.id}`, { ...target, sku: target.sku }),
    );
    expect(updated.sku).toBe(target.sku);
  });

  it('deletes a product, then GET returns 404', async () => {
    const target = mockDb.data.products[2];
    await firstValueFrom(http.delete(`/api/products/${target.id}`));
    await expect(firstValueFrom(http.get(`/api/products/${target.id}`))).rejects.toMatchObject({
      status: 404,
    });
    expect(mockDb.data.products).toHaveLength(59);
  });
});
