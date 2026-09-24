import type { EChartsOption } from 'echarts';
import type { AccentName, ThemeMode } from '../../core/theme/theme.service';
import { FunnelStep, GeoSales, HeatCell, TimePoint } from '../../models';

/**
 * Colors the analytics charts are drawn with. Mirrors the CSS design tokens because
 * ECharts renders to canvas and cannot read CSS custom properties.
 */
export interface AnalyticsPalette {
  text: string;
  muted: string;
  grid: string;
  card: string;
  accent1: string;
  accent2: string;
  series: string[];
}

const ACCENT_PAIRS: Record<AccentName, readonly [string, string]> = {
  violet: ['#8b5cf6', '#22d3ee'],
  cyan: ['#06b6d4', '#3b82f6'],
  rose: ['#f43f5e', '#f59e0b'],
  amber: ['#f59e0b', '#ef4444'],
};

const BASE: Record<ThemeMode, Pick<AnalyticsPalette, 'text' | 'muted' | 'grid' | 'card'>> = {
  dark: { text: '#e5e7eb', muted: '#94a3b8', grid: '#232b40', card: '#151b2d' },
  light: { text: '#0f172a', muted: '#64748b', grid: '#e2e8f0', card: '#ffffff' },
};

export function analyticsPalette(mode: ThemeMode, accent: AccentName): AnalyticsPalette {
  const [accent1, accent2] = ACCENT_PAIRS[accent];
  return { ...BASE[mode], accent1, accent2, series: [accent1, accent2, '#ec4899', '#34d399'] };
}

/**
 * Natural Earth names for seed countries whose display name differs from the map's
 * `properties.name` (see `public/geo/world.json`).
 */
