import {
  AI_HISTORY_CONTENT_MAX,
  AI_HISTORY_MAX,
  AI_PRODUCT_NAME_MAX,
  AI_QUESTION_MAX,
  AiAnswer,
  AiDescription,
  AiQuota,
  AiStatus,
  AiTone,
  Kpi,
  ProductCategory,
} from '../../models';
import { mockDb } from '../db';
import { MockRouter, bodyOf, fail, ok } from '../router';
import { round2 } from '../seed';
import { overview, topProducts } from './analytics';

/** The dashboard's default range, so recorded answers quote the same numbers as the KPI cards. */
const RANGE = '30d';
const RANGE_TEXT = 'the last 30 days';
const LIST_LIMIT = 5;
const KEYWORDS_MAX = 200;

const TONES: readonly AiTone[] = ['friendly', 'premium', 'playful'];
const CATEGORIES: readonly ProductCategory[] = [
  'Apparel',
  'Footwear',
  'Accessories',
  'Electronics',
  'Home',
  'Beauty',
];

/** The mock never calls a model: there is no live quota to spend. */
const NO_QUOTA: AiQuota = { remaining: 0, limit: 0 };

export const AI_FALLBACK_ANSWER =
  'Live AI is not available right now. Try one of the suggested questions — they are answered ' +
  'from live store data.';

export type AiTopic = 'customers' | 'unshipped' | 'products' | 'revenue';

/**
 * Keyword rules, checked in order (customers before products so "top customers" is not read
 * as "top products"). Loose on purpose: "best sellers", "pending orders", "VIP clients" match.
 */
const TOPICS: readonly { topic: AiTopic; pattern: RegExp }[] = [
  { topic: 'customers', pattern: /\b(customers?|clients?|buyers?|shoppers?|valuable|vips?)\b/ },
  {
    topic: 'unshipped',
    pattern: /\b(waiting|pending|unshipped|unfulfilled|ship|shipped|shipping|fulfil\w*|backlog)\b/,
  },
  { topic: 'products', pattern: /\b(products?|items?|best[\s-]?sell\w*|top[\s-]?sell\w*)\b/ },
  { topic: 'revenue', pattern: /\b(revenue|sales|income|earn\w*|turnover)\b/ },
];

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const count = new Intl.NumberFormat('en-US');
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * `/api/ai/*` in "recorded" mode: the same contract as the live backend, but answers are
 * templated from the mock database instead of a model, so the demo costs nothing to run.
 */
export function registerAiRoutes(r: MockRouter): void {
  r.add('GET', '/api/ai/status', () =>
    ok({ enabled: false, provider: null, quota: NO_QUOTA } satisfies AiStatus),
  );

  r.add('POST', '/api/ai/ask', (req) => {
    const { question, history } = bodyOf(req);
    const errors: Record<string, string> = {};
    if (typeof question !== 'string' || !question.trim() || question.length > AI_QUESTION_MAX) {
      errors['question'] = `Ask a question of 1–${AI_QUESTION_MAX} characters`;
    }
    if (history !== undefined && !isValidHistory(history)) {
      errors['history'] =
        `Up to ${AI_HISTORY_MAX} messages of at most ${AI_HISTORY_CONTENT_MAX} characters`;
    }
    if (Object.keys(errors).length) return fail(400, 'validation', 'Question is invalid', errors);

    const { answer, toolsUsed } = answerQuestion(question as string);
    return ok({ answer, mode: 'recorded', toolsUsed, quota: NO_QUOTA } satisfies AiAnswer);
  });

  r.add('POST', '/api/ai/product-description', (req) => {
    const { name, category, keywords, tone } = bodyOf(req);
    const errors: Record<string, string> = {};
    if (typeof name !== 'string' || !name.trim() || name.length > AI_PRODUCT_NAME_MAX) {
      errors['name'] = `Name must be 1–${AI_PRODUCT_NAME_MAX} characters`;
    }
    if (!CATEGORIES.includes(category as ProductCategory)) errors['category'] = 'Unknown category';
    if (keywords != null && (typeof keywords !== 'string' || keywords.length > KEYWORDS_MAX)) {
      errors['keywords'] = `Keywords must be at most ${KEYWORDS_MAX} characters`;
    }
    if (!TONES.includes(tone as AiTone)) errors['tone'] = `Expected one of ${TONES.join(', ')}`;
    if (Object.keys(errors).length) return fail(400, 'validation', 'Request is invalid', errors);

    const description = describeProduct(
      (name as string).trim(),
      category as ProductCategory,
      tone as AiTone,
      typeof keywords === 'string' ? keywords : '',
    );
    return ok({ description, mode: 'recorded', quota: NO_QUOTA } satisfies AiDescription);
  });
}

/** Picks the topic a question is about, or `null` when it matches none. */
export function matchTopic(question: string): AiTopic | null {
  const q = question.toLowerCase();
  return TOPICS.find((t) => t.pattern.test(q))?.topic ?? null;
}

/** Recorded answer for a question, built from the current mock data. */
export function answerQuestion(question: string): { answer: string; toolsUsed: string[] } {
  switch (matchTopic(question)) {
    case 'products':
      return { answer: topProductsAnswer(topCount(question)), toolsUsed: ['top_products'] };
    case 'revenue':
      return { answer: revenueAnswer(), toolsUsed: ['sales_summary'] };
    case 'unshipped':
      return { answer: unshippedAnswer(), toolsUsed: ['orders'] };
    case 'customers':
      return { answer: customersAnswer(topCount(question)), toolsUsed: ['top_customers'] };
    default:
      return { answer: AI_FALLBACK_ANSWER, toolsUsed: [] };
  }
}

