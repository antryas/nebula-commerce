import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Fixed, decorative full-screen layer of slowly drifting blurred accent blobs. */
@Component({
  selector: 'nb-aurora-background',
  template: `
    <div class="nb-aurora-blob nb-aurora-blob--1"></div>
    <div class="nb-aurora-blob nb-aurora-blob--2"></div>
    <div class="nb-aurora-blob nb-aurora-blob--3"></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background: var(--nb-bg);
    }
    .nb-aurora-blob {
      position: absolute;
      width: 42vmax;
      height: 42vmax;
      border-radius: 9999px;
      filter: blur(90px);
      opacity: var(--nb-aurora-opacity, 0.35);
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
      will-change: transform;
    }
    .nb-aurora-blob--1 {
      top: -12vmax;
      left: -8vmax;
      background: var(--nb-accent-1);
      animation-name: nb-aurora-drift-1;
      animation-duration: 18s;
    }
    .nb-aurora-blob--2 {
      top: 20vh;
      right: -14vmax;
      background: var(--nb-accent-2);
      animation-name: nb-aurora-drift-2;
      animation-duration: 22s;
    }
    .nb-aurora-blob--3 {
      bottom: -18vmax;
      left: 25vw;
      background: #ec4899;
      animation-name: nb-aurora-drift-3;
      animation-duration: 26s;
    }
    @keyframes nb-aurora-drift-1 {
      to {
        transform: translate(18vw, 14vh) scale(1.15);
      }
    }
    @keyframes nb-aurora-drift-2 {
      to {
        transform: translate(-16vw, 18vh) scale(0.9);
      }
    }
    @keyframes nb-aurora-drift-3 {
      to {
        transform: translate(12vw, -16vh) scale(1.1);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .nb-aurora-blob {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class AuroraBackground {}
