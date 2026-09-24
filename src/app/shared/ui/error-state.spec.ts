import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models';
import { ErrorState } from './error-state';

@Component({
  imports: [ErrorState],
  template: `<nb-error-state [error]="error" (retry)="retries.set(retries() + 1)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly error: ApiError = { status: 500, code: 'server_error', message: 'Upstream exploded' };
  readonly retries = signal(0);
}

describe('ErrorState', () => {
  it('shows the error message as an alert and emits retry', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('Upstream exploded');
    expect(el.textContent).toContain('500');
    (el.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.retries()).toBe(1);
  });
});
