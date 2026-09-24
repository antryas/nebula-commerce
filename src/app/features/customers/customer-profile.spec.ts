import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ToastService } from '../../core/notifications/toast.service';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
import { mockDb } from '../../mock-api/db';
import { CustomerProfilePage } from './customer-profile';

async function setup() {
  mockDb.reset();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  const customer = [...mockDb.data.customers].sort((a, b) => b.ordersCount - a.ordersCount)[0];
  const fixture = TestBed.createComponent(CustomerProfilePage);
  fixture.componentRef.setInput('id', customer.id);
  const el = fixture.nativeElement as HTMLElement;
  await vi.waitFor(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain(customer.name);
  });
  return { fixture, el, customer };
}

describe('CustomerProfilePage', () => {
  it('shows the hero, stats and order history', async () => {
    const { el, customer } = await setup();
    expect(el.textContent).toContain(customer.email);
    expect(el.textContent).toContain('Customer since');
    expect(el.textContent).toContain('Lifetime value');
    const orders = mockDb.data.orders.filter((o) => o.customerId === customer.id);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(orders.length);
    const link = el.querySelector<HTMLAnchorElement>('tbody a')!;
    expect(link.getAttribute('href')).toMatch(/^\/orders\/ord_/);
  });

  it('shows a "Saved" toast when edited notes lose focus', async () => {
    const { el, fixture } = await setup();
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const notes = el.querySelector<HTMLTextAreaElement>('textarea')!;
    notes.value = 'Prefers express shipping';
    notes.dispatchEvent(new Event('input'));
    notes.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(success).toHaveBeenCalledWith('Saved', expect.any(String));

    success.mockClear();
    notes.dispatchEvent(new Event('blur'));
    expect(success).not.toHaveBeenCalled();
  });
});
