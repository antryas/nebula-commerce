import { TestBed } from '@angular/core/testing';
import { ToastHost } from './toast-host';
import { ToastService } from './toast.service';

describe('ToastHost', () => {
  it('renders toasts in a polite live region and dismisses on close', async () => {
    const fixture = TestBed.createComponent(ToastHost);
    const toasts = TestBed.inject(ToastService);
    toasts.show({
      kind: 'order',
      title: 'New order #1234',
      message: 'Ada · $10.00',
      durationMs: 0,
    });
    toasts.error('Oops');
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
    const items = el.querySelectorAll('[data-toast]');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('New order #1234');
    expect(items[0].textContent).toContain('Ada · $10.00');
    expect(items[0].classList).toContain('nb-toast--order');
    expect(items[1].classList).toContain('nb-toast--error');

    const close = items[1].querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss notification"]',
    );
    close?.click();
    expect(toasts.toasts()).toHaveLength(1);
  });
});
