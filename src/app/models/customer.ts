export interface Customer {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  phone: string;
  country: string;
  countryCode: string;
  createdAt: string;
  ordersCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
  notes: string;
}
