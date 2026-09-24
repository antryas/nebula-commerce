import { Faker, en } from '@faker-js/faker';
import {
  Address,
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductCategory,
  ProductVariant,
  StatusChange,
  User,
} from '../models';

export interface MockData {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  user: User;
}

/** Fixed "current time" of the demo so data and screenshots are reproducible. */
export const MOCK_NOW = new Date('2026-09-24T12:00:00Z');

const PRODUCT_COUNT = 60;
const CUSTOMER_COUNT = 180;
const ORDER_COUNT = 1200;
const HISTORY_DAYS = 395; // ~13 months
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

interface CategorySpec {
  code: string;
  nouns: string[];
  price: [number, number];
  sizes: string[];
  colors: string[];
  blurb: string[];
}

const BRANDS = [
  'Aurora',
  'Orbit',
  'Nova',
  'Lumen',
  'Zenith',
  'Stellar',
  'Comet',
  'Halo',
  'Eclipse',
  'Vega',
  'Solstice',
  'Drift',
  'Atlas',
  'Cascade',
  'Ember',
  'Polaris',
];

const CATEGORIES: Record<ProductCategory, CategorySpec> = {
  Apparel: {
    code: 'APP',
    nouns: [
      'Linen Shirt',
      'Merino Sweater',
      'Denim Jacket',
      'Organic Cotton Tee',
      'Slim Chino Pants',
      'Fleece Hoodie',
      'Puffer Vest',
      'Oxford Shirt',
      'Knit Cardigan',
      'Rain Shell Jacket',
    ],
    price: [29, 149],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Black', 'Navy', 'Sand', 'Olive', 'White', 'Charcoal'],
    blurb: [
      'Relaxed fit with breathable, garment-washed fabric.',
      'Tailored silhouette made from responsibly sourced fibres.',
      'Everyday essential that softens with every wash.',
    ],
  },
  Footwear: {
    code: 'FTW',
    nouns: [
      'Runner Sneakers',
      'Leather Chelsea Boots',
      'Canvas Low-Tops',
      'Trail Running Shoes',
      'Suede Loafers',
      'Recovery Slides',
      'High-Top Sneakers',
      'Hiking Boots',
      'Knit Trainers',
      'Court Sneakers',
    ],
    price: [59, 219],
    sizes: ['38', '39', '40', '41', '42', '43', '44', '45'],
    colors: ['Black', 'White', 'Grey', 'Tan', 'Navy'],
    blurb: [
      'Cushioned midsole and a grippy rubber outsole.',
      'Premium upper with a supportive, all-day footbed.',
      'Lightweight build designed for city miles.',
    ],
  },
  Accessories: {
    code: 'ACC',
    nouns: [
      'Leather Wallet',
      'Canvas Backpack',
      'Wool Beanie',
      'Polarized Sunglasses',
      'Crossbody Bag',
      'Silk Scarf',
      'Minimalist Watch',
      'Leather Belt',
      'Weekender Duffel',
      'Card Holder',
    ],
    price: [19, 189],
    sizes: ['One Size'],
    colors: ['Black', 'Cognac', 'Forest', 'Stone', 'Burgundy'],
    blurb: [
      'Crafted from full-grain materials built to age well.',
      'Clean lines and thoughtful pockets for daily carry.',
      'Finished with brushed metal hardware.',
    ],
  },
  Electronics: {
    code: 'ELC',
    nouns: [
      'Wireless Earbuds',
      'Smart Watch',
      'Bluetooth Speaker',
      'Noise-Cancelling Headphones',
      'Power Bank 20000',
      'Mechanical Keyboard',
      'Wireless Charger',
      'Action Camera',
      'Smart Desk Lamp',
      'Fitness Tracker',
    ],
    price: [29, 399],
    sizes: ['Standard'],
    colors: ['Midnight', 'Silver', 'Space Grey', 'Arctic White', 'Cobalt'],
    blurb: [
      'All-day battery life with fast USB-C charging.',
      'Seamless pairing and a companion app for fine-tuning.',
      'Precision-engineered with premium, low-latency components.',
    ],
  },
  Home: {
    code: 'HOM',
    nouns: [
      'Ceramic Vase',
      'Soy Scented Candle',
      'Linen Throw Blanket',
      'Oak Desk Organizer',
      'Pour-Over Coffee Set',
      'Wool Area Rug',
      'Stoneware Mug Set',
      'Cotton Towel Set',
      'Glass Carafe',
      'Walnut Serving Board',
    ],
    price: [15, 179],
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Ivory', 'Terracotta', 'Sage', 'Slate', 'Oat'],
    blurb: [
      'Handmade in small batches with natural materials.',
      'A calm, minimal piece that works in any room.',
      'Designed to be used every day and loved for years.',
    ],
  },
  Beauty: {
    code: 'BTY',
    nouns: [
      'Hydrating Serum',
      'Daily Face Cream',
      'Lip Balm Trio',
      'Eau de Parfum',
      'Clay Detox Mask',
      'Body Lotion',
      'Vitamin C Serum',
      'Nourishing Hair Oil',
      'Gentle Cleanser',
      'SPF 50 Sunscreen',
    ],
    price: [12, 89],
    sizes: ['30 ml', '50 ml', '100 ml'],
    colors: ['Unscented', 'Citrus', 'Lavender', 'Rose'],
    blurb: [
      'Dermatologist-tested, vegan and cruelty-free formula.',
      'Lightweight texture that absorbs in seconds.',
      'Packed with botanicals for a healthy, lasting glow.',
    ],
  },
};

