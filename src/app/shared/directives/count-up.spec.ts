import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../../core/theme/theme.service';
import { CountUp, KpiFormat, formatKpi } from './count-up';

describe('formatKpi', () => {
  it.each([
    [48210, 'currency', '$48,210'],
    [12.5, 'currency', '$12.50'],
    [1284, 'number', '1,284'],
    [3.42, 'percent', '3.4%'],
  ] as const)('formatKpi(%d, %s)', (v, f, out) => expect(formatKpi(v, f)).toBe(out));

  it('rounds fractional intermediate numbers', () => {
    expect(formatKpi(1283.6, 'number')).toBe('1,284');
    expect(formatKpi(1000.4, 'currency')).toBe('$1,000');
  });
});

@Component({
  imports: [CountUp],
  template: `<span [nbCountUp]="value()" [format]="format()"></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly value = signal(1284);
  readonly format = signal<KpiFormat>('number');
}

function setup(reducedMotion: boolean) {
  TestBed.configureTestingModule({
    providers: [{ provide: ThemeService, useValue: { reducedMotion: signal(reducedMotion) } }],
  });
  const fixture = TestBed.createComponent(Host);
  const span = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
  return { fixture, span };
}

describe('CountUp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sets final value immediately under reduced motion', async () => {
    const { fixture, span } = setup(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(span.textContent).toBe('1,284');

    fixture.componentInstance.value.set(48210);
    fixture.componentInstance.format.set('currency');
    await fixture.whenStable();
    expect(span.textContent).toBe('$48,210');
  });

  it('animates from 0 to the target with requestAnimationFrame', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    // Angular's zoneless scheduler also queues frames, so flush everything pending.
    const flush = (t: number) => frames.splice(0).forEach((cb) => cb(t));

    const { fixture, span } = setup(false);
    fixture.detectChanges();
    expect(span.textContent).toBe('0');

    flush(1000 + 450);
    const mid = Number(span.textContent?.replace(/,/g, ''));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1284);

    flush(1000 + 900);
    expect(span.textContent).toBe('1,284');
    flush(1000 + 2000);
    expect(span.textContent).toBe('1,284');
  });
});
