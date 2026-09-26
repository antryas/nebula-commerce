import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AiAnswer, AiAskRequest, AiStatus } from '../../models';
import { AiApi } from '../api/ai-api';
import { ApiConfigService, BACKEND_STORAGE_KEY } from '../api/api-config.service';
import { AiAssistantStore, toolLabel } from './ai-assistant.store';

const LIVE_STATUS: AiStatus = {
  enabled: true,
  provider: 'DeepSeek',
  quota: { remaining: 12, limit: 20 },
};

function answer(overrides: Partial<AiAnswer> = {}): AiAnswer {
  return {
    answer: 'An answer',
    mode: 'live',
    toolsUsed: ['top_products'],
    quota: { remaining: 11, limit: 20 },
    ...overrides,
  };
}

function setup(status: AiStatus = LIVE_STATUS) {
  const replies: Subject<AiAnswer>[] = [];
  const requests: AiAskRequest[] = [];
  const api = {
    status: vi.fn(() => of(status)),
    ask: vi.fn((body: AiAskRequest) => {
      requests.push(body);
      const reply = new Subject<AiAnswer>();
      replies.push(reply);
      return reply.asObservable();
    }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AiApi, useValue: api }] });
  const config = TestBed.inject(ApiConfigService);
  const store = TestBed.inject(AiAssistantStore);
  /** Answers the latest question. */
  const reply = (a: AiAnswer = answer()) => {
    const last = replies[replies.length - 1];
    last.next(a);
    last.complete();
  };
  return { api, config, store, requests, replies, reply };
}

describe('AiAssistantStore', () => {
  beforeEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));

  it('shows the recorded badge in mock mode and no quota', () => {
    const { store, api } = setup({ ...LIVE_STATUS, enabled: false, provider: null });
    store.open();
    expect(store.isOpen()).toBe(true);
    expect(store.activated()).toBe(true);
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(store.isLive()).toBe(false);
    expect(store.badge()).toBe('Recorded demo');
    expect(store.quotaText()).toBeNull();
  });

  it('shows the provider and quota when the live backend has AI enabled', () => {
    const { store, config } = setup();
    config.setMode('live');
    TestBed.tick();
    store.open();
    expect(store.badge()).toBe('Live AI · DeepSeek');
    expect(store.quotaText()).toBe('12 of 20 left today');
  });

  it('marks the request pending and ignores new questions until it answers', () => {
    const { store, api, reply } = setup();
    store.ask('  What were my top 5 products this month?  ');
    expect(store.pending()).toBe(true);
    expect(store.messages()).toEqual([
      { id: 1, role: 'user', content: 'What were my top 5 products this month?' },
    ]);

    store.ask('Another one');
    expect(api.ask).toHaveBeenCalledTimes(1);

    reply();
    expect(store.pending()).toBe(false);
    expect(store.messages()[1]).toMatchObject({
      role: 'assistant',
      content: 'An answer',
      toolsUsed: ['top_products'],
      mode: 'live',
    });
  });

  it('ignores blank and over-long questions', () => {
    const { store, api } = setup();
    store.ask('   ');
    store.ask('x'.repeat(501));
    expect(api.ask).not.toHaveBeenCalled();
  });

  it('sends at most the last 6 messages as history', () => {
    const { store, requests, reply } = setup();
    for (let i = 1; i <= 5; i++) {
      store.ask(`Question ${i}`);
      reply(answer({ answer: `Answer ${i}` }));
    }
    expect(requests[0].history).toEqual([]);
    expect(requests[1].history).toEqual([
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer 1' },
    ]);
    const last = requests[4].history ?? [];
    expect(last).toHaveLength(6);
    expect(last[0]).toEqual({ role: 'user', content: 'Question 2' });
    expect(last[5]).toEqual({ role: 'assistant', content: 'Answer 4' });
    expect(store.messages()).toHaveLength(10);
  });

  it('notes the daily limit when the live backend answers in recorded mode', () => {
    const { store, config, reply } = setup();
    config.setMode('live');
    TestBed.tick();
    store.open();
    store.ask('Who are my most valuable customers?');
    reply(answer({ mode: 'recorded', quota: { remaining: 0, limit: 20 } }));
    expect(store.limitReached()).toBe(true);
    expect(store.quotaText()).toBe('0 of 20 left today');

    store.ask('And now?');
    reply(answer({ mode: 'live', quota: { remaining: 20, limit: 20 } }));
    expect(store.limitReached()).toBe(false);
  });

  it('never shows the limit note for the recorded demo', () => {
    const { store, reply } = setup({ ...LIVE_STATUS, enabled: false, provider: null });
    store.open();
    store.ask('Who are my most valuable customers?');
    reply(answer({ mode: 'recorded' }));
    expect(store.limitReached()).toBe(false);
  });

  it('shows a failed request inline and leaves it out of the history', () => {
    const { store, replies, requests } = setup();
    store.ask('First');
    replies[0].error({ status: 429, code: 'rate_limited', message: 'Too many requests.' });
    expect(store.pending()).toBe(false);
    expect(store.messages()[1]).toMatchObject({
      role: 'assistant',
      content: 'Too many requests.',
      error: true,
    });
    store.ask('Second');
    expect(requests[1].history).toEqual([{ role: 'user', content: 'First' }]);
  });

  it('clears the thread and drops an answer still on its way', () => {
    const { store, replies } = setup();
    store.ask('First');
    store.clear();
    expect(store.pending()).toBe(false);
    expect(store.messages()).toEqual([]);
    replies[0].next(answer());
    expect(store.messages()).toEqual([]);
  });

  it('starts a fresh conversation when the backend changes', () => {
    const { store, config, reply } = setup();
    store.ask('First');
    reply();
    config.setMode('live');
    TestBed.tick();
    expect(store.messages()).toEqual([]);
  });

  it('humanizes tool names', () => {
    expect(toolLabel('top_products')).toBe('top products');
    expect(toolLabel('get-orders')).toBe('orders');
    expect(toolLabel('salesSummary')).toBe('sales summary');
  });
});
