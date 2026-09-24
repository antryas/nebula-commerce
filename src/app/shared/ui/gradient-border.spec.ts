import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GradientBorder } from './gradient-border';

@Component({
  imports: [GradientBorder],
  template: `<nb-gradient-border [active]="active()"><p class="inner">X</p></nb-gradient-border>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly active = signal(true);
}

describe('GradientBorder', () => {
  it('applies the animated border class when active', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('nb-gradient-border') as HTMLElement;
    expect(el.classList).toContain('nb-gradient-border');
    expect(el.querySelector('.inner')?.textContent).toBe('X');
  });

  it('drops the border class when inactive but keeps content', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.active.set(false);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('nb-gradient-border') as HTMLElement;
    expect(el.classList).not.toContain('nb-gradient-border');
    expect(el.querySelector('.inner')?.textContent).toBe('X');
  });
});
