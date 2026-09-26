import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../mock-backend';
import { mockDb } from '../db';
import {
  AI_SUGGESTED_QUESTIONS,
  AiAnswer,
  AiDescription,
  AiStatus,
  ApiError,
  Kpi,
} from '../../models';
import { TopProduct } from '../../core/api/analytics-api';
import { AI_FALLBACK_ANSWER, describeProduct, matchTopic } from './ai';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

describe('AI mock API', () => {
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

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));
  const ask = (question: string, history?: unknown) =>
    firstValueFrom(http.post<AiAnswer>('/api/ai/ask', { question, history }));
  const [TOP_PRODUCTS, REVENUE, UNSHIPPED, CUSTOMERS] = AI_SUGGESTED_QUESTIONS;

  it('reports AI as disabled, without a provider', async () => {
    const status = await get<AiStatus>('/api/ai/status');
    expect(status).toEqual({ enabled: false, provider: null, quota: { remaining: 0, limit: 0 } });
  });

  it('matches questions case-insensitively with loose keywords', () => {
    expect(AI_SUGGESTED_QUESTIONS.map(matchTopic)).toEqual([
      'products',
      'revenue',
      'unshipped',
      'customers',
    ]);
    expect(matchTopic('BEST SELLERS lately?')).toBe('products');
    expect(matchTopic('show me pending orders')).toBe('unshipped');
    expect(matchTopic('what are my SALES like')).toBe('revenue');
    expect(matchTopic('Top 3 VIP clients')).toBe('customers');
    expect(matchTopic('Write me a poem')).toBeNull();
  });

  it('answers top products with the analytics numbers', async () => {
    const res = await ask(TOP_PRODUCTS);
    const top = await get<TopProduct[]>('/api/analytics/top-products?range=30d&limit=5');
    expect(res.mode).toBe('recorded');
    expect(res.toolsUsed).toEqual(['top_products']);
    for (const row of top) {
      expect(res.answer).toContain(`**${row.product.name}**: ${usd.format(row.revenue)}`);
    }
    expect((await ask('top 2 products')).answer.match(/^- /gm)).toHaveLength(2);
  });

  it('answers the revenue change with the dashboard KPI', async () => {
    const res = await ask(REVENUE);
    const [revenue] = await get<Kpi[]>('/api/analytics/overview?range=30d');
    expect(res.toolsUsed).toEqual(['sales_summary']);
    expect(res.answer).toContain(`**${usd.format(revenue.value)}**`);
    expect(res.answer).toContain(`**${Math.abs(revenue.deltaPct).toFixed(1)}%**`);
    expect(res.answer).toContain(usd.format(revenue.previous));
  });

  it('counts orders waiting to be shipped from the database', async () => {
    const open = mockDb.data.orders.filter((o) => o.status === 'new' || o.status === 'packing');
    const oldest = [...open].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const res = await ask(UNSHIPPED);
    expect(res.toolsUsed).toEqual(['orders']);
    expect(res.answer).toContain(`**${open.length.toLocaleString('en-US')} orders**`);
    expect(res.answer).toContain(`**#${oldest.number}**`);
  });

  it('lists the customers with the highest lifetime value', async () => {
    const best = [...mockDb.data.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue)[0];
    const res = await ask(CUSTOMERS);
    expect(res.toolsUsed).toEqual(['top_customers']);
    expect(res.answer).toContain(`**${best.name}**`);
    expect(res.answer).toContain(usd.format(best.lifetimeValue));
  });

  it('falls back for anything else', async () => {
    const res = await ask('Write me a poem about the sea');
    expect(res).toEqual({
      answer: AI_FALLBACK_ANSWER,
      mode: 'recorded',
      toolsUsed: [],
      quota: { remaining: 0, limit: 0 },
    });
  });

  it('validates the question and history', async () => {
    const reject = (body: unknown) =>
      firstValueFrom(http.post('/api/ai/ask', body)).then(
        () => null,
        (e: { status: number; error: ApiError }) => e,
      );
    const empty = await reject({ question: '  ' });
    expect(empty?.status).toBe(400);
    expect(empty?.error.details).toHaveProperty('question');
    expect((await reject({ question: 'x'.repeat(501) }))?.status).toBe(400);
    const tooLong = Array.from({ length: 7 }, () => ({ role: 'user', content: 'hi' }));
    expect((await reject({ question: 'hi', history: tooLong }))?.status).toBe(400);
    expect(
      (await reject({ question: 'hi', history: [{ role: 'system', content: 'x' }] }))?.status,
    ).toBe(400);
  });

  it('writes a deterministic product description per tone', async () => {
    const describe = (tone: string) =>
      firstValueFrom(
        http.post<AiDescription>('/api/ai/product-description', {
          name: 'Aurora Hoodie',
          category: 'Apparel',
          tone,
        }),
      );
    const friendly = await describe('friendly');
    expect(friendly.mode).toBe('recorded');
    expect(friendly.description).toContain('Aurora Hoodie');
    expect((await describe('friendly')).description).toBe(friendly.description);
    const texts = new Set([
      friendly.description,
      (await describe('premium')).description,
      (await describe('playful')).description,
    ]);
    expect(texts.size).toBe(3);
    await expect(describe('grumpy')).rejects.toMatchObject({ status: 400 });
    expect(describeProduct('Lamp', 'Home', 'premium', 'oak, linen')).toContain('oak and linen');
  });
});