interface CountrySpec {
  code: string;
  name: string;
  weight: number;
  cities: string[];
  dial: string;
  /** faker replaceSymbols pattern: # digit, ? letter. */
  postal: string;
}

const COUNTRIES: CountrySpec[] = [
  {
    code: 'US',
    postal: '#####',
    name: 'United States',
    weight: 30,
    dial: '+1',
    cities: ['New York', 'Austin', 'Seattle', 'Chicago', 'San Diego', 'Denver'],
  },
  {
    code: 'GB',
    postal: '??# #??',
    name: 'United Kingdom',
    weight: 12,
    dial: '+44',
    cities: ['London', 'Manchester', 'Bristol', 'Edinburgh', 'Leeds'],
  },
  {
    code: 'DE',
    postal: '#####',
    name: 'Germany',
    weight: 10,
    dial: '+49',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Leipzig'],
  },
  {
    code: 'FR',
    postal: '#####',
    name: 'France',
    weight: 7,
    dial: '+33',
    cities: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Nantes'],
  },
  {
    code: 'CA',
    postal: '?#? #?#',
    name: 'Canada',
    weight: 7,
    dial: '+1',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'],
  },
  {
    code: 'AU',
    postal: '####',
    name: 'Australia',
    weight: 5,
    dial: '+61',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
  },
  {
    code: 'NL',
    postal: '#### ??',
    name: 'Netherlands',
    weight: 4,
    dial: '+31',
    cities: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven'],
  },
  {
    code: 'PL',
    postal: '##-###',
    name: 'Poland',
    weight: 4,
    dial: '+48',
    cities: ['Warsaw', 'Krakow', 'Wroclaw', 'Gdansk'],
  },
  {
    code: 'ES',
    postal: '#####',
    name: 'Spain',
    weight: 4,
    dial: '+34',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville'],
  },
  {
    code: 'IT',
    postal: '#####',
    name: 'Italy',
    weight: 4,
    dial: '+39',
    cities: ['Milan', 'Rome', 'Turin', 'Florence'],
  },
  {
    code: 'SE',
    postal: '### ##',
    name: 'Sweden',
    weight: 3,
    dial: '+46',
    cities: ['Stockholm', 'Gothenburg', 'Malmo'],
  },
  {
    code: 'JP',
    postal: '###-####',
    name: 'Japan',
    weight: 4,
    dial: '+81',
    cities: ['Tokyo', 'Osaka', 'Kyoto', 'Fukuoka'],
  },
  {
    code: 'BR',
    postal: '#####-###',
    name: 'Brazil',
    weight: 3,
    dial: '+55',
    cities: ['Sao Paulo', 'Rio de Janeiro', 'Curitiba'],
  },
  {
    code: 'UA',
    postal: '#####',
    name: 'Ukraine',
    weight: 3,
    dial: '+380',
    cities: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv'],
  },
];

const CUSTOMER_NOTES = [
  'VIP customer, prefers express shipping.',
  'Asked to combine shipments when possible.',
  'Gift orders, no prices on packing slip.',
  'Reached out about sizing, recommend one size up.',
  'Wholesale inquiry pending.',
];

const CARRIERS = ['DHL Express', 'UPS', 'FedEx', 'USPS', 'Royal Mail', 'DPD'];

