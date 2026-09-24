import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GlassCard } from './glass-card';

@Component({
  imports: [GlassCard],
  template: `<nb-glass-card [padded]="padded()"><span class="projected">Hi</span></nb-glass-card>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly padded = signal(true);
}

describe('GlassCard', () => {
  it('projects content and applies glass classes with padding by default', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('nb-glass-card') as HTMLElement;
    expect(card.querySelector('.projected')?.textContent).toBe('Hi');
    expect(card.classList).toContain('nb-glass');
    expect(card.classList).toContain('rounded-2xl');
    expect(card.classList).toContain('p-5');
  });

  it('removes padding when padded is false', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.padded.set(false);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('nb-glass-card') as HTMLElement;
    expect(card.classList).not.toContain('p-5');
    expect(card.classList).toContain('nb-glass');
  });
});
