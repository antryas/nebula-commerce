import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Stagger } from './stagger';

@Component({
  imports: [Stagger],
  template: `
    @for (i of items; track i) {
      <div [nbStagger]="i"></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly items = [0, 1, 2];
}

describe('Stagger', () => {
  it('adds the stagger class and index custom property', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const items = fixture.nativeElement.querySelectorAll('div') as NodeListOf<HTMLElement>;
    expect(items).toHaveLength(3);
    items.forEach((el, i) => {
      expect(el.classList).toContain('nb-stagger-item');
      expect(el.style.getPropertyValue('--nb-stagger-index')).toBe(String(i));
    });
  });
});
