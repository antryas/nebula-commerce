import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';
import { DemoApi } from '../../core/api/demo-api';
import { APP_NAME, APP_VERSION, REPO_URL } from '../../core/app-info';
import { AuthService } from '../../core/auth/auth.service';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { ToastService } from '../../core/notifications/toast.service';
import { AccentName, ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { Stagger } from '../../shared/directives/stagger';
import { Avatar } from '../../shared/ui/avatar';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';

export interface AccentPreset {
  name: AccentName;
  label: string;
  from: string;
  to: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { name: 'violet', label: 'Violet', from: '#8b5cf6', to: '#22d3ee' },
  { name: 'cyan', label: 'Cyan', from: '#06b6d4', to: '#3b82f6' },
  { name: 'rose', label: 'Rose', from: '#f43f5e', to: '#f59e0b' },
  { name: 'amber', label: 'Amber', from: '#f59e0b', to: '#ef4444' },
];

const MODES: readonly { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'light', label: 'Light', icon: 'light_mode' },
];

const STACK = ['Angular 22', 'Signals', 'Angular Material', 'Tailwind CSS 4', 'ECharts 6'];

/** Preview bar heights (percent) for the live accent preview. */
const PREVIEW_BARS = [38, 62, 45, 80, 58, 92, 70];

@Component({
  selector: 'nb-settings-page',
  imports: [Avatar, GlassCard, PageHeader, ReactiveFormsModule, Stagger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly auth = inject(AuthService);
  private readonly demo = inject(DemoApi);
  private readonly toasts = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  protected readonly theme = inject(ThemeService);
  protected readonly live = inject(LiveOrdersService);

  protected readonly accents = ACCENT_PRESETS;
  protected readonly modes = MODES;
  protected readonly stack = STACK;
  protected readonly bars = PREVIEW_BARS;
  protected readonly appName = APP_NAME;
  protected readonly version = APP_VERSION;
  protected readonly repoUrl = REPO_URL;

  private readonly user = this.auth.user();
  protected readonly avatarUrl = this.user?.avatarUrl ?? '';

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.user?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    email: [this.user?.email ?? '', [Validators.required, Validators.email]],
  });
  protected readonly previewName = toSignal(
    this.form.controls.name.valueChanges.pipe(
      startWith(this.form.controls.name.value),
      map((n) => n.trim()),
    ),
    { initialValue: '' },
  );

  protected readonly resetting = signal(false);

  protected saveProfile(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.form.markAsPristine();
    this.toasts.success('Profile saved', 'Your changes are stored for this demo session.');
  }

  protected invalid(field: 'name' | 'email'): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected setAccent(accent: AccentName): void {
    this.theme.setAccent(accent);
  }

  protected toggleLive(): void {
    this.live.enabled.update((on) => !on);
  }

  protected resetDemo(): void {
    const confirmed = this.doc.defaultView?.confirm(
      'Reset all demo data? Orders, products and customers return to their initial state.',
    );
    if (!confirmed || this.resetting()) return;
    this.resetting.set(true);
    this.demo
      .reset()
      .pipe(finalize(() => this.resetting.set(false)))
      .subscribe({
        next: () => this.toasts.success('Demo data reset'),
        // The error interceptor already shows a toast for failed mutations.
        error: () => undefined,
      });
  }
}