/** Relative order likelihood per UTC hour: quiet nights, evening peak 18-22h. */
const HOUR_WEIGHTS = [
  0.3, 0.2, 0.15, 0.1, 0.1, 0.15, 0.3, 0.5, 0.8, 1, 1.1, 1.2, 1.3, 1.2, 1.1, 1.1, 1.2, 1.4, 2.2,
  2.6, 2.8, 2.6, 2.1, 1,
];

export const DEFAULT_USER: User = {
  id: 'usr_1',
  name: 'Alex Morgan',
  email: 'alex@nebula.store',
  avatarUrl: 'https://i.pravatar.cc/80?u=alex',
  role: 'Admin',
};

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Picks an index from cumulative weights using the seeded faker instance. */
function pickWeighted(f: Faker, cumulative: number[]): number {
  const r = f.number.float({ min: 0, max: cumulative[cumulative.length - 1] });
  const idx = cumulative.findIndex((c) => r < c);
  return idx === -1 ? cumulative.length - 1 : idx;
}

function cumulate(weights: number[]): number[] {
  let sum = 0;
  return weights.map((w) => (sum += w));
}

/** Rounds a price to a retail-looking value ending in .99 (or .00 / .50 for higher prices). */
function retailPrice(f: Faker, raw: number): number {
  const whole = Math.max(1, Math.round(raw));
  if (whole >= 100 && f.datatype.boolean(0.3)) return whole;
  return round2(whole - 0.01);
}

interface CustomerSeed {
  customer: Customer;
  address: Address;
  weight: number;
}

export function createSeed(seed = 42, now: Date = MOCK_NOW): MockData {
  const f = new Faker({ locale: [en] });
  f.seed(seed);
  const nowMs = now.getTime();

  const products = createProducts(f, nowMs);
  const customerSeeds = createCustomers(f, nowMs);
  const orders = createOrders(f, nowMs, products, customerSeeds);

  applyProductSales(products, orders);
  const customers = applyCustomerAggregates(f, customerSeeds, orders);

  return { products, customers, orders, user: { ...DEFAULT_USER } };
}

function createProducts(f: Faker, nowMs: number): Product[] {
  const products: Product[] = [];
  const categories = Object.keys(CATEGORIES) as ProductCategory[];
  const perCategory = PRODUCT_COUNT / categories.length;

  for (const category of categories) {
    const spec = CATEGORIES[category];
    const brands = f.helpers.shuffle([...BRANDS]);
    const nouns = f.helpers.shuffle([...spec.nouns]);

    for (let i = 0; i < perCategory; i++) {
      const n = products.length + 1;
      const brand = brands[i];
      const noun = nouns[i % nouns.length];
      const id = `prd_${pad(n, 4)}`;
      const price = retailPrice(f, f.number.float({ min: spec.price[0], max: spec.price[1] }));
      const compareAtPrice = f.datatype.boolean(0.3)
        ? retailPrice(f, price * f.number.float({ min: 1.15, max: 1.4 }))
        : null;

      const variants = createVariants(f, id, spec);
      const stock = variants.reduce((s, v) => s + v.stock, 0);

      products.push({
        id,
        sku: `${spec.code}-${brand.slice(0, 3).toUpperCase()}-${pad(n, 3)}`,
        name: `${brand} ${noun}`,
        description: `${f.helpers.arrayElement(spec.blurb)} Part of the ${brand} collection by Nebula.`,
        category,
        price,
        compareAtPrice,
        imageUrl: `https://picsum.photos/seed/nebula-${n}/400/400`,
        stock,
        sold: 0,
        rating: round2(f.number.float({ min: 3.6, max: 5, fractionDigits: 1 })),
        variants,
        createdAt: new Date(nowMs - f.number.int({ min: 420, max: 900 }) * DAY_MS).toISOString(),
        active: f.datatype.boolean(0.92),
      });
    }
  }
  return products;
}

function createVariants(f: Faker, productId: string, spec: CategorySpec): ProductVariant[] {
  const sizes = f.helpers.arrayElements(spec.sizes, {
    min: 1,
    max: Math.min(3, spec.sizes.length),
  });
  const colors = f.helpers.arrayElements(spec.colors, { min: 1, max: 2 });
  // Stock profile: ~8% sold out, ~15% running low, rest healthy.
  const profile = f.number.float({ min: 0, max: 1 });
  const maxPerVariant = profile < 0.08 ? 0 : profile < 0.23 ? 2 : 45;
  const minPerVariant = profile < 0.23 ? 0 : 3;

  const variants: ProductVariant[] = [];
  for (const size of sizes) {
    for (const color of colors) {
      variants.push({
        id: `${productId}_v${variants.length + 1}`,
        size,
        color,
        stock: f.number.int({ min: minPerVariant, max: maxPerVariant }),
      });
    }
  }
  return variants;
}

