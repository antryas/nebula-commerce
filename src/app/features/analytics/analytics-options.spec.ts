import {
  GEO_NAME_BY_CODE,
  funnelOption,
  geoOption,
  heatmapOption,
  revenueOption,
} from './analytics-options';
import { chartPalette } from '../../shared/charts/chart-theme';

/* eslint-disable @typescript-eslint/no-explicit-any -- inspecting loosely typed ECharts options */
describe('analytics options', () => {
  const p = chartPalette('dark', 'violet');

  it('heatmap maps weekday and hour to axes', () => {
    const o = heatmapOption([{ weekday: 0, hour: 18, orders: 7 }], p) as any;
    expect(o.series[0].type).toBe('heatmap');
    expect(o.series[0].data[0]).toEqual([18, 0, 7]);
    expect(o.yAxis.data[0]).toBe('Mon');
    expect(o.xAxis.data).toHaveLength(24);
    expect(o.visualMap.inRange.color.at(-1)).toBe(p.accent2);
  });

  it('geo option uses ECharts country names', () => {
    const o = geoOption(
      [
        { countryCode: 'US', country: 'United States', revenue: 100, orders: 2 },
        { countryCode: 'DE', country: 'Germany', revenue: 40, orders: 1 },
      ],
      p,
    ) as any;
    expect(o.series[0].type).toBe('map');
    expect(o.series[0].map).toBe('world');
    expect(o.series[0].data[0].name).toBe('United States of America');
    expect(o.series[0].data[1].name).toBe('Germany');
    expect(o.visualMap.max).toBe(100);
    expect(GEO_NAME_BY_CODE['US']).toBe('United States of America');
  });

  it('funnel keeps step order', () => {
    const o = funnelOption(
      [
        { step: 'Visits', value: 100 },
        { step: 'Paid', value: 5 },
      ],
      p,
    ) as any;
    expect(o.series[0].type).toBe('funnel');
    expect(o.series[0].sort).toBe('none');
    expect(o.series[0].data.map((d: any) => d.name)).toEqual(['Visits', 'Paid']);
  });

  it('revenue option plots revenue as an area and orders as bars', () => {
    const o = revenueOption(
      [
        { date: '2026-09-01', revenue: 1200, orders: 12 },
        { date: '2026-09-02', revenue: 900, orders: 9 },
      ],
      p,
    ) as any;
    expect(o.xAxis.data).toEqual(['2026-09-01', '2026-09-02']);
    const [revenue, orders] = o.series;
    expect(revenue.type).toBe('line');
    expect(revenue.areaStyle).toBeTruthy();
    expect(revenue.data).toEqual([1200, 900]);
    expect(orders.type).toBe('bar');
    expect(orders.data).toEqual([12, 9]);
  });
});