export const GEO_NAME_BY_CODE: Readonly<Record<string, string>> = {
  US: 'United States of America',
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const FONT = 'Inter, system-ui, sans-serif';
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat('en-US');
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** Hex `#rrggbb` → `rgba()` with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linear blend of two hex colors (`t` = 0 → `a`, 1 → `b`). */
export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  return `#${ca
    .map((v, i) =>
      Math.round(v + (cb[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linear(horizontal: boolean, stops: readonly string[]) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: horizontal ? 1 : 0,
    y2: horizontal ? 0 : 1,
    colorStops: stops.map((color, i) => ({ offset: i / Math.max(1, stops.length - 1), color })),
  };
}

function tooltip(p: AnalyticsPalette) {
  return {
    backgroundColor: withAlpha(p.card, 0.94),
    borderColor: p.grid,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: p.text, fontFamily: FONT, fontSize: 12 },
    extraCssText: `border-radius: 12px; box-shadow: 0 16px 40px -16px ${withAlpha('#000000', 0.5)};`,
  };
}

function base(p: AnalyticsPalette): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: p.series,
    textStyle: { fontFamily: FONT, color: p.muted },
    animationDuration: 700,
    animationEasing: 'cubicOut',
  };
}

interface TooltipParam {
  name: string;
  value: unknown;
  data?: unknown;
  axisValueLabel?: string;
  seriesName?: string;
  marker?: string;
}

/** Orders by weekday (rows, Monday on top) and hour of day (columns). */
export function heatmapOption(cells: readonly HeatCell[], p: AnalyticsPalette): EChartsOption {
  const max = Math.max(1, ...cells.map((c) => c.orders));
  return {
    ...base(p),
    tooltip: {
      ...tooltip(p),
      formatter: (raw) => {
        const [hour, day, orders] = (raw as TooltipParam).value as [number, number, number];
        const h = String(hour).padStart(2, '0');
        return `<b>${WEEKDAYS[day]} · ${h}:00</b><br/>${num.format(orders)} orders`;
      },
    },
    grid: { top: 8, left: 44, right: 12, bottom: 56 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.muted, interval: 2, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: [...WEEKDAYS],
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 160,
      text: ['More', 'Less'],
      textGap: 8,
      textStyle: { color: p.muted, fontSize: 11 },
      inRange: {
        color: [mix(p.card, p.accent1, 0.1), mix(p.card, p.accent1, 0.55), p.accent1, p.accent2],
      },
    },
    series: [
      {
        type: 'heatmap',
        name: 'Orders',
        data: cells.map((c) => [c.hour, c.weekday, c.orders]),
        itemStyle: { borderColor: p.card, borderWidth: 3, borderRadius: 6 },
        emphasis: {
          itemStyle: { borderColor: p.accent2, shadowBlur: 18, shadowColor: p.accent1 },
        },
        progressive: 0,
      },
    ],
  };
}

/** Revenue choropleth on the `world` map registered from `geo/world.json`. */
export function geoOption(data: readonly GeoSales[], p: AnalyticsPalette): EChartsOption {
  const land = mix(p.card, p.text, 0.07);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  return {
    ...base(p),
    tooltip: {
      ...tooltip(p),
      trigger: 'item',
      formatter: (raw) => {
        const param = raw as TooltipParam;
        const item = param.data as { revenue?: number; orders?: number } | undefined;
        if (!item?.revenue) return `<b>${param.name}</b><br/>No sales yet`;
        return `<b>${param.name}</b><br/>${usd.format(item.revenue)} · ${num.format(item.orders ?? 0)} orders`;
      },
    },
    visualMap: {
      min: 0,
      max,
      left: 12,
      bottom: 8,
      itemWidth: 10,
      itemHeight: 96,
      calculable: false,
      text: ['High', 'Low'],
      textGap: 8,
      textStyle: { color: p.muted, fontSize: 11 },
      inRange: { color: [mix(land, p.accent1, 0.35), p.accent1, p.accent2] },
      formatter: (v) => compactUsd.format(Number(v)),
    },
    series: [
      {
        type: 'map',
        map: 'world',
        name: 'Revenue',
        roam: false,
        top: 8,
        bottom: 8,
        left: 'center',
        itemStyle: { areaColor: land, borderColor: mix(p.card, p.text, 0.18), borderWidth: 0.5 },
        emphasis: {
          label: { show: false },
          itemStyle: {
            areaColor: p.accent2,
            borderColor: p.text,
            shadowBlur: 20,
            shadowColor: withAlpha(p.accent2, 0.8),
          },
        },
        select: { disabled: true },
        data: data.map((d) => ({
          name: GEO_NAME_BY_CODE[d.countryCode] ?? d.country,
          value: d.revenue,
          revenue: d.revenue,
          orders: d.orders,
        })),
      },
    ],
  };
}

/** Visits → paid funnel; steps keep the order the API returns them in. */
export function funnelOption(steps: readonly FunnelStep[], p: AnalyticsPalette): EChartsOption {
  const first = steps[0]?.value || 1;
  const pct = (v: number) => `${((v / first) * 100).toFixed(v / first < 0.1 ? 1 : 0)}%`;
  const last = Math.max(1, steps.length - 1);
  return {
    ...base(p),
    tooltip: {
      ...tooltip(p),
      trigger: 'item',
      formatter: (raw) => {
        const { name, value } = raw as TooltipParam;
        return `<b>${name}</b><br/>${num.format(Number(value))} · ${pct(Number(value))} of visits`;
      },
    },
    series: [
      {
        type: 'funnel',
        name: 'Conversion',
        sort: 'none',
        top: 4,
        bottom: 4,
        left: '4%',
        width: '92%',
        minSize: '30%',
        maxSize: '100%',
        gap: 6,
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 600,
          formatter: (raw) => {
            const { name, value } = raw as TooltipParam;
            return `${name}  ·  ${pct(Number(value))}`;
          },
        },
        labelLine: { show: false },
        emphasis: { label: { fontSize: 13 } },
        data: steps.map((s, i) => {
          const from = mix(p.accent1, p.accent2, i / last);
          const to = mix(p.accent1, p.accent2, Math.min(1, (i + 0.8) / last));
          return {
            name: s.step,
            value: s.value,
            itemStyle: {
              color: linear(true, [from, to]),
              borderWidth: 0,
              shadowBlur: 24,
              shadowColor: withAlpha(from, 0.35),
            },
          };
        }),
      },
    ],
  };
}

/** Revenue as a glowing area with orders as faint bars on a secondary axis. */
export function revenueOption(points: readonly TimePoint[], p: AnalyticsPalette): EChartsOption {
  const monthly = points.length > 1 && points.every((pt) => pt.date.endsWith('-01'));
  const label = (d: string) => (monthly ? monthLabel : dayLabel).format(new Date(`${d}T00:00:00Z`));
  return {
    ...base(p),
    grid: { top: 16, left: 8, right: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip(p),
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: withAlpha(p.accent1, 0.6), width: 1 } },
      formatter: (raw) => {
        const list = raw as TooltipParam[];
        const head = list[0] ? label(String(list[0].axisValueLabel ?? list[0].name)) : '';
        const rows = list.map((s) => {
          const v = Number(s.value);
          const text = s.seriesName === 'Revenue' ? usd.format(v) : num.format(v);
          return `${s.marker ?? ''}${s.seriesName} <b style="float:right;margin-left:16px">${text}</b>`;
        });
        return [`<b>${head}</b>`, ...rows].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((pt) => pt.date),
      boundaryGap: false,
      axisLine: { lineStyle: { color: p.grid } },
      axisTick: { show: false },
      axisLabel: { color: p.muted, fontSize: 11, hideOverlap: true, formatter: label },
    },
    yAxis: [
      {
        type: 'value',
        splitNumber: 4,
        splitLine: { lineStyle: { color: p.grid, type: 'dashed' } },
        axisLabel: { color: p.muted, fontSize: 11, formatter: (v: number) => compactUsd.format(v) },
      },
      {
        type: 'value',
        splitNumber: 4,
        splitLine: { show: false },
        axisLabel: { show: false },
      },
    ],
    series: [
      {
        type: 'line',
        name: 'Revenue',
        data: points.map((pt) => pt.revenue),
        smooth: 0.35,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 8,
        z: 3,
        lineStyle: {
          width: 3,
          color: linear(true, [p.accent1, p.accent2]),
          shadowBlur: 16,
          shadowColor: withAlpha(p.accent1, 0.55),
          shadowOffsetY: 6,
        },
        itemStyle: { color: p.accent1, borderColor: p.card, borderWidth: 2 },
        areaStyle: {
          color: linear(false, [withAlpha(p.accent1, 0.38), withAlpha(p.accent1, 0)]),
        },
      },
      {
        type: 'bar',
        name: 'Orders',
        yAxisIndex: 1,
        data: points.map((pt) => pt.orders),
        barMaxWidth: 10,
        z: 1,
        itemStyle: { color: withAlpha(p.accent2, 0.22), borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: withAlpha(p.accent2, 0.5) } },
      },
    ],
  };
}
