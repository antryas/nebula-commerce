export interface NavItem {
  /** Route path without the leading slash. */
  path: string;
  label: string;
  /** Material Symbols ligature. */
  icon: string;
  /** Live counter shown next to the label. */
  badge?: 'liveOrders';
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: 'overview', label: 'Overview', icon: 'space_dashboard' },
  { path: 'orders', label: 'Orders', icon: 'receipt_long', badge: 'liveOrders' },
  { path: 'fulfillment', label: 'Fulfillment', icon: 'view_kanban' },
  { path: 'products', label: 'Products', icon: 'inventory_2' },
  { path: 'customers', label: 'Customers', icon: 'group' },
  { path: 'analytics', label: 'Analytics', icon: 'insights' },
  { path: 'settings', label: 'Settings', icon: 'settings' },
];
