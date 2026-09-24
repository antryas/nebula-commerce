import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { BackendSwitch } from '../api/backend-switch';
import { CommandPalette } from './command-palette';

async function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CommandPalette);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = async (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const key = async (k: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await fixture.whenStable();
  };
  const labels = () =>
    [...el.querySelectorAll('.nb-palette__label')].map((n) => n.textContent?.trim());
  return { fixture, el, input, type, key, labels, navigate };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    // jsdom does not implement scrolling.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('lists pages and actions when empty, first option active', async () => {
    const { labels, el, input } = await setup();
    expect(labels()).toContain('Overview');
    expect(labels()).toContain('Toggle theme');
    expect(el.querySelector('[role="option"][aria-selected="true"]')?.id).toBe(
      input.getAttribute('aria-activedescendant'),
    );
  });

  it('filters with fuzzy matching and runs the active command on Enter', async () => {
    const { type, key, labels, navigate } = await setup();
    await type('cust');
    expect(labels()[0]).toBe('Customers');
    await key('Enter');
    expect(navigate).toHaveBeenCalledWith('/customers');
  });

  it('moves the selection with the arrow keys and wraps around', async () => {
    const { input, key, navigate, el } = await setup();
    const count = el.querySelectorAll('[role="option"]').length;
    const active = () => input.getAttribute('aria-activedescendant');
    expect(active()).toBe('nb-palette-option-0');
    await key('ArrowUp');
    expect(active()).toBe(`nb-palette-option-${count - 1}`);
    await key('ArrowDown');
    await key('ArrowDown');
    expect(active()).toBe('nb-palette-option-1');
    await key('Enter');
    expect(navigate).toHaveBeenCalledWith('/orders');
  });

  it('keeps the highlight when the debounced empty search settles', async () => {
    const { input, key, fixture } = await setup();
    await key('ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('nb-palette-option-1');
    // The initial (empty) query re-emits once the search debounce elapses.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();
    expect(input.getAttribute('aria-activedescendant')).toBe('nb-palette-option-1');
  });

  it('searches orders, products and customers after a debounce', async () => {
    const { type, labels, fixture } = await setup();
    const ctrl = TestBed.inject(HttpTestingController);
    await type('ada');
    let reqs: TestRequest[] = [];
    await vi.waitFor(() => {
      // forkJoin fires all three requests together.
      reqs = ctrl.match((r) => r.url.startsWith('/api/'));
      expect(reqs).toHaveLength(3);
    }, 5000);
    const byUrl = (url: string) => reqs.find((r) => r.request.url === url)!;
    expect(byUrl('/api/orders').request.params.get('search')).toBe('ada');
    byUrl('/api/orders').flush({
      items: [{ id: 'ord_1', number: 1042, customerName: 'Ada Lovelace', total: 10 }],
      total: 1,
      page: 1,
      pageSize: 5,
    });
    // A failed entity search is ignored; the others still show.
    byUrl('/api/products').flush(null, { status: 500, statusText: 'x' });
    byUrl('/api/customers').flush({ items: [], total: 0, page: 1, pageSize: 5 });
    await fixture.whenStable();
    expect(labels()).toContain('Order #1042');
  });

  it('offers switching to the live .NET backend', async () => {
    const { type, key, labels } = await setup();
    const switchTo = vi
      .spyOn(TestBed.inject(BackendSwitch), 'switchTo')
      .mockImplementation(() => undefined);
    expect(labels()).toContain('Use live .NET backend');
    expect(labels()).not.toContain('Use mock data');
    await type('live .net');
    expect(labels()[0]).toBe('Use live .NET backend');
    await key('Enter');
    expect(switchTo).toHaveBeenCalledWith('live');
  });
});
