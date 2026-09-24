import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

const round = (n: number) => String(Math.round(n * 100) / 100);

interface Point {
  x: number;
  y: number;
}

function toPoints(data: readonly number[], width: number, height: number, pad: number): Point[] {
  if (data.length === 0) return [];
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const mid = height / 2;
  if (data.length === 1) {
    return [
      { x: pad, y: mid },
      { x: width - pad, y: mid },
    ];
  }
  const min = Math.min(...data);
  const range = Math.max(...data) - min;
  const stepX = innerW / (data.length - 1);
  return data.map((v, i) => ({
    x: pad + i * stepX,
    y: range === 0 ? mid : pad + innerH * (1 - (v - min) / range),
  }));
}

/**
 * Maps a series to SVG polyline points inside a `width` x `height` box with `pad` inset:
 * the minimum lands on the bottom edge, the maximum on the top; flat series sit mid-height.
 */
export function sparklinePoints(
  data: readonly number[],
  width: number,
  height: number,
  pad = 2,
): string {
  return toPoints(data, width, height, pad)
    .map((p) => `${round(p.x)},${round(p.y)}`)
    .join(' ');
}

let nextId = 0;

/** Tiny inline trend line with a soft gradient area, tinted success or danger. */
@Component({
  selector: 'nb-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-sparkline',
    '[class.nb-sparkline--negative]': '!positive()',
  },
  template: `
    <svg
      role="img"
      [attr.aria-label]="ariaLabel()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      [attr.width]="width()"
      [attr.height]="height()"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="nb-sparkline__stop-top" />
          <stop offset="100%" class="nb-sparkline__stop-bottom" />
        </linearGradient>
      </defs>
      @if (points()) {
        <path class="nb-sparkline__area" [attr.d]="areaPath()" [attr.fill]="gradientFill" />
        <polyline class="nb-sparkline__line" [attr.points]="points()" />
        @if (last(); as p) {
          <circle class="nb-sparkline__dot" [attr.cx]="p.x" [attr.cy]="p.y" r="2" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
      color: var(--nb-success);
    }
    :host(.nb-sparkline--negative) {
      color: var(--nb-danger);
    }
    svg {
      overflow: visible;
    }
    .nb-sparkline__stop-top {
      stop-color: currentColor;
      stop-opacity: 0.32;
    }
    .nb-sparkline__stop-bottom {
      stop-color: currentColor;
      stop-opacity: 0;
    }
    .nb-sparkline__line {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      filter: drop-shadow(0 2px 4px color-mix(in srgb, currentColor 45%, transparent));
    }
    .nb-sparkline__dot {
      fill: currentColor;
      stroke: var(--nb-card);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
  `,
})
export class Sparkline {
  readonly data = input<readonly number[]>([]);
  readonly width = input(96, { transform: numberAttribute });
  readonly height = input(32, { transform: numberAttribute });
  readonly positive = input(true, { transform: booleanAttribute });
  /** Overrides the generated accessible description. */
  readonly label = input<string>();

  protected readonly gradientId = `nb-sparkline-${nextId++}`;
  protected readonly gradientFill = `url(#${this.gradientId})`;

  private readonly coords = computed(() => toPoints(this.data(), this.width(), this.height(), 2));

  protected readonly points = computed(() =>
    sparklinePoints(this.data(), this.width(), this.height()),
  );

  protected readonly last = computed(() => {
    const c = this.coords();
    return this.data().length > 1 ? c[c.length - 1] : null;
  });

  protected readonly areaPath = computed(() => {
    const c = this.coords();
    if (c.length === 0) return '';
    const h = this.height();
    const line = c.map((p) => `L${round(p.x)},${round(p.y)}`).join(' ');
    return `M${round(c[0].x)},${h} ${line} L${round(c[c.length - 1].x)},${h} Z`;
  });

  protected readonly ariaLabel = computed(
    () =>
      this.label() ??
      `Trend over ${this.data().length} periods, ${this.positive() ? 'rising' : 'falling'}`,
  );
}
