import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Order } from '../../models';
import { AuthService } from '../auth/auth.service';
import { errorInterceptor } from '../http/error.interceptor';
import { ToastService } from '../notifications/toast.service';
import { LiveOrdersService } from './live-orders.service';

const ORDER = {
  id: 'ord_000900',
  number: 1900,
  customerName: 'Ada Lovelace',
  total: 1234.5,
} as Order;

describe('LiveOrdersService', () => {
  let ctrl: HttpTestingController;
  let authenticated: WritableSignal<boolean>;
  let announce: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Deterministic cadence: every tick lands just before 10 s (the max delay).
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    authenticated = signal(true);
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: authenticated } },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ticks = () => ctrl.match({ method: 'POST', url: '/api/live/tick' });

  it('is enabled by default outside screenshot mode', () => {
    const s = TestBed.inject(LiveOrdersService);
    expect(s.enabled()).toBe(true);
    expect(s.latest()).toBeNull();
    expect(s.count()).toBe(0);
  });

  it('does nothing until started', () => {
    TestBed.inject(LiveOrdersService);
    vi.advanceTimersByTime(30_000);
    expect(ticks()).toHaveLength(0);
  });

  it('posts a tick within 6-10 s and publishes the new order', () => {
    const s = TestBed.inject(LiveOrdersService);
    const toasts = TestBed.inject(ToastService);
    vi.mocked(Math.random).mockReturnValue(0); // shortest delay: 6 s
    s.start();
    vi.advanceTimersByTime(5_999);
    expect(ticks()).toHaveLength(0);
    vi.advanceTimersByTime(4_001);
    const reqs = ticks();
    expect(reqs).toHaveLength(1);

    reqs[0].flush(ORDER, { status: 201, statusText: 'Created' });
    expect(s.latest()).toEqual(ORDER);
    expect(s.count()).toBe(1);
    expect(toasts.toasts()[0]).toMatchObject({
      kind: 'order',
      title: 'New order #1900',
      message: 'Ada Lovelace · $1,234.50',
    });
    // The toast host's aria-live region announces it; no second LiveAnnouncer message.
    expect(announce).not.toHaveBeenCalled();
  });

  it('keeps ticking while running and stop() prevents further requests', () => {
    const s = TestBed.inject(LiveOrdersService);
    s.start();
    vi.advanceTimersByTime(10_000);
    ticks()[0].flush(ORDER);
    vi.advanceTimersByTime(10_000);
    ticks()[0].flush({ ...ORDER, number: 1901 });
    expect(s.count()).toBe(2);
    expect(s.latest()?.number).toBe(1901);

    s.stop();
    vi.advanceTimersByTime(60_000);
    expect(ticks()).toHaveLength(0);
  });

  it('start() twice does not double the rate', () => {
    const s = TestBed.inject(LiveOrdersService);
    s.start();
    s.start();
    vi.advanceTimersByTime(10_000);
    expect(ticks()).toHaveLength(1);
  });

  it('skips ticks while disabled or signed out', () => {
    const s = TestBed.inject(LiveOrdersService);
    s.start();
    s.enabled.set(false);
    vi.advanceTimersByTime(30_000);
    expect(ticks()).toHaveLength(0);

    s.enabled.set(true);
    authenticated.set(false);
    vi.advanceTimersByTime(30_000);
    expect(ticks()).toHaveLength(0);

    authenticated.set(true);
    vi.advanceTimersByTime(10_000);
    expect(ticks()).toHaveLength(1);
  });

  it('survives a failed tick silently and keeps going', () => {
    const s = TestBed.inject(LiveOrdersService);
    const toasts = TestBed.inject(ToastService);
    s.start();
    vi.advanceTimersByTime(10_000);
    ticks()[0].flush(null, { status: 500, statusText: 'x' });
    expect(s.count()).toBe(0);
    expect(toasts.toasts()).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(ticks()).toHaveLength(1);
  });
});
