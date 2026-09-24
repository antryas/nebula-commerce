import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'order';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  /** Auto-dismiss delay; 0 keeps the toast until dismissed. */
  durationMs: number;
}

export interface ToastOptions {
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
}

export const DEFAULT_TOAST_DURATION_MS = 4000;
export const MAX_TOASTS = 4;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private nextId = 0;

  /** Visible toasts, oldest first. */
  readonly toasts = this._toasts.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach((t) => clearTimeout(t));
      this.timers.clear();
    });
  }

  show(options: ToastOptions): string {
    const id = `toast-${++this.nextId}`;
    const toast: Toast = {
      id,
      kind: options.kind,
      title: options.title,
      durationMs: options.durationMs ?? DEFAULT_TOAST_DURATION_MS,
    };
    if (options.message !== undefined) toast.message = options.message;

    const next = [...this._toasts(), toast];
    for (const dropped of next.splice(0, Math.max(0, next.length - MAX_TOASTS))) {
      this.clearTimer(dropped.id);
    }
    this._toasts.set(next);

    if (toast.durationMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), toast.durationMs),
      );
    }
    return id;
  }

  success(title: string, message?: string): string {
    return this.show({ kind: 'success', title, message });
  }

  error(title: string, message?: string): string {
    return this.show({ kind: 'error', title, message });
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this._toasts.update((list) =>
      list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list,
    );
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
