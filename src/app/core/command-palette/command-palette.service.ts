import { DOCUMENT, Injectable, Injector, inject, signal } from '@angular/core';

/** Handle returned by the lazily loaded palette renderer. */
export interface PaletteHandle {
  dispose(): void;
}

type PaletteModule = typeof import('./command-palette');

/**
 * Opens and closes the command palette. The overlay component (and CDK Overlay with it)
 * is imported on first use so it stays out of the initial bundle; `preload()` fetches it
 * ahead of time (the shell calls it once the page is idle).
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly injector = inject(Injector);
  private readonly doc = inject(DOCUMENT);
  private readonly _isOpen = signal(false);
  private handle: PaletteHandle | null = null;
  private module: Promise<PaletteModule> | null = null;
  /** Bumped on every open/close so a slow import can tell it has been superseded. */
  private generation = 0;
  private stopBuffering: (() => string) | null = null;

  readonly isOpen = this._isOpen.asReadonly();

  /** Starts loading the palette chunk without opening it. Safe to call repeatedly. */
  preload(): Promise<PaletteModule> {
    this.module ??= import('./command-palette').catch((e: unknown) => {
      this.module = null; // allow a retry, e.g. after a flaky network
      throw e;
    });
    return this.module;
  }

  open(): void {
    if (this._isOpen()) return;
    this._isOpen.set(true);
    const generation = ++this.generation;
    // Until the input mounts, keep what the user types right after the shortcut.
    this.stopBuffering = this.bufferKeys();
    void this.preload().then(
      ({ attachCommandPalette }) => {
        if (generation !== this.generation || !this._isOpen()) return;
        // The palette takes the buffered text once its input is rendered and focused.
        const takeTyped = () => {
          const typed = this.stopBuffering?.() ?? '';
          this.stopBuffering = null;
          return typed;
        };
        this.handle = attachCommandPalette(this.injector, () => this.close(), takeTyped);
      },
      () => this.close(),
    );
  }

  close(): void {
    this.generation++;
    this._isOpen.set(false);
    this.stopBuffering?.();
    this.stopBuffering = null;
    this.handle?.dispose();
    this.handle = null;
  }

  toggle(): void {
    if (this._isOpen()) this.close();
    else this.open();
  }

  /** Captures printable keys document-wide; the returned function stops and returns them. */
  private bufferKeys(): () => string {
    let typed = '';
    const onKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') typed = typed.slice(0, -1);
      else if (e.key.length === 1) typed += e.key;
      else return;
      // Keep the keystroke from landing in whatever had focus behind the palette.
      e.preventDefault();
    };
    this.doc.addEventListener('keydown', onKeydown, true);
    return () => {
      this.doc.removeEventListener('keydown', onKeydown, true);
      return typed;
    };
  }
}
