import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
import { mockDb } from '../../mock-api/db';
import { PRODUCTS_VIEW_KEY } from './products.store';
import { Products } from './products';

/** jsdom rendering is slow when the whole suite runs in parallel. */
const WAIT = { timeout: 5000 };
const SLOW = 15000;

describe('Products page', () => {
  beforeEach(() => {
    mockDb.reset();
    localStorage.removeItem(PRODUCTS_VIEW_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
      ],
    });
  });

  it(
    'renders product cards and switches to the table view',
    async () => {
      const fixture = TestBed.createComponent(Products);
      const el = fixture.nativeElement as HTMLElement;
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(el.querySelectorAll('nb-product-card').length).toBe(12);
      }, WAIT);

      el.querySelector<HTMLButtonElement>('button[aria-label="Table view"]')!.click();
      await fixture.whenStable();
      expect(el.querySelectorAll('nb-product-card').length).toBe(0);
      expect(el.querySelectorAll('tbody tr').length).toBe(12);
    },
    SLOW,
  );

  it(
    'shows the stock label on sold-out cards',
    async () => {
      const fixture = TestBed.createComponent(Products);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      el.querySelector<HTMLButtonElement>('[data-stock="out"]')!.click();
      await vi.waitFor(async () => {
        await fixture.whenStable();
        const cards = el.querySelectorAll('nb-product-card');
        expect(cards.length).toBeGreaterThan(0);
        cards.forEach((c) => expect(c.textContent).toContain('Out of stock'));
      }, WAIT);
    },
    SLOW,
  );
});
