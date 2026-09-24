import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuroraBackground } from './core/layout/aurora-background';
import { ToastHost } from './core/notifications/toast-host';
import { ACCENT_NAMES, ThemeService } from './core/theme/theme.service';
import { ApiError, Kpi, OrderStatus } from './models';
import { CompactCurrencyPipe } from './shared/pipes/compact-currency';
import { RelativeTimePipe } from './shared/pipes/relative-time';
import { Avatar } from './shared/ui/avatar';
import { EmptyState } from './shared/ui/empty-state';
import { ErrorState } from './shared/ui/error-state';
import { GlassCard } from './shared/ui/glass-card';
import { GradientBorder } from './shared/ui/gradient-border';
import { KpiCard } from './shared/ui/kpi-card';
import { PageHeader } from './shared/ui/page-header';
import { Skeleton } from './shared/ui/skeleton';
import { STATUS_META, StatusChip } from './shared/ui/status-chip';

@Component({
  selector: 'app-root',
  imports: [
    AuroraBackground,
    Avatar,
    CompactCurrencyPipe,
    EmptyState,
    ErrorState,
    GlassCard,
    GradientBorder,
    KpiCard,
    PageHeader,
    RelativeTimePipe,
    Skeleton,
    StatusChip,
    ToastHost,
  ],
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly accents = ACCENT_NAMES;

  // Temporary preview data for the shared UI kit; removed with this page in Task 8.
  protected readonly statuses = Object.keys(STATUS_META) as OrderStatus[];
  protected readonly recent = new Date(Date.now() - 5 * 60_000);
  protected readonly demoError: ApiError = {
    status: 500,
    code: 'server_error',
    message: 'The server hiccuped. Please try again.',
  };
  protected readonly kpis: Kpi[] = [
    kpi('revenue', 'Revenue', 128420, 12.4, 'currency', [8, 9, 7, 11, 10, 13, 12, 15]),
    kpi('orders', 'Orders', 1284, 6.1, 'number', [30, 34, 29, 38, 41, 39, 44, 47]),
    kpi('aov', 'Avg order value', 100.02, -2.3, 'currency', [110, 108, 104, 106, 101, 103, 100]),
    kpi('conversion', 'Conversion', 3.42, 0.8, 'percent', [3.1, 3.2, 3.0, 3.3, 3.35, 3.42]),
  ];
}

function kpi(
  key: Kpi['key'],
  label: string,
  value: number,
  deltaPct: number,
  format: Kpi['format'],
  spark: number[],
): Kpi {
  return { key, label, value, previous: value / (1 + deltaPct / 100), deltaPct, spark, format };
}
