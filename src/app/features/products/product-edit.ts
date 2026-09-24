import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ProductsApi } from '../../core/api/products-api';
import { toApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Product } from '../../models';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { ImageDrop } from './image-drop';
import { ProductCard, ProductCardData } from './product-card';
import { SaveBar } from './save-bar';
import {
  COMPARE_AT_MESSAGE,
  DESCRIPTION_MAX,
  NAME_MAX,
  PRODUCT_CATEGORIES,
  addVariant,
  applyServerErrors,
  buildProductForm,
  fieldError,
  patchProductForm,
  removeVariant,
  toProductInput,
} from './product-form';
import { HasUnsavedChanges } from './unsaved-changes.guard';

type LoadState = 'loading' | 'ready' | 'error';

/** Create (`/products/new`) and edit (`/products/:id/edit`) page with a live preview. */
@Component({
  selector: 'nb-product-edit-page',
  imports: [
    CurrencyPipe,
    EmptyState,
    ErrorState,
    GlassCard,
    ImageDrop,
    MatSlideToggleModule,
    PageHeader,
    ProductCard,
    ReactiveFormsModule,
    RouterLink,
    SaveBar,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-edit.html',
  styleUrl: './product-edit.scss',
})
export class ProductEdit implements HasUnsavedChanges {
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Route param bound via `withComponentInputBinding()`; absent for a new product. */
  readonly id = input<string>();

  protected readonly form = buildProductForm(inject(NonNullableFormBuilder));
  protected readonly controls = this.form.controls;
  protected readonly categories = PRODUCT_CATEGORIES;
  protected readonly nameMax = NAME_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;

  protected readonly state = signal<LoadState>('ready');
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  private readonly loaded = signal<Product | null>(null);
  private readonly reloadTick = signal(0);
  private saved = false;

  /** Object URLs created for picked images; revoked on destroy unless persisted. */
  private readonly objectUrls = new Set<string>();
  private persistedImageUrl: string | null = null;

  /** Bumps on every form event so template helpers re-evaluate under OnPush + zoneless. */
  private readonly formVersion = toSignal(this.form.events.pipe(map((_, i) => i + 1)), {
    initialValue: 0,
  });
  private readonly value = computed(() => {
    this.formVersion();
    return this.form.getRawValue();
  });

  protected readonly isNew = computed(() => !this.id());
  protected readonly dirty = computed(() => {
    this.formVersion();
    return this.form.dirty;
  });
  protected readonly canSave = computed(() => {
    this.formVersion();
    return this.form.valid && !this.pending();
  });
  protected readonly descriptionLength = computed(() => this.value().description.length);
  protected readonly nameLength = computed(() => this.value().name.length);
  protected readonly savings = computed(() => {
    const { price, compareAtPrice } = this.value();
    if (!price || !compareAtPrice || compareAtPrice <= price) return null;
    return { amount: compareAtPrice - price, pct: Math.round((1 - price / compareAtPrice) * 100) };
  });
  protected readonly preview = computed<ProductCardData>(() => {
    const v = this.value();
    return {
      name: v.name.trim() || 'Untitled product',
      sku: v.sku || 'SKU-0000',
      category: v.category,
      price: Number(v.price) || 0,
      compareAtPrice: v.compareAtPrice,
      imageUrl: v.imageUrl,
      stock: Number(v.stock) || 0,
      rating: this.loaded()?.rating ?? 0,
      active: v.active,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      this.reloadTick();
      untracked(() => {
        this.loadError.set(null);
        this.loaded.set(null);
        if (!id) {
          this.state.set('ready');
          return;
        }
        this.state.set('loading');
        const sub = this.api.get(id).subscribe({
          next: (p) => {
            patchProductForm(this.form, p);
            this.loaded.set(p);
            this.state.set('ready');
          },
          error: (e: unknown) => {
            this.loadError.set(toApiError(e));
            this.state.set('error');
          },
        });
        onCleanup(() => sub.unsubscribe());
      });
    });

    inject(DestroyRef).onDestroy(() => {
      for (const url of this.objectUrls) {
        if (url !== this.persistedImageUrl) URL.revokeObjectURL(url);
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && this.form.dirty;
  }

  protected retry(): void {
    this.reloadTick.update((n) => n + 1);
  }

  protected err(control: AbstractControl): string | null {
    this.formVersion();
    if (control.valid || control.disabled || !(control.touched || this.submitted())) return null;
    return fieldError(control);
  }

  protected compareAtError(): string | null {
    this.formVersion();
    const c = this.controls.compareAtPrice;
    if (!this.form.hasError('compareAtNotAbove') || !(c.touched || this.submitted())) return null;
    return COMPARE_AT_MESSAGE;
  }

  /** SKUs are uppercase; normalize while typing so the pattern stays easy to satisfy. */
  protected normalizeSku(): void {
    const sku = this.controls.sku;
    const upper = sku.value.toUpperCase().replace(/\s+/g, '-');
    if (upper !== sku.value) sku.setValue(upper);
  }

  protected addVariant(): void {
    addVariant(this.form, { size: '', color: '', stock: 0 });
    afterNextRender(
      () => {
        const inputs = this.host.nativeElement.querySelectorAll<HTMLInputElement>(
          '.nb-variant input[data-first]',
        );
        inputs[inputs.length - 1]?.focus();
      },
      { injector: this.injector },
    );
  }

  protected removeVariant(index: number): void {
    removeVariant(this.form, index);
  }

  protected onImage(file: File): void {
    const url = URL.createObjectURL(file);
    this.objectUrls.add(url);
    this.controls.imageUrl.setValue(url);
    this.controls.imageUrl.markAsDirty();
  }

  protected clearImage(): void {
    this.controls.imageUrl.setValue('');
    this.controls.imageUrl.markAsDirty();
  }

  protected discard(): void {
    const product = this.loaded();
    if (product) {
      patchProductForm(this.form, product);
    } else {
      this.controls.variants.clear({ emitEvent: false });
      this.form.reset();
    }
    this.submitted.set(false);
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.id();
    const input = toProductInput(this.form);
    this.pending.set(true);
    const request$ = id ? this.api.update(id, input) : this.api.create(input);
    request$.subscribe({
      next: (p) => {
        this.pending.set(false);
        this.saved = true;
        this.persistedImageUrl = p.imageUrl;
        this.toast.success(id ? 'Product saved' : 'Product created', p.name);
        void this.router.navigate(['/products']);
      },
      error: (e: unknown) => {
        this.pending.set(false);
        const error = toApiError(e);
        if (error.status === 422) applyServerErrors(this.form, error.details);
      },
    });
  }
}
