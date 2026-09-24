import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { signal } from '@angular/core';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { mockDb } from '../../mock-api/db';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { Order } from '../../models';
import { Fulfillment } from './fulfillment';

describe('Fulfillment', () => {
  beforeEach(() => {
    mockDb.reset();
    TestBed.configureTestingModule({
      imports: [Fulfillment],
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
        { provide: LiveOrdersService, useValue: { latest: signal<Order | null>(null) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Fulfillment);
    const el: HTMLElement = fixture.nativeElement;
    // First render compiles the board and loads ~100 orders; allow for a busy test runner.
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(el.querySelectorAll('.card').length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
    return { fixture, el };
  }

  const cardsIn = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLElement>(`[aria-label="${label} orders"] .card`)].map(
      (c) => c.dataset['orderId'],
    );

  it('renders the four pipeline columns with their cards', async () => {
    const { el } = await render();
    const titles = [...el.querySelectorAll('.column__title')].map((h) => h.textContent?.trim());
    expect(titles).toEqual(['New', 'Packing', 'Shipped', 'Delivered']);
    expect(cardsIn(el, 'New').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('[aria-label="Delivered orders"] .card__advance')).toHaveLength(0);
  });

  it('moves a card to the next column with its keyboard button', async () => {
    const { fixture, el } = await render();
    const id = cardsIn(el, 'New')[0]!;
    const button = el.querySelector<HTMLButtonElement>(`[data-order-id="${id}"] .card__advance`)!;
    expect(button.getAttribute('aria-label')).toMatch(/^Move order #\d+ to Packing$/);

    button.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(mockDb.data.orders.find((o) => o.id === id)!.status).toBe('packing');
    });
    await fixture.whenStable();
    expect(cardsIn(el, 'Packing')[0]).toBe(id);
    expect(cardsIn(el, 'New')).not.toContain(id);
    expect(document.activeElement?.closest('[data-order-id]')?.getAttribute('data-order-id')).toBe(
      id,
    );
  });
});
