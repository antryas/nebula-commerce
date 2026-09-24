import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block with optional subtitle and right-aligned projected actions. */
@Component({
  selector: 'nb-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input; drop the static attribute so it doesn't become a native tooltip.
  host: {
    class: 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6',
    '[attr.title]': 'null',
  },
  template: `
    <div class="min-w-0">
      <h1 class="nb-page-header__title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="nb-page-header__subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="nb-page-header__actions">
      <ng-content />
    </div>
  `,
  styles: `
    .nb-page-header__title {
      margin: 0;
      font-size: 1.625rem;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: var(--nb-text);
    }
    .nb-page-header__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      color: var(--nb-muted);
    }
    .nb-page-header__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .nb-page-header__actions:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