/** Deterministic product copy: one template per tone. */
export function describeProduct(
  name: string,
  category: ProductCategory,
  tone: AiTone,
  keywords = '',
): string {
  const kind = category === 'Home' ? 'home' : category.toLowerCase();
  const list = keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const highlights = list.length ? joinWords(list) : '';

  switch (tone) {
    case 'premium':
      return (
        `The ${name} brings quiet luxury to your ${kind} collection. ` +
        (highlights ? `Defined by ${highlights}, every ` : 'Every ') +
        'detail is considered, from the choice of materials to the final finish. ' +
        'Made to be enjoyed for years, not seasons.'
      );
    case 'playful':
      return (
        `Say hello to the ${name}! ` +
        (highlights ? `Packed with ${highlights}, this ` : 'This ') +
        `${kind} favorite is here to make every day a little brighter. ` +
        'Warning: compliments may follow.'
      );
    default:
      return (
        `Meet the ${name}, an easy everyday pick from our ${kind} range. ` +
        (highlights ? `You'll love the ${highlights}. ` : '') +
        'It feels good from day one, is simple to care for and fits right into your routine.'
      );
  }
}

// ---------------------------------------------------------------------------------------------
// Answers

function topProductsAnswer(limit: number): string {
  const rows = topProducts(RANGE, limit);
  if (!rows.length) return `There were no paid orders in ${RANGE_TEXT}.`;
  const revenue = kpi('revenue').value;
  const top = rows.reduce((s, r) => s + r.revenue, 0);
  const share = revenue ? Math.round((top / revenue) * 100) : 0;
  return [
    `Your top ${rows.length} products over ${RANGE_TEXT}, by revenue:`,
    rows
      .map(
        (r) =>
          `- **${r.product.name}**: ${usd.format(r.revenue)} from ` +
          `${count.format(r.unitsSold)} units`,
      )
      .join('\n'),
    `Together they brought in **${usd.format(top)}**, ${share}% of revenue in the period.`,
  ].join('\n\n');
}

function revenueAnswer(): string {
  const revenue = kpi('revenue');
  const orders = kpi('orders');
  const aov = kpi('aov');
  const direction = revenue.deltaPct >= 0 ? 'up' : 'down';
  return [
    `Revenue for ${RANGE_TEXT} is **${usd.format(revenue.value)}**, ${direction} ` +
      `**${Math.abs(revenue.deltaPct).toFixed(1)}%** from ${usd.format(revenue.previous)} ` +
      'in the previous 30 days.',
    [
      `- Orders: **${count.format(orders.value)}** (${signed(orders.deltaPct)})`,
      `- Average order value: **${usd.format(aov.value)}** (${signed(aov.deltaPct)})`,
    ].join('\n'),
    Math.abs(orders.deltaPct) >= Math.abs(aov.deltaPct)
      ? 'Most of the change comes from order volume rather than basket size.'
      : 'Most of the change comes from basket size rather than order volume.',
  ].join('\n\n');
}

function unshippedAnswer(): string {
  const open = mockDb.data.orders
    .filter((o) => o.status === 'new' || o.status === 'packing')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!open.length) return 'Every order has shipped. Nothing is waiting right now.';
  const isNew = open.filter((o) => o.status === 'new').length;
  const value = round2(open.reduce((s, o) => s + o.total, 0));
  return [
    `**${count.format(open.length)} orders** are still waiting to be shipped, worth ` +
      `**${usd.format(value)}** in total:`,
    [
      `- **${count.format(isNew)}** new, not packed yet`,
      `- **${count.format(open.length - isNew)}** being packed`,
    ].join('\n'),
    'The oldest ones:',
    open
      .slice(0, LIST_LIMIT)
      .map(
        (o) =>
          `- **#${o.number}** · ${o.customerName}: ${usd.format(o.total)}, placed ` +
          `${day.format(new Date(o.createdAt))} (${o.status})`,
      )
      .join('\n'),
  ].join('\n\n');
}

function customersAnswer(limit: number): string {
  const top = [...mockDb.data.customers]
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, limit);
  if (!top.length) return 'There are no customers yet.';
  const total = round2(top.reduce((s, c) => s + c.lifetimeValue, 0));
  return [
    `Your ${top.length} most valuable customers by lifetime value:`,
    top
      .map(
        (c) =>
          `- **${c.name}** (${c.country}): ${usd.format(c.lifetimeValue)} across ` +
          `${count.format(c.ordersCount)} orders`,
      )
      .join('\n'),
    `Together they have spent **${usd.format(total)}** with your store.`,
  ].join('\n\n');
}

// ---------------------------------------------------------------------------------------------
// Helpers

function kpi(key: Kpi['key']): Kpi {
  const found = overview(RANGE).find((k) => k.key === key);
  if (!found) throw new Error(`Missing KPI ${key}`);
  return found;
}

/** "top 3 products" asks for 3 rows; anything else gets the default 5 (max 10). */
function topCount(question: string): number {
  const n = Number.parseInt(/\btop\s+(\d{1,2})\b/i.exec(question)?.[1] ?? '', 10);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : LIST_LIMIT;
}

function signed(pct: number): string {
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
}

function joinWords(words: string[]): string {
  return words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function isValidHistory(history: unknown): boolean {
  return (
    Array.isArray(history) &&
    history.length <= AI_HISTORY_MAX &&
    history.every((turn: unknown) => {
      if (!turn || typeof turn !== 'object') return false;
      const { role, content } = turn as Record<string, unknown>;
      return (
        (role === 'user' || role === 'assistant') &&
        typeof content === 'string' &&
        content.length <= AI_HISTORY_CONTENT_MAX
      );
    })
  );
}
