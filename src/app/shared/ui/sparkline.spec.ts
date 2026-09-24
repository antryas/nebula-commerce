import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sparkline, sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('maps min to bottom and max to top', () => {
    expect(sparklinePoints([0, 10], 100, 20, 0)).toBe('0,20 100,0');
  });

  it('handles flat series', () => {
    expect(sparklinePoints([5, 5, 5], 100, 20, 0)).toBe('0,10 50,10 100,10');
  });

  it('applies padding on every side', () => {
    expect(sparklinePoints([0, 10], 100, 20)).toBe('2,18 98,2');
  });

  it('returns an empty string for no data and a flat line for one point', () => {
    expect(sparklinePoints([], 100, 20, 0)).toBe('');
    expect(sparklinePoints([7], 100, 20, 0)).toBe('0,10 100,10');
  });
});

@Component({
  imports: [Sparkline],
  template: `<nb-sparkline [data]="data()" [positive]="positive()" [width]="100" [height]="20" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly data = signal([1, 3, 2, 5]);
  readonly positive = signal(true);
}

describe('Sparkline', () => {
  it('renders an accessible svg with polyline and area', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('rising');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 20');
    expect(svg.querySelector('polyline')?.getAttribute('points')).toBe(
      sparklinePoints([1, 3, 2, 5], 100, 20),
    );
    expect(svg.querySelector('path')).not.toBeNull();
  });

  it('switches to the negative tone when positive is false', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.positive.set(false);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('nb-sparkline') as HTMLElement;
    expect(host.classList).toContain('nb-sparkline--negative');
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toContain('falling');
  });

  it('uses unique gradient ids per instance', async () => {
    const a = TestBed.createComponent(Host);
    const b = TestBed.createComponent(Host);
    await a.whenStable();
    await b.whenStable();
    const idA = (a.nativeElement as HTMLElement).querySelector('linearGradient')?.id;
    const idB = (b.nativeElement as HTMLElement).querySelector('linearGradient')?.id;
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});
