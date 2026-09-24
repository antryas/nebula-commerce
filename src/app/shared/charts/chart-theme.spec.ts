import {
  ACCENTS,
  baseOption,
  chartPalette,
  donutOption,
  mix,
  revenueAreaOption,
  withAlpha,
} from './chart-theme';

// Option objects are deeply nested unions; tests only poke at known paths.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

describe('chartPalette', () => {
  it('switches text color by theme', () => {
    expect(chartPalette('dark', 'violet').text).toBe('#e5e7eb');
    expect(chartPalette('light', 'violet').text).toBe('#0f172a');
  });

  it('takes accent colors from the ACCENTS map', () => {
    expect(ACCENTS.cyan).toEqual(['#06b6d4', '#3b82f6']);
    const p = chartPalette('dark', 'cyan');
    expect(p.accent1).toBe('#06b6d4');
    expect(p.accent2).toBe('#3b82f6');
  });

  it('starts the series palette with the accents and never repeats a color', () => {
    for (const accent of Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]) {
      const p = chartPalette('dark', accent);
      expect(p.series.slice(0, 2)).toEqual(ACCENTS[accent]);
      expect(p.series.length).toBeGreaterThanOrEqual(6);
      expect(new Set(p.series).size).toBe(p.series.length);
    }
  });
});

describe('color helpers', () => {
  it('adds alpha to a hex color', () => {
    expect(withAlpha('#8b5cf6', 0.45)).toBe('rgba(139,92,246,0.45)');
  });

  it('blends two hex colors', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('baseOption', () => {
  it('is transparent, uses Inter and a glass tooltip', () => {
    const o = baseOption(chartPalette('dark', 'violet')) as Loose;
    expect(o.backgroundColor).toBe('transparent');
    expect(o.textStyle.fontFamily).toContain('Inter');
    expect(o.tooltip.backgroundColor).toBe('rgba(15,20,34,.85)');
    expect(o.tooltip.borderColor).toContain('139,92,246');
  });
});

describe('revenueAreaOption', () => {
  it('uses accent colors for revenue series', () => {
    const p = chartPalette('dark', 'violet');
    const o = revenueAreaOption([{ date: '2026-09-01', revenue: 10, orders: 1 }], p) as Loose;
    expect(p.accent1).toBe('#8b5cf6');
    expect(o.series[0].lineStyle.color).toBe('#8b5cf6');
    expect(o.series[0].smooth).toBe(true);
  });

  it('gives the line a glow and plots orders as faint bars on a second axis', () => {
    const p = chartPalette('dark', 'violet');
    const o = revenueAreaOption(
      [
        { date: '2026-09-01', revenue: 10, orders: 1 },
        { date: '2026-09-02', revenue: 20, orders: 3 },
      ],
      p,
    ) as Loose;
    expect(o.series[0].lineStyle).toMatchObject({
      width: 3,
      shadowBlur: 18,
      shadowColor: '#8b5cf6',
    });
    expect(o.series[0].data).toEqual([10, 20]);
    expect(o.series[0].areaStyle.color.colorStops[0].color).toBe('rgba(139,92,246,0.45)');
    expect(o.series[1]).toMatchObject({ type: 'bar', yAxisIndex: 1, data: [1, 3] });
    expect(o.series[1].itemStyle.opacity).toBe(0.25);
    expect(o.xAxis.data).toEqual(['Sep 1', 'Sep 2']);
  });

  it('labels monthly buckets by month name', () => {
    const o = revenueAreaOption(
      [{ date: '2026-09-01', revenue: 1, orders: 1 }],
      chartPalette('dark', 'violet'),
      '12m',
    ) as Loose;
    expect(o.xAxis.data).toEqual(['Sep']);
  });
});

describe('donutOption', () => {
  const data = [
    { category: 'Apparel' as const, revenue: 600 },
    { category: 'Home' as const, revenue: 400 },
  ];

  it('draws a rounded ring separated by the card color', () => {
    const p = chartPalette('light', 'violet');
    const o = donutOption(data, p) as Loose;
    expect(o.series[0].radius).toEqual(['62%', '82%']);
    expect(o.series[0].itemStyle).toMatchObject({
      borderRadius: 8,
      borderWidth: 3,
      borderColor: '#ffffff',
    });
    expect(o.series[0].data).toEqual([
      { name: 'Apparel', value: 600 },
      { name: 'Home', value: 400 },
    ]);
  });

  it('shows the total revenue in the center', () => {
    const o = donutOption(data, chartPalette('dark', 'violet')) as Loose;
    expect(o.title.text).toBe('$1K');
    expect(o.title.subtext).toBe('Total revenue');
  });
});
