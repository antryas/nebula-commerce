import { Injectable, Injector, inject, signal } from '@angular/core';

/** Handle returned by the lazily loaded palette renderer. */
export interface PaletteHandle {
  dispose(): void;
}

/**
 * Opens and closes the command palette. The overlay component (and CDK Overlay with it)
 * is imported on first use so it stays out of the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly injector = inject(Injector);
  private readonly _isOpen = signal(false);
  private handle: PaletteHandle | null = null;
  /** Bumped on every open/close so a slow import can tell it has been superseded. */
  private generation = 0;

  readonly isOpen = this._isOpen.asReadonly();

  open(): void {
    if (this._isOpen()) return;
    this._isOpen.set(true);
    const generation = ++this.generation;
    void import('./command-palette').then(({ attachCommandPalette }) => {
      if (generation !== this.generation || !this._isOpen()) return;
      this.handle = attachCommandPalette(this.injector, () => this.close());
    });
  }

  close(): void {
    this.generation++;
    this._isOpen.set(false);
    this.handle?.dispose();
    this.handle = null;
  }

  toggle(): void {
    if (this._isOpen()) this.close();
    else this.open();
  }
}
