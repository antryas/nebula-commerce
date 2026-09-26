import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../../mock-api/mock-backend';
import { mockDb } from '../../mock-api/db';
import { ProductEdit } from './product-edit';

/** jsdom rendering is slow when the whole suite runs in parallel. */
const WAIT = { timeout: 5000 };
const SLOW = 15000;

function setup(id?: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([mockApiInterceptor])),
      { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
    ],
  });
  const fixture = TestBed.createComponent(ProductEdit);
  if (id) fixture.componentRef.setInput('id', id);
  return fixture;
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ProductEdit', () => {
  beforeEach(() => mockDb.reset());

  it(
    'shows validation messages and keeps save disabled for an invalid new product',
    async () => {
      const fixture = setup();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const sku = el.querySelector<HTMLInputElement>('#product-sku')!;
      type(sku, 'ab');
      sku.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(el.textContent).toContain('Use 4–20 uppercase letters, digits or dashes');
      const save = el.querySelector<HTMLButtonElement>('.nb-save-bar__save')!;
      expect(save.disabled).toBe(true);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    },
    SLOW,
  );

  it(
    'updates the live preview as the user types',
    async () => {
      const fixture = setup();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      type(el.querySelector<HTMLInputElement>('#product-name')!, 'Aurora Sneaker');
      await fixture.whenStable();
      expect(el.querySelector('.nb-preview nb-product-card')?.textContent).toContain(
        'Aurora Sneaker',
      );
    },
    SLOW,
  );

  it(
    'loads an existing product and maps server 422 errors onto fields',
    async () => {
      const [first, second] = mockDb.data.products;
      const fixture = setup(first.id);
      const el = fixture.nativeElement as HTMLElement;
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(el.querySelector<HTMLInputElement>('#product-name')?.value).toBe(first.name);
      }, WAIT);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);

      type(el.querySelector<HTMLInputElement>('#product-sku')!, second.sku);
      await fixture.whenStable();
      el.querySelector<HTMLButtonElement>('.nb-save-bar__save')!.click();

      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(el.textContent).toContain('SKU is already in use');
      }, WAIT);
      expect(mockDb.data.products[0].sku).toBe(first.sku);
    },
    SLOW,
  );

  it(
    'generates a description with AI and keeps the unsaved-changes guard armed',
    async () => {
      const fixture = setup();
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const generate = () =>
        [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
          b.textContent?.includes('Generate with AI'),
        );
      expect(generate()?.disabled).toBe(true);

      type(el.querySelector<HTMLInputElement>('#product-name')!, 'Aurora Hoodie');
      const category = el.querySelector<HTMLSelectElement>('#product-category')!;
      category.value = 'Apparel';
      category.dispatchEvent(new Event('change'));
      const tone = el.querySelector<HTMLSelectElement>('[aria-label="Description tone"]')!;
      tone.value = 'playful';
      tone.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(generate()?.disabled).toBe(false);
      generate()!.click();
      fixture.detectChanges();
      expect(el.textContent).toContain('Generating…');

      const description = el.querySelector<HTMLTextAreaElement>('#product-description')!;
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(description.value).toContain('Say hello to the Aurora Hoodie!');
      }, WAIT);
      expect(el.querySelector('.nb-ai-gen__badge')?.textContent?.trim()).toBe('Recorded');
      expect(generate()?.disabled).toBe(false);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    },
    SLOW,
  );
});
