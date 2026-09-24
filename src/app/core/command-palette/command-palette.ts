import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  createBlockScrollStrategy,
  createGlobalPositionStrategy,
  createOverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  InjectionToken,
  Injector,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, debounceTime, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Customer, Order, Paged, Product } from '../../models';
import { GradientBorder } from '../../shared/ui/gradient-border';
import { CustomersApi } from '../api/customers-api';
import { OrdersApi } from '../api/orders-api';
import { ProductsApi } from '../api/products-api';
import { AuthService } from '../auth/auth.service';
import { NAV_ITEMS } from '../layout/nav-items';
import { LiveOrdersService } from '../live/live-orders.service';
import { ThemeService } from '../theme/theme.service';
import type { PaletteHandle } from './command-palette.service';
import { COMMAND_GROUPS, Command, CommandGroup, filterCommands } from './commands';

const SEARCH_DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;
const RESULTS_PER_ENTITY = 5;

const PALETTE_CLOSE = new InjectionToken<() => void>('PALETTE_CLOSE');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface SearchResult {
  query: string;
  commands: Command[];
}

interface Section {
  group: CommandGroup;
  items: { command: Command; index: number }[];
}

/** Mounts the palette in a centered CDK overlay; called lazily by `CommandPaletteService`. */
export function attachCommandPalette(parent: Injector, close: () => void): PaletteHandle {
  const doc = parent.get(DOCUMENT);
  const returnFocusTo = doc.activeElement as HTMLElement | null;
  const overlayRef = createOverlayRef(parent, {
    hasBackdrop: true,
    backdropClass: 'nb-palette-backdrop',
    panelClass: 'nb-palette-pane',
    width: '640px',
    maxWidth: 'calc(100vw - 2rem)',
    positionStrategy: createGlobalPositionStrategy(parent).centerHorizontally().top('15vh'),
    scrollStrategy: createBlockScrollStrategy(parent),
  });
  const injector = Injector.create({
    parent,
    providers: [{ provide: PALETTE_CLOSE, useValue: close }],
  });
  overlayRef.attach(new ComponentPortal(CommandPalette, null, injector));
  const backdrop = overlayRef.backdropClick().subscribe(() => close());
  return {
    dispose: () => {
      backdrop.unsubscribe();
      overlayRef.dispose();
      returnFocusTo?.focus?.();
    },
  };
}

