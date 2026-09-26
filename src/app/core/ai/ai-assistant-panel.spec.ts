import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { mockDb } from '../../mock-api/db';
import { AI_SUGGESTED_QUESTIONS } from '../../models';
import { AiAssistantPanel } from './ai-assistant-panel';
import { AiAssistantStore } from './ai-assistant.store';

/** jsdom rendering is slow when the whole suite runs in parallel. */
const WAIT = { timeout: 5000 };
const SLOW = 15000;

async function setup() {
  mockDb.reset();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  const store = TestBed.inject(AiAssistantStore);
  const fixture = TestBed.createComponent(AiAssistantPanel);
  store.open();
  await fixture.whenStable();
  return { fixture, store, el: fixture.nativeElement as HTMLElement };
}

describe('AiAssistantPanel', () => {
  it(
    'answers a suggested question in the recorded demo',
    async () => {
      const { fixture, el } = await setup();
      expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe(
        'nb-ai-title',
      );
      expect(el.querySelector('.nb-ai__badge')?.textContent?.trim()).toBe('Recorded demo');
      expect(el.querySelector('.nb-ai__quota')).toBeNull();

      const chips = [...el.querySelectorAll<HTMLButtonElement>('.nb-ai__chip')];
      expect(chips.map((c) => c.textContent?.trim())).toEqual(
        AI_SUGGESTED_QUESTIONS.map((q) => `north_east ${q}`),
      );
      chips[3].click();
      fixture.detectChanges();
      expect(el.querySelector('.nb-ai__typing')).not.toBeNull();
      expect(el.querySelector('textarea')?.disabled).toBe(true);

      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(el.querySelectorAll('.nb-ai__msg')).toHaveLength(2);
      }, WAIT);
      const best = [...mockDb.data.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue)[0];
      expect(el.querySelector('.nb-ai__msg:not(.nb-ai__msg--user) strong')?.textContent).toBe(
        best.name,
      );
      expect(el.querySelector('.nb-ai__tools')?.textContent).toContain('Used: top customers');
      expect(el.querySelector('.nb-ai__typing')).toBeNull();
    },
    SLOW,
  );

  it(
    'sends on Enter, clears the input and clears the chat',
    async () => {
      const { fixture, el, store } = await setup();
      const input = el.querySelector<HTMLTextAreaElement>('textarea')!;
      input.value = 'Write me a poem';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(store.messages()).toHaveLength(2);
      }, WAIT);
      expect(input.value).toBe('');
      expect(el.textContent).toContain('Live AI is not available right now.');

      el.querySelector<HTMLButtonElement>('[aria-label="Clear chat"]')!.click();
      await fixture.whenStable();
      expect(store.messages()).toEqual([]);

      el.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click();
      await fixture.whenStable();
      expect(store.isOpen()).toBe(false);
      expect(el.querySelector('[role="dialog"]')).toBeNull();
    },
    SLOW,
  );
});
