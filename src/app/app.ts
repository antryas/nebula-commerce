import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuroraBackground } from './core/layout/aurora-background';
import { ACCENT_NAMES, ThemeService } from './core/theme/theme.service';
import { GlassCard } from './shared/ui/glass-card';
import { GradientBorder } from './shared/ui/gradient-border';

@Component({
  selector: 'app-root',
  imports: [AuroraBackground, GlassCard, GradientBorder],
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly accents = ACCENT_NAMES;
}
