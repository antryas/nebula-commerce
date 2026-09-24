import { Signal, computed, inject } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { AccentName, ThemeMode, ThemeService } from '../../core/theme/theme.service';
import type { CategorySales, RevenueRange, TimePoint } from '../../models';

/**
 * Accent presets as hex pairs. Duplicates `styles/_tokens.scss` on purpose: charts render
 * to canvas, which cannot resolve CSS custom properties.
 */
export const ACCENTS: Record<AccentName, [string, string]> = {
  violet: ['#8b5cf6', '#22d3ee'],
  cyan: ['#06b6d4', '#3b82f6'],
  rose: ['#f43f5e', '#f59e0b'],
  amber: ['#f59e0b', '#ef4444'],
};

/** Supporting hues appended after the accents for multi-series charts. */
const EXTRA_SERIES = ['#818cf8', '#34d399', '#f472b6', '#38bdf8', '#f59e0b', '#a3e635', '#fb923c'];

const SURFACES: Record<ThemeMode, { text: string; muted: string; grid: string; card: string }> = {
  dark: { text: '#e5e7eb', muted: '#94a3b8', grid: '#232b40', card: '#151b2d' },
  light: { text: '#0f172a', muted: '#64748b', grid: '#e2e8f0', card: '#ffffff' },
};

export interface ChartPalette {
  mode: ThemeMode;
  text: string;
  muted: string;
  grid: string;
  /** Card surface; used to carve gaps between donut segments. */
  card: string;
  accent1: string;
  accent2: string;
  /** Categorical colors: the two accents first, then non-repeating supporting hues. */
  series: string[];
  /** False under reduced motion; `baseOption` turns chart animation off. */
  animate?: boolean;
}

export function chartPalette(mode: ThemeMode, accent: AccentName): ChartPalette {
  const [accent1, accent2] = ACCENTS[accent];
  const series = [accent1, accent2];
  for (const c of EXTRA_SERIES) if (!series.includes(c)) series.push(c);
  return { mode, ...SURFACES[mode], accent1, accent2, series };
}

/** Palette that follows the active theme mode, accent and motion preference. */
export function injectChartPalette(): Signal<ChartPalette> {
  const theme = inject(ThemeService);
  return computed(() => ({
    ...chartPalette(theme.mode(), theme.accent()),
    animate: !theme.reducedMotion(),
  }));
}

/** `#8b5cf6` + 0.45 → `rgba(139,92,246,0.45)`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const FONT = 'Inter, system-ui, sans-serif';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const COMPACT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const DAY_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** Shared look: transparent canvas, Inter, muted axes, dashed grid, glass tooltip. */
export function baseOption(p: ChartPalette): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: p.series,
    textStyle: { fontFamily: FONT, color: p.text },
    animation: p.animate !== false,
    animationDuration: 900,
    animationEasing: 'cubicOut',
    tooltip: {
      backgroundColor: p.mode === 'dark' ? 'rgba(15,20,34,.85)' : 'rgba(255,255,255,.92)',
      borderColor: withAlpha(p.accent1, 0.45),
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { fontFamily: FONT, fontSize: 12, color: p.text },
      extraCssText: `backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 12px 32px -12px ${withAlpha(p.accent1, 0.55)};`,
    },
  };
}

/** Axis defaults matching `baseOption`: muted labels, no ticks, dashed split lines. */
function valueAxis(p: ChartPalette, extra: Record<string, unknown> = {}) {
  return {
    type: 'value' as const,
    axisLabel: { color: p.muted, fontSize: 11 },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: p.grid, type: 'dashed' as const } },
    ...extra,
  };
}

function bucketLabel(date: string, range: RevenueRange): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return range === '12m' ? MONTH_LABEL.format(d) : DAY_LABEL.format(d);
}

interface AxisTooltipParam {
  axisValueLabel?: string;
  seriesName?: string;
  value?: unknown;
  color?: unknown;
}

