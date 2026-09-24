import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OrderStatus } from '../../models';
import { STATUS_META, StatusChip } from './status-chip';

@Component({
  imports: [StatusChip],
  template: `<nb-status-chip [status]="status()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly status = signal<OrderStatus>('new');
}

describe('STATUS_META', () => {
  it('maps every status to label, color token and icon', () => {
    expect(STATUS_META).toEqual({
      new: { label: 'New', color: 'var(--nb-info)', icon: 'fiber_new' },
      packing: { label: 'Packing', color: 'var(--nb-warning)', icon: 'inventory_2' },
      shipped: { label: 'Shipped', color: 'var(--nb-accent-1)', icon: 'local_shipping' },
      delivered: { label: 'Delivered', color: 'var(--nb-success)', icon: 'task_alt' },
      cancelled: { label: 'Cancelled', color: 'var(--nb-danger)', icon: 'cancel' },
    });
  });
});

describe('StatusChip', () => {
  it.each(Object.keys(STATUS_META) as OrderStatus[])('renders %s', async (status) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.status.set(status);
    await fixture.whenStable();
    const chip = fixture.nativeElement.querySelector('nb-status-chip') as HTMLElement;
    const meta = STATUS_META[status];
    const icon = chip.querySelector('.material-symbols-rounded');
    expect(chip.querySelector('.nb-status-chip__label')?.textContent?.trim()).toBe(meta.label);
    expect(icon?.textContent?.trim()).toBe(meta.icon);
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(chip.getAttribute('data-status')).toBe(status);
    expect(chip.style.getPropertyValue('--nb-chip-color')).toBe(meta.color);
  });
});
