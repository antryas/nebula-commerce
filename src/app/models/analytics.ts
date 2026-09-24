import { ProductCategory } from './product';

export type RevenueRange = '7d' | '30d' | '90d' | '12m';

export interface Kpi {
  key: 'revenue' | 'orders' | 'aov' | 'conversion';
  label: string;
  value: number;
  previous: number;
  deltaPct: number;
  spark: number[];
  format: 'currency' | 'number' | 'percent';
}

export interface TimePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface CategorySales {
  category: ProductCategory;
  revenue: number;
}

/** weekday 0 = Monday. */
export interface HeatCell {
  weekday: number;
  hour: number;
  orders: number;
}

export interface GeoSales {
  countryCode: string;
  country: string;
  revenue: number;
  orders: number;
}

export interface FunnelStep {
  step: 'Visits' | 'Product views' | 'Added to cart' | 'Checkout' | 'Paid';
  value: number;
}
