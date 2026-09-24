import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../../core/theme/theme.service';
import { Kpi } from '../../models';
import { KpiCard } from './kpi-card';

const KPI: Kpi = {
  key: 'revenue',
  label: 'Revenue',
  value: 48210,
  previous: 42900,
  deltaPct: 12.4,
  spark: [3, 5, 4, 7, 6, 9],
  format: 'currency',
};

@Component({
  imports: [KpiCard],
  template: `<nb-kpi-card [kpi]="kpi()" [highlight]="highlight()" [index]="2" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly kpi = signal<Kpi>(KPI);
  readonly highlight = signal(false);
}

function setup() {
  TestBed.configureTestingModule({
    providers: [{ provide: ThemeService, useValue: { reducedMotion: signal(true) } }],
  });
  return TestBed.createComponent(Host);
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim();

describe('KpiCard', () => {
  it('renders label, formatted value, positive delta and sparkline', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('.nb-kpi__label'))).toBe('Revenue');
    expect(el.querySelector('.nb-kpi__value')?.textContent).toBe('$48,210');
    const badge = el.querySelector('.nb-kpi__delta') as HTMLElement;
    expect(text(badge)).toBe('▲ 12.4%');
    expect(badge.getAttribute('aria-label')).toBe('Up 12.4% vs previous period');
    expect(badge.classList).toContain('nb-kpi__delta--up');
    expect(el.querySelector('nb-sparkline')?.classList).not.toContain('nb-sparkline--negative');
    const host = el.querySelector('nb-kpi-card') as HTMLElement;
    expect(host.classList).toContain('nb-stagger-item');
    expect(host.style.getPropertyValue('--nb-stagger-index')).toBe('2');
    expect(el.querySelector('.nb-gradient-border')).toBeNull();
  });

  it('shows a negative delta and wraps in a gradient border when highlighted', async () => {
    const fixture = setup();
    fixture.componentInstance.kpi.set({ ...KPI, deltaPct: -3.25 });
    fixture.componentInstance.highlight.set(true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('.nb-kpi__delta') as HTMLElement;
    expect(text(badge)).toBe('▼ 3.3%');
    expect(badge.getAttribute('aria-label')).toBe('Down 3.3% vs previous period');
    expect(badge.classList).toContain('nb-kpi__delta--down');
    expect(el.querySelector('nb-sparkline')?.classList).toContain('nb-sparkline--negative');
    expect(el.querySelector('.nb-gradient-border')).not.toBeNull();
  });
});