function createCustomers(f: Faker, nowMs: number): CustomerSeed[] {
  const countryCum = cumulate(COUNTRIES.map((c) => c.weight));
  const seeds: CustomerSeed[] = [];

  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const id = `cus_${pad(i, 4)}`;
    const firstName = f.person.firstName();
    const lastName = f.person.lastName();
    const country = COUNTRIES[pickWeighted(f, countryCum)];
    const address: Address = {
      line1: f.location.streetAddress(),
      city: f.helpers.arrayElement(country.cities),
      country: country.name,
      countryCode: country.code,
      postalCode: f.helpers.replaceSymbols(country.postal),
    };

    seeds.push({
      customer: {
        id,
        name: `${firstName} ${lastName}`,
        email: f.internet.email({ firstName, lastName }).toLowerCase(),
        avatarUrl: `https://i.pravatar.cc/80?u=${id}`,
        phone: `${country.dial} ${f.string.numeric(3)} ${f.string.numeric(3)} ${f.string.numeric(4)}`,
        country: country.name,
        countryCode: country.code,
        createdAt: new Date(
          nowMs - f.number.int({ min: 5 * DAY_MS, max: (HISTORY_DAYS + 30) * DAY_MS }),
        ).toISOString(),
        ordersCount: 0,
        lifetimeValue: 0,
        lastOrderAt: null,
        notes: f.datatype.boolean(0.15) ? f.helpers.arrayElement(CUSTOMER_NOTES) : '',
      },
      address,
      // Skewed weights: a few loyal repeat buyers, a long tail of occasional ones.
      weight: f.number.float({ min: 0.2, max: 2 }) ** 3,
    });
  }
  return seeds;
}

