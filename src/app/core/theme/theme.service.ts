import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';
export type AccentName = 'violet' | 'cyan' | 'rose' | 'amber';

export const THEME_MODES: readonly ThemeMode[] = ['dark', 'light'];
export const ACCENT_NAMES: readonly AccentName[] = ['violet', 'cyan', 'rose', 'amber'];

const STORAGE_KEY = 'nebula.theme';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface StoredTheme {
  mode?: ThemeMode;
  accent?: AccentName;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly stored = readStored();
  private readonly _mode = signal<ThemeMode>(this.stored.mode ?? 'dark');
  private readonly _accent = signal<AccentName>(this.stored.accent ?? 'violet');
  private readonly _reducedMotion = signal(false);

  readonly mode = this._mode.asReadonly();
  readonly accent = this._accent.asReadonly();
  readonly reducedMotion = this._reducedMotion.asReadonly();

  constructor() {
    const query = this.doc.defaultView?.matchMedia?.(REDUCED_MOTION_QUERY);
    if (query) {
      this._reducedMotion.set(query.matches);
      query.addEventListener?.('change', (e) => this._reducedMotion.set(e.matches));
    }

    effect(() => {
      const mode = this._mode();
      const accent = this._accent();
      const root = this.doc.documentElement;
      root.classList.toggle('dark', mode === 'dark');
      root.classList.toggle('light', mode === 'light');
      root.style.colorScheme = mode;
      root.dataset['accent'] = accent;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent }));
      } catch {
        /* storage unavailable */
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
  }

  toggleMode(): void {
    this._mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  setAccent(accent: AccentName): void {
    this._accent.set(accent);
  }
}

function readStored(): StoredTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const { mode, accent } = parsed as Record<string, unknown>;
    return {
      mode: THEME_MODES.includes(mode as ThemeMode) ? (mode as ThemeMode) : undefined,
      accent: ACCENT_NAMES.includes(accent as AccentName) ? (accent as AccentName) : undefined,
    };
  } catch {
    return {};
  }
}
