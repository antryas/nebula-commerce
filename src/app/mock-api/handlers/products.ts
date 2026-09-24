import { Product, ProductCategory, ProductVariant } from '../../models';
import { mockDb } from '../db';
import { applyListQuery, parseListQuery } from '../query';
import { MockRouter, bodyOf, fail, notFound, ok } from '../router';
import { MOCK_NOW, round2 } from '../seed';

const CATEGORIES: readonly ProductCategory[] = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Electronics',
  'Home',
  'Beauty',
];
const LOW_STOCK_MAX = 10;

export function registerProductRoutes(r: MockRouter): void {
  r.add('GET', '/api/products', (req) => {
    const q = parseListQuery(req.query);
    const categories = (req.query.get('category') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const stock = req.query.get('stock') ?? 'all';

    const rows = mockDb.data.products.filter(
      (p) =>
        (!categories.length || categories.includes(p.category)) && matchesStock(p.stock, stock),
    );
    return ok(applyListQuery(rows, q, { searchFields: ['name', 'sku'] }));
  });

  r.add('GET', '/api/products/:id', (req) => {
    const product = findProduct(req.params['id']);
    return product ? ok(product) : notFound('Product');
  });

  r.add('POST', '/api/products', (req) => {
    const input = bodyOf(req);
    const errors = validate(input, null);
    if (errors) return fail(422, 'validation', 'Product is invalid', errors);

    const now = new Date(Math.max(Date.now(), MOCK_NOW.getTime())).toISOString();
    const id = nextProductId();
    const product = buildProduct(input, {
      id,
      sold: 0,
      rating: 0,
      createdAt: now,
      imageUrl: `https://picsum.photos/seed/nebula-${id}/400/400`,
    });
    mockDb.data.products.unshift(product);
    return ok(product, 201);
  });

  r.add('PUT', '/api/products/:id', (req) => {
    const existing = findProduct(req.params['id']);
    if (!existing) return notFound('Product');
    const input = bodyOf(req);
    const errors = validate(input, existing.id);
    if (errors) return fail(422, 'validation', 'Product is invalid', errors);

    const updated = buildProduct(input, existing);
    const index = mockDb.data.products.indexOf(existing);
    mockDb.data.products[index] = updated;
    return ok(updated);
  });

  r.add('DELETE', '/api/products/:id', (req) => {
    const index = mockDb.data.products.findIndex((p) => p.id === req.params['id']);
    if (index === -1) return notFound('Product');
    mockDb.data.products.splice(index, 1);
    return ok(null, 204);
  });
}

function matchesStock(stock: number, filter: string): boolean {
  switch (filter) {
    case 'in':
      return stock > LOW_STOCK_MAX;
    case 'low':
      return stock >= 1 && stock <= LOW_STOCK_MAX;
    case 'out':
      return stock === 0;
    default:
      return true;
  }
}

function validate(
  input: Record<string, unknown>,
  selfId: string | null,
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const { name, price, sku, category, compareAtPrice } = input;

  if (typeof name !== 'string' || !name.trim()) errors['name'] = 'Name is required';
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    errors['price'] = 'Price must be greater than 0';
  }
  if (typeof sku !== 'string' || !sku.trim()) {
    errors['sku'] = 'SKU is required';
  } else {
    const normalized = sku.trim().toLowerCase();
    const taken = mockDb.data.products.some(
      (p) => p.id !== selfId && p.sku.toLowerCase() === normalized,
    );
    if (taken) errors['sku'] = 'SKU is already in use';
  }
  if (!CATEGORIES.includes(category as ProductCategory)) errors['category'] = 'Unknown category';
  if (
    compareAtPrice !== undefined &&
    compareAtPrice !== null &&
    (typeof compareAtPrice !== 'number' || (typeof price === 'number' && compareAtPrice <= price))
  ) {
    errors['compareAtPrice'] = 'Compare-at price must be greater than price';
  }
  return Object.keys(errors).length ? errors : null;
}

type ServerFields = Pick<Product, 'id' | 'sold' | 'rating' | 'createdAt' | 'imageUrl'>;

/** Merges validated client input with server-owned fields. Stock is derived from variants. */
function buildProduct(input: Record<string, unknown>, base: ServerFields): Product {
  const variants = Array.isArray(input['variants'])
    ? (input['variants'] as Partial<ProductVariant>[]).map((v, i) => ({
        id: v.id || `${base.id}_v${i + 1}`,
        size: String(v.size ?? ''),
        color: String(v.color ?? ''),
        stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
      }))
    : [];
  const stock = variants.length
    ? variants.reduce((s, v) => s + v.stock, 0)
    : Math.max(0, Math.floor(Number(input['stock']) || 0));
  const compareAtPrice = input['compareAtPrice'];

  return {
    id: base.id,
    sku: String(input['sku']).trim(),
    name: String(input['name']).trim(),
    description: typeof input['description'] === 'string' ? input['description'] : '',
    category: input['category'] as ProductCategory,
    price: round2(Number(input['price'])),
    compareAtPrice: typeof compareAtPrice === 'number' ? round2(compareAtPrice) : null,
    imageUrl:
      typeof input['imageUrl'] === 'string' && input['imageUrl']
        ? input['imageUrl']
        : base.imageUrl,
    stock,
    sold: base.sold,
    rating: base.rating,
    variants,
    createdAt: base.createdAt,
    active: input['active'] !== false,
  };
}

function nextProductId(): string {
  const max = mockDb.data.products.reduce((m, p) => {
    const n = Number.parseInt(p.id.replace(/^prd_/, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `prd_${String(max + 1).padStart(6, '0')}`;
}

function findProduct(id: string | undefined): Product | undefined {
  return mockDb.data.products.find((p) => p.id === id);
}
