import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { mockDb } from '../../mock-api/db';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { OrderDetails } from './order-details';

async function setup(id: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  const fixture = TestBed.createComponent(OrderDetails);
  fixture.componentRef.setInput('id', id);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el };
}

vi.setConfig({ testTimeout: 20_000 });
const WAIT = { timeout: 10_000 };

describe('OrderDetails', () => {
  beforeEach(() => mockDb.reset());

  it('renders items, customer and the status timeline', async () => {
    const order = mockDb.data.orders.find((o) => o.status === 'shipped')!;
    const { fixture, el } = await setup(order.id);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.querySelector('h1')?.textContent).toContain(`Order #${order.number}`);
    }, WAIT);
    expect(el.querySelectorAll('[data-order-item]').length).toBe(order.items.length);
    expect(el.textContent).toContain(order.customerName);
    expect(el.querySelectorAll('[data-timeline-step]').length).toBe(4);
    expect(el.querySelector('[data-timeline-step].is-current')?.textContent).toContain('Shipped');
  });

  it('shows "Order not found" for an unknown id', async () => {
    const { fixture, el } = await setup('ord_missing');
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(el.querySelector('nb-empty-state')?.textContent).toContain('Order not found');
    }, WAIT);
  });
});
