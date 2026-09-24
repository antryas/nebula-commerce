import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { mockDb } from '../../mock-api/db';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
import { Orders } from './orders';

async function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
      { provide: LiveOrdersService, useValue: { latest: signal(null) } },
    ],
  });
  const fixture = TestBed.createComponent(Orders);
  const el = fixture.nativeElement as HTMLElement;
  const rows = () => el.querySelectorAll('tr[data-order-row]');
  await vi.waitFor(async () => {
    await fixture.whenStable();
    expect(rows().length).toBe(20);
  }, WAIT);
  return { fixture, el, rows };
}

// Rendering Material tables in jsdom is slow on a busy machine; allow generous time.
vi.setConfig({ testTimeout: 20_000 });
const WAIT = { timeout: 10_000 };

describe('Orders', () => {
  beforeEach(() => mockDb.reset());
  afterEach(() => vi.useRealTimers());

  it('renders 20 rows with the total count', async () => {
    const { el } = await setup();
    expect(el.querySelector('nb-page-header')?.textContent).toContain('4,800');
    expect(el.querySelector('tr[data-order-row]')?.textContent).toMatch(/#\d{4}/);
  });

  it('shows the empty state when the search has no matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture, el, rows } = await setup();
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'zzzz_nomatch';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(350);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.querySelector('nb-empty-state')?.textContent).toContain('No orders found');
    }, WAIT);
    expect(rows().length).toBe(0);
  });

  it('shows the bulk action bar once a row is selected', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('[data-bulk-bar]')).toBeNull();
    el.querySelector<HTMLInputElement>('tr[data-order-row] input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('[data-bulk-bar]')?.textContent).toContain('1 selected');
  });
});
