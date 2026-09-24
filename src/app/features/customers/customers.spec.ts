import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { mockDb } from '../../mock-api/db';
import { Customers } from './customers';

async function setup() {
  mockDb.reset();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  const fixture = TestBed.createComponent(Customers);
  const el = fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
  };
  await vi.waitFor(async () => {
    await settle();
    expect(rows().length).toBeGreaterThan(0);
  });
  return { fixture, el, rows, settle };
}

describe('Customers', () => {
  it('renders a page of customers sorted by lifetime value', async () => {
    const { rows } = await setup();
    expect(rows()).toHaveLength(10);
    const top = [...mockDb.data.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue)[0];
    expect(rows()[0].textContent).toContain(top.name);
    expect(rows()[0].textContent).toContain(top.email);
  });

  it('searching "Germany" shows only German customers', async () => {
    const { el, rows, settle } = await setup();
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'Germany';
    search.dispatchEvent(new Event('input'));

    await vi.waitFor(async () => {
      await settle();
      const countries = rows().map(
        (r) => r.querySelector('[data-col="country"]')?.textContent?.trim() ?? '',
      );
      expect(countries.length).toBeGreaterThan(0);
      expect(countries.every((c) => c.includes('Germany'))).toBe(true);
    });
  });

  it('sorts by orders when the Orders header is clicked', async () => {
    const { el, rows, settle } = await setup();
    const header = Array.from(el.querySelectorAll<HTMLButtonElement>('th button')).find((b) =>
      b.textContent?.includes('Orders'),
    )!;
    header.click();

    const most = Math.max(...mockDb.data.customers.map((c) => c.ordersCount));
    await vi.waitFor(async () => {
      await settle();
      expect(rows()[0].querySelector('[data-col="orders"]')?.textContent?.trim()).toBe(
        String(most),
      );
    });
    expect(header.closest('th')?.getAttribute('aria-sort')).toBe('descending');
  });

  it('opens the customer profile on row click', async () => {
    const { rows } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    rows()[0].click();
    const top = [...mockDb.data.customers].sort((a, b) => b.lifetimeValue - a.lifetimeValue)[0];
    expect(navigate).toHaveBeenCalledWith(['/customers', top.id]);
  });
});
