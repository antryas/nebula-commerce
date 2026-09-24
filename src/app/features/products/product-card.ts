import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { ProductCategory } from '../../models';
import { NbCurrencyPipe } from '../../shared/pipes/intl-format';

/** Units at which the stock bar is drawn full. */
const STOCK_BAR_FULL = 60;
export const LOW_STOCK_MAX = 10;

export type StockLevel = 'in' | 'low' | 'out';

/** Fields the card needs; the editor preview builds this from unsaved form values. */
export interface ProductCardData {
  name: string;
  sku: string;
  category: ProductCategory | '';
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  stock: number;
  rating: number;
  active: boolean;
}

export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return 'out';
  return stock <= LOW_STOCK_MAX ? 'low' : 'in';
}

export function stockLabel(stock: number): string {
  const level = stockLevel(stock);
  return level === 'out' ? 'Out of stock' : level === 'low' ? 'Low stock' : 'In stock';
}

/** Catalog tile: image with hover zoom, category, price, rating and a stock level bar. */
@Component({
  selector: 'nb-product-card',
  imports: [NbCurrencyPipe, MatMenuModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<ProductCardData>();
  /** Router link for the title; the whole card becomes clickable. */
  readonly link = input<string | readonly string[] | null>(null);
  /** Shows the Edit / Delete menu. */
  readonly actions = input(false, { transform: booleanAttribute });

  readonly edit = output<void>();
  readonly delete = output<void>();

  protected readonly imageFailed = linkedSignal({
    source: () => this.product().imageUrl,
    computation: () => false,
  });

  protected readonly level = computed(() => stockLevel(this.product().stock));
  protected readonly stockText = computed(() => stockLabel(this.product().stock));
  protected readonly stockPct = computed(() => {
    const stock = Math.max(0, this.product().stock);
    return stock === 0 ? 0 : Math.max(6, Math.min(100, (stock / STOCK_BAR_FULL) * 100));
  });
  protected readonly discount = computed(() => {
    const { price, compareAtPrice } = this.product();
    return compareAtPrice && price > 0 && compareAtPrice > price
      ? Math.round((1 - price / compareAtPrice) * 100)
      : 0;
  });
  protected readonly ratingPct = computed(() =>
    Math.max(0, Math.min(100, (this.product().rating / 5) * 100)),
  );
}