function createOrders(
  f: Faker,
  nowMs: number,
  products: Product[],
  customers: CustomerSeed[],
): Order[] {
  // Day weights: ~+4% per month growth, weekends +20%.
  const dayWeights: number[] = [];
  for (let daysAgo = 0; daysAgo <= HISTORY_DAYS; daysAgo++) {
    const monthsFromStart = (HISTORY_DAYS - daysAgo) / 30.4;
    const weekday = new Date(nowMs - daysAgo * DAY_MS).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 1.2 : 1;
    dayWeights.push(1.04 ** monthsFromStart * weekend);
  }
  const dayCum = cumulate(dayWeights);
  const hourCum = cumulate(HOUR_WEIGHTS);
  const customerCum = cumulate(customers.map((c) => c.weight));
  const productCum = cumulate(
    products.map((p) => (p.active ? 1 : 0.2) * f.number.float({ min: 0.3, max: 3 }) ** 2),
  );
  const startOfToday = Math.floor(nowMs / DAY_MS) * DAY_MS;

  const timestamps: number[] = [];
  while (timestamps.length < ORDER_COUNT) {
    const daysAgo = pickWeighted(f, dayCum);
    const hour = pickWeighted(f, hourCum);
    const ts =
      startOfToday -
      daysAgo * DAY_MS +
      hour * HOUR_MS +
      f.number.int({ min: 0, max: HOUR_MS - 1000 });
    if (ts <= nowMs) timestamps.push(Math.floor(ts / 1000) * 1000);
  }
  timestamps.sort((a, b) => a - b);

  return timestamps.map((createdMs, i) => {
    const number = 1001 + i;
    const { customer, address } = customers[pickWeighted(f, customerCum)];

    const itemCount = [1, 2, 3, 4][pickWeighted(f, [50, 80, 95, 100])];
    const chosen = new Set<number>();
    while (chosen.size < itemCount) chosen.add(pickWeighted(f, productCum));
    const items: OrderItem[] = [...chosen].map((idx) => {
      const p = products[idx];
      return {
        productId: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        sku: p.sku,
        quantity: [1, 2, 3][pickWeighted(f, [80, 95, 100])],
        unitPrice: p.price,
      };
    });

    const subtotal = round2(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
    const shipping = subtotal >= 100 ? 0 : 7.99;
    const tax = round2(subtotal * 0.08);
    const total = round2(subtotal + shipping + tax);
    const history = createHistory(f, createdMs, nowMs);

    return {
      id: `ord_${pad(i + 1, 6)}`,
      number,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerAvatarUrl: customer.avatarUrl,
      items,
      subtotal,
      shipping,
      tax,
      total,
      status: history[history.length - 1].status,
      paymentMethod: (['card', 'paypal', 'apple_pay'] as const)[pickWeighted(f, [65, 85, 100])],
      createdAt: new Date(createdMs).toISOString(),
      shippingAddress: { ...address },
      history,
    };
  });
}

/** Builds a plausible status timeline whose final status depends on the order's age. */
function createHistory(f: Faker, createdMs: number, nowMs: number): StatusChange[] {
  const ageMs = nowMs - createdMs;
  const ageDays = ageMs / DAY_MS;

  let target: OrderStatus;
  if (f.datatype.boolean(0.04)) target = 'cancelled';
  else if (ageDays < 1) target = f.datatype.boolean(0.7) ? 'new' : 'packing';
  else if (ageDays < 2) target = f.datatype.boolean(0.3) ? 'new' : 'packing';
  else if (ageDays < 7) target = ageDays > 4 && f.datatype.boolean(0.25) ? 'delivered' : 'shipped';
  else target = 'delivered';

  const steps: { status: OrderStatus; delayMs: number; note?: string }[] = [
    { status: 'new', delayMs: 0, note: 'Order placed' },
  ];
  if (target === 'cancelled') {
    if (f.datatype.boolean(0.4))
      steps.push({ status: 'packing', delayMs: f.number.int({ min: 1, max: 8 }) * HOUR_MS });
    steps.push({
      status: 'cancelled',
      delayMs: f.number.int({ min: 1, max: 20 }) * HOUR_MS,
      note: f.helpers.arrayElement([
        'Customer requested cancellation',
        'Payment declined',
        'Item out of stock',
      ]),
    });
  } else {
    const flow: OrderStatus[] = ['packing', 'shipped', 'delivered'];
    const delays = [
      f.number.int({ min: 2, max: 12 }) * HOUR_MS,
      f.number.int({ min: 12, max: 36 }) * HOUR_MS,
      f.number.int({ min: 48, max: 120 }) * HOUR_MS,
    ];
    for (let k = 0; k < flow.indexOf(target) + 1; k++) {
      steps.push({
        status: flow[k],
        delayMs: delays[k],
        note: flow[k] === 'shipped' ? `Shipped via ${f.helpers.arrayElement(CARRIERS)}` : undefined,
      });
    }
  }

  // Compress the timeline if it would run past "now" (young orders).
  const totalDelay = steps.reduce((s, st) => s + st.delayMs, 0);
  const scale = totalDelay > ageMs * 0.9 ? (ageMs * 0.9) / totalDelay : 1;

  let t = createdMs;
  return steps.map((st) => {
    t += Math.floor(st.delayMs * scale);
    const change: StatusChange = { status: st.status, at: new Date(t).toISOString() };
    if (st.note) change.note = st.note;
    return change;
  });
}

function applyProductSales(products: Product[], orders: Order[]): void {
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items) {
      const p = byId.get(it.productId);
      if (p) p.sold += it.quantity;
    }
  }
}

function applyCustomerAggregates(f: Faker, seeds: CustomerSeed[], orders: Order[]): Customer[] {
  const byId = new Map(seeds.map((s) => [s.customer.id, s.customer]));
  const firstOrder = new Map<string, number>();

  for (const o of orders) {
    const c = byId.get(o.customerId);
    if (!c) continue;
    const at = Date.parse(o.createdAt);
    if (!firstOrder.has(c.id)) firstOrder.set(c.id, at);
    if (o.status === 'cancelled') continue;
    c.ordersCount += 1;
    c.lifetimeValue += o.total;
    c.lastOrderAt = o.createdAt; // orders are chronological
  }

  for (const c of byId.values()) {
    c.lifetimeValue = round2(c.lifetimeValue);
    const first = firstOrder.get(c.id);
    // A customer must sign up before placing their first order.
    if (first !== undefined && Date.parse(c.createdAt) > first) {
      c.createdAt = new Date(
        first - f.number.int({ min: HOUR_MS, max: 30 * DAY_MS }),
      ).toISOString();
    }
  }
  return seeds.map((s) => s.customer);
}