function tooltipRow(color: string, label: string, value: string, muted: string): string {
  return (
    `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">` +
    `<span style="width:8px;height:8px;border-radius:9999px;background:${color}"></span>` +
    `<span style="color:${muted}">${label}</span>` +
    `<b style="margin-left:auto;padding-left:16px;font-variant-numeric:tabular-nums">${value}</b></div>`
  );
}

/** Glowing smooth revenue line over a gradient area, with orders as faint bars behind it. */
export function revenueAreaOption(
  points: TimePoint[],
  p: ChartPalette,
  range: RevenueRange = '30d',
): EChartsOption {
  const base = baseOption(p);
  return {
    ...base,
    grid: { left: 4, right: 4, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      ...(base.tooltip as object),
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: withAlpha(p.accent1, 0.6), width: 1, type: 'dashed' },
      },
      formatter: (raw: unknown) => {
        const params = (Array.isArray(raw) ? raw : [raw]) as AxisTooltipParam[];
        const revenue = Number(params.find((x) => x.seriesName === 'Revenue')?.value ?? 0);
        const orders = Number(params.find((x) => x.seriesName === 'Orders')?.value ?? 0);
        return (
          `<div style="font-weight:600;margin-bottom:2px">${params[0]?.axisValueLabel ?? ''}</div>` +
          tooltipRow(p.accent1, 'Revenue', USD.format(revenue), p.muted) +
          tooltipRow(p.accent2, 'Orders', String(orders), p.muted)
        );
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: points.map((pt) => bucketLabel(pt.date, range)),
      axisLabel: { color: p.muted, fontSize: 11, hideOverlap: true },
      axisLine: { lineStyle: { color: p.grid } },
      axisTick: { show: false },
    },
    yAxis: [
      valueAxis(p, {
        axisLabel: {
          color: p.muted,
          fontSize: 11,
          formatter: (v: number) => COMPACT_USD.format(v),
        },
      }),
      valueAxis(p, { show: false, splitLine: { show: false } }),
    ],
    series: [
      {
        name: 'Revenue',
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 9,
        z: 3,
        data: points.map((pt) => pt.revenue),
        lineStyle: {
          width: 3,
          color: p.accent1,
          shadowBlur: 18,
          shadowColor: p.accent1,
          shadowOffsetY: 6,
          cap: 'round',
        },
        itemStyle: { color: p.accent1, borderColor: p.card, borderWidth: 2 },
        emphasis: { focus: 'none', scale: 1.4 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(p.accent1, 0.45) },
              { offset: 1, color: withAlpha(p.accent1, 0) },
            ],
          },
        },
      },
      {
        name: 'Orders',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 14,
        z: 1,
        data: points.map((pt) => pt.orders),
        itemStyle: { color: p.accent2, opacity: 0.25, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { opacity: 0.45 } },
      },
    ],
  };
}

/** Rounded category ring with the total revenue in the middle. */
export function donutOption(data: CategorySales[], p: ChartPalette): EChartsOption {
  const base = baseOption(p);
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      trigger: 'item',
      formatter: (raw: unknown) => {
        const x = raw as { name: string; value: number; percent: number; color: string };
        return (
          `<div style="font-weight:600">${x.name}</div>` +
          tooltipRow(x.color, `${x.percent.toFixed(1)}%`, USD.format(x.value), p.muted)
        );
      },
    },
    title: {
      text: COMPACT_USD.format(total),
      subtext: 'Total revenue',
      left: 'center',
      top: 'center',
      itemGap: 4,
      textStyle: { color: p.text, fontFamily: FONT, fontSize: 22, fontWeight: 700 },
      subtextStyle: { color: p.muted, fontFamily: FONT, fontSize: 11 },
    },
    series: [
      {
        name: 'Revenue by category',
        type: 'pie',
        radius: ['62%', '82%'],
        center: ['50%', '50%'],
        padAngle: 1,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderRadius: 8, borderWidth: 3, borderColor: p.card },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 20, shadowColor: withAlpha(p.accent1, 0.5) },
        },
        data: data.map((d) => ({ name: d.category, value: d.revenue })),
      },
    ],
  };
}