/** Ctrl/Cmd+K palette: fuzzy search over pages and actions plus live entity search. */
@Component({
  selector: 'nb-command-palette',
  imports: [CdkTrapFocus, GradientBorder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'close()' },
  template: `
    <nb-gradient-border [active]="true" class="nb-palette">
      <div
        class="nb-palette__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
      >
        <div class="nb-palette__search">
          <span class="material-symbols-rounded nb-palette__search-icon" aria-hidden="true"
            >search</span
          >
          <input
            type="search"
            role="combobox"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="nb-palette-list"
            [attr.aria-activedescendant]="activeId()"
            placeholder="Search pages, orders, products…"
            autocomplete="off"
            spellcheck="false"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKeydown($event)"
          />
          @if (searching()) {
            <span class="nb-palette__spinner" aria-hidden="true"></span>
          }
          <kbd class="nb-kbd">Esc</kbd>
        </div>

        <div id="nb-palette-list" class="nb-palette__list" role="listbox" aria-label="Results">
          @for (section of sections(); track section.group) {
            <div role="group" [attr.aria-label]="section.group">
              <div class="nb-palette__group" aria-hidden="true">{{ section.group }}</div>
              @for (item of section.items; track item.command.id) {
                <div
                  role="option"
                  tabindex="-1"
                  class="nb-palette__item"
                  [id]="optionId(item.index)"
                  [class.is-active]="item.index === active()"
                  [attr.aria-selected]="item.index === active()"
                  (click)="run(item.command)"
                  (keydown.enter)="run(item.command)"
                  (mousemove)="active.set(item.index)"
                >
                  <span class="nb-palette__icon material-symbols-rounded" aria-hidden="true">{{
                    item.command.icon
                  }}</span>
                  <span class="nb-palette__label">{{ item.command.label }}</span>
                  @if (item.command.hint) {
                    <span class="nb-palette__hint">{{ item.command.hint }}</span>
                  }
                  <span class="nb-palette__enter material-symbols-rounded" aria-hidden="true"
                    >keyboard_return</span
                  >
                </div>
              }
            </div>
          } @empty {
            <p class="nb-palette__empty">
              @if (searching()) {
                Searching…
              } @else {
                No results for “{{ query() }}”
              }
            </p>
          }
        </div>

        <footer class="nb-palette__footer" aria-hidden="true">
          <span><kbd class="nb-kbd">↑</kbd><kbd class="nb-kbd">↓</kbd> navigate</span>
          <span><kbd class="nb-kbd">↵</kbd> open</span>
          <span><kbd class="nb-kbd">Esc</kbd> close</span>
          <span class="nb-palette__brand">Nebula Commerce</span>
        </footer>
      </div>
    </nb-gradient-border>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .nb-palette {
      border-radius: 1.25rem;
      box-shadow:
        0 40px 120px -30px rgba(0, 0, 0, 0.75),
        0 0 80px -30px var(--nb-accent-1);
    }
    // Out-specifies GradientBorder's opaque inner fill so the panel stays frosted glass.
    :host .nb-palette.nb-gradient-border ::ng-deep .nb-gradient-border__inner {
      border-radius: calc(1.25rem - 1px);
      background: color-mix(in srgb, var(--nb-card) 88%, transparent);
      backdrop-filter: blur(24px) saturate(150%);
    }
    .nb-palette__panel {
      display: flex;
      flex-direction: column;
      max-height: min(70vh, 34rem);
      overflow: hidden;
      border-radius: inherit;
    }
    .nb-palette__search {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.125rem;
      border-bottom: 1px solid var(--nb-glass-border);
    }
    .nb-palette__search-icon {
      font-size: 1.375rem;
      color: var(--nb-accent-1);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--nb-text);
      font: inherit;
      font-size: 1.0625rem;
    }
    input::placeholder {
      color: var(--nb-muted);
    }
    input::-webkit-search-cancel-button {
      display: none;
    }
    .nb-palette__spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid color-mix(in srgb, var(--nb-accent-1) 25%, transparent);
      border-top-color: var(--nb-accent-1);
      border-radius: 9999px;
      animation: nb-palette-spin 700ms linear infinite;
    }
    @keyframes nb-palette-spin {
      to {
        transform: rotate(360deg);
      }
    }
    .nb-palette__list {
      flex: 1;
      overflow-y: auto;
      padding: 0.375rem 0.5rem 0.625rem;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: var(--nb-border) transparent;
    }
    .nb-palette__group {
      padding: 0.75rem 0.75rem 0.375rem;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-palette__item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 2.75rem;
      padding: 0.375rem 0.75rem;
      border-radius: 0.75rem;
      cursor: pointer;
      color: var(--nb-text);
      outline: none;
    }
    .nb-palette__item.is-active {
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--nb-accent-1) 20%, transparent),
        color-mix(in srgb, var(--nb-accent-2) 6%, transparent)
      );
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nb-accent-1) 30%, transparent);
    }
    .nb-palette__icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 2rem;
      height: 2rem;
      overflow: hidden;
      border-radius: 0.625rem;
      font-size: 1.125rem;
      color: var(--nb-muted);
      background: color-mix(in srgb, var(--nb-text) 6%, transparent);
    }
    .is-active .nb-palette__icon {
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 6px 18px -8px var(--nb-accent-1);
    }
    .nb-palette__label {
      flex: none;
      max-width: 60%;
      overflow: hidden;
      font-size: 0.9375rem;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nb-palette__hint {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-size: 0.8125rem;
      color: var(--nb-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .nb-palette__enter {
      margin-left: auto;
      font-size: 1rem;
      color: var(--nb-muted);
      opacity: 0;
    }
    .is-active .nb-palette__enter {
      opacity: 1;
    }
    .nb-palette__empty {
      margin: 0;
      padding: 2rem 1rem;
      text-align: center;
      color: var(--nb-muted);
      font-size: 0.875rem;
    }
    .nb-palette__footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      padding: 0.625rem 1.125rem;
      border-top: 1px solid var(--nb-glass-border);
      font-size: 0.75rem;
      color: var(--nb-muted);
    }
    .nb-palette__footer span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .nb-palette__brand {
      margin-left: auto;
      font-weight: 600;
    }
    @media (max-width: 480px) {
      .nb-palette__footer {
        display: none;
      }
      .nb-palette__hint {
        display: none;
      }
      .nb-palette__label {
        max-width: none;
        flex: 1;
      }
    }
  `,
})
export class CommandPalette {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly live = inject(LiveOrdersService);
  private readonly auth = inject(AuthService);
  private readonly ordersApi = inject(OrdersApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly customersApi = inject(CustomersApi);
  private readonly closePalette = inject(PALETTE_CLOSE, { optional: true });

  protected readonly query = signal('');
  protected readonly searching = signal(false);

  private readonly staticCommands = computed<Command[]>(() => [
    ...NAV_ITEMS.map((n): Command => ({
      id: `page:${n.path}`,
      group: 'Pages',
      label: n.label,
      icon: n.icon,
      run: () => this.go(`/${n.path}`),
    })),
    {
      id: 'action:theme',
      group: 'Actions',
      label: 'Toggle theme',
      hint: `Switch to ${this.theme.mode() === 'dark' ? 'light' : 'dark'} mode`,
      icon: this.theme.mode() === 'dark' ? 'light_mode' : 'dark_mode',
      run: () => this.theme.toggleMode(),
    },
    {
      id: 'action:live',
      group: 'Actions',
      label: this.live.enabled() ? 'Pause live orders' : 'Resume live orders',
      icon: this.live.enabled() ? 'pause_circle' : 'play_circle',
      run: () => this.live.enabled.update((v) => !v),
    },
    {
      id: 'action:new-product',
      group: 'Actions',
      label: 'New product',
      hint: 'Create a catalog item',
      icon: 'add_box',
      run: () => this.go('/products/new'),
    },
    {
      id: 'action:logout',
      group: 'Actions',
      label: 'Log out',
      icon: 'logout',
      run: () => {
        this.auth.logout();
        this.go('/login');
      },
    },
  ]);

  private readonly searchResult = toSignal(
    toObservable(this.query).pipe(
      map((q) => q.trim()),
      debounceTime(SEARCH_DEBOUNCE_MS),
      switchMap((q) => this.search(q)),
    ),
    { initialValue: { query: '', commands: [] } satisfies SearchResult },
  );

  protected readonly sections = computed<Section[]>(() => {
    const q = this.query().trim();
    const result = this.searchResult();
    const dynamic = result.query === q ? result.commands : [];
    const all = [...filterCommands(this.staticCommands(), q), ...dynamic];
    let index = 0;
    return COMMAND_GROUPS.map((group) => ({
      group,
      items: all.filter((c) => c.group === group).map((command) => ({ command, index: index++ })),
    })).filter((s) => s.items.length > 0);
  });

  private readonly flat = computed(() => this.sections().flatMap((s) => s.items));

  /** Index of the highlighted option; resets to the top whenever results change. */
  protected readonly active = linkedSignal({ source: this.flat, computation: () => 0 });
  protected readonly activeId = computed(() =>
    this.flat().length ? this.optionId(this.active()) : null,
  );

  protected optionId(index: number): string {
    return `nb-palette-option-${index}`;
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const count = this.flat().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!count) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.active.set((this.active() + step + count) % count);
      this.doc.getElementById(this.optionId(this.active()))?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = this.flat()[this.active()];
      if (item) this.run(item.command);
    }
  }

  protected run(command: Command): void {
    this.close();
    command.run();
  }

  protected close(): void {
    this.closePalette?.();
  }

  private go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  private search(q: string): Observable<SearchResult> {
    if (q.length < MIN_SEARCH_LENGTH) {
      this.searching.set(false);
      return of({ query: q, commands: [] });
    }
    this.searching.set(true);
    const query = { search: q, page: 1, pageSize: RESULTS_PER_ENTITY };
    return forkJoin({
      orders: items(this.ordersApi.list(query)),
      products: items(this.productsApi.list(query)),
      customers: items(this.customersApi.list(query)),
    }).pipe(
      map(({ orders, products, customers }) => ({
        query: q,
        commands: [
          ...orders.map((o) => this.orderCommand(o)),
          ...products.map((p) => this.productCommand(p)),
          ...customers.map((c) => this.customerCommand(c)),
        ],
      })),
      tap(() => this.searching.set(false)),
    );
  }

  private orderCommand(o: Order): Command {
    return {
      id: `order:${o.id}`,
      group: 'Orders',
      label: `Order #${o.number}`,
      hint: `${o.customerName} · ${usd.format(o.total)}`,
      icon: 'receipt_long',
      run: () => this.go(`/orders/${o.id}`),
    };
  }

  private productCommand(p: Product): Command {
    return {
      id: `product:${p.id}`,
      group: 'Products',
      label: p.name,
      hint: `${p.sku} · ${usd.format(p.price)}`,
      icon: 'inventory_2',
      run: () => this.go(`/products/${p.id}/edit`),
    };
  }

  private customerCommand(c: Customer): Command {
    return {
      id: `customer:${c.id}`,
      group: 'Customers',
      label: c.name,
      hint: c.email,
      icon: 'person',
      run: () => this.go(`/customers/${c.id}`),
    };
  }
}

/** Page items, or nothing if that search failed (the palette stays usable). */
function items<T>(page$: Observable<Paged<T>>): Observable<T[]> {
  return page$.pipe(
    map((p) => p.items),
    catchError(() => of([])),
  );
}
