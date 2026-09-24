import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a toast and returns its id', () => {
    const s = TestBed.inject(ToastService);
    const id = s.show({ kind: 'info', title: 'Hello', message: 'World' });
    expect(s.toasts()).toEqual([
      { id, kind: 'info', title: 'Hello', message: 'World', durationMs: 4000 },
    ]);
  });

  it('keeps at most 4 toasts', () => {
    const s = TestBed.inject(ToastService);
    for (let i = 0; i < 6; i++) s.show({ kind: 'info', title: `t${i}`, durationMs: 0 });
    expect(s.toasts().map((t) => t.title)).toEqual(['t2', 't3', 't4', 't5']);
  });

  it('auto-dismisses after duration', () => {
    vi.useFakeTimers();
    const s = TestBed.inject(ToastService);
    s.success('Saved');
    vi.advanceTimersByTime(3999);
    expect(s.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(s.toasts()).toHaveLength(0);
  });

  it('keeps sticky toasts (durationMs 0) until dismissed', () => {
    vi.useFakeTimers();
    const s = TestBed.inject(ToastService);
    const id = s.show({ kind: 'order', title: 'Sticky', durationMs: 0 });
    vi.advanceTimersByTime(60_000);
    expect(s.toasts()).toHaveLength(1);
    s.dismiss(id);
    expect(s.toasts()).toHaveLength(0);
  });

  it('success and error helpers set the kind', () => {
    const s = TestBed.inject(ToastService);
    s.success('Saved', 'All good');
    s.error('Failed');
    expect(s.toasts().map((t) => [t.kind, t.title, t.message])).toEqual([
      ['success', 'Saved', 'All good'],
      ['error', 'Failed', undefined],
    ]);
  });

  it('dismissing an unknown id is a no-op', () => {
    const s = TestBed.inject(ToastService);
    s.success('Saved');
    s.dismiss('nope');
    expect(s.toasts()).toHaveLength(1);
  });
});
