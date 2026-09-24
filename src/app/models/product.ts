export type ProductCategory =
  'Apparel' | 'Footwear' | 'Accessories' | 'Electronics' | 'Home' | 'Beauty';

export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  stock: number;
  sold: number;
  rating: number;
  variants: ProductVariant[];
  createdAt: string;
  active: boolean;
}

/** 'low' means 1..10 units in stock. */
export type StockFilter = 'all' | 'in' | 'low' | 'out';
