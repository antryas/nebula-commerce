export type OrderStatus = 'new' | 'packing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  imageUrl: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface StatusChange {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface Address {
  line1: string;
  city: string;
  country: string;
  countryCode: string;
  postalCode: string;
}

export interface Order {
  /** Format: 'ord_000123'. */
  id: string;
  /** Human-facing order number, starting at 1001. */
  number: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAvatarUrl: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'card' | 'paypal' | 'apple_pay';
  /** ISO 8601 timestamp. */
  createdAt: string;
  shippingAddress: Address;
  history: StatusChange[];
}
