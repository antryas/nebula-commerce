import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { Order } from '../../models';
import { LiveApi } from '../api/live-api';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../notifications/toast.service';

const MIN_DELAY_MS = 6000;
const MAX_DELAY_MS = 10_000;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Simulated real-time order feed. While running, it asks the backend for a new order every
 * 6-10 s (only when `enabled` and signed in), then toasts and announces it.
 */
@Injectable({ providedIn: 'root' })
export class LiveOrdersService {
  private readonly api = inject(LiveApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly announcer = inject(LiveAnnouncer);

  private readonly _latest = signal<Order | null>(null);
  private readonly _count = signal(0);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private request: Subscription | null = null;
  private inFlight = false;
  private running = false;

  /** User preference; off by default in `?screenshot=1` mode for clean captures. */
  readonly enabled = signal(!isScreenshotMode(inject(DOCUMENT)));
  /** Most recent live order. */
  readonly latest = this._latest.asReadonly();
  /** Live orders received during this session. */
  readonly count = this._count.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.request?.unsubscribe();
    this.request = null;
  }

  private schedule(): void {
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick(): void {
    this.timer = null;
    if (!this.running) return;
    if (this.enabled() && this.auth.isAuthenticated() && !this.inFlight) {
      this.inFlight = true;
      this.request = this.api
        .tick()
        .pipe(finalize(() => (this.inFlight = false)))
        .subscribe({
          next: (order) => this.publish(order),
          // Background feed: a failed tick is skipped silently, the next one retries.
          error: () => undefined,
        });
    }
    this.schedule();
  }

  private publish(order: Order): void {
    this._latest.set(order);
    this._count.update((n) => n + 1);
    const total = usd.format(order.total);
    this.toasts.show({
      kind: 'order',
      title: `New order #${order.number}`,
      message: `${order.customerName} · ${total}`,
    });
    void this.announcer.announce(
      `New order #${order.number} from ${order.customerName}, ${total}`,
      'polite',
    );
  }
}

function isScreenshotMode(doc: Document): boolean {
  return doc.defaultView?.location.search.includes('screenshot') ?? false;
}
