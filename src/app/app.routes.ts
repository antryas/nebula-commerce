import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { unsavedChangesGuard } from './features/products/unsaved-changes.guard';

type LoadComponent = NonNullable<Route['loadComponent']>;

/** Lazy feature page; `title` feeds the document title and `data.title` the topbar. */
function page(path: string, title: string, loadComponent: LoadComponent): Route {
  return { path, title, data: { title }, loadComponent };
}

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      page('overview', 'Overview', () =>
        import('./features/overview/overview').then((m) => m.Overview),
      ),
      page('orders', 'Orders', () => import('./features/orders/orders').then((m) => m.Orders)),
      page('orders/:id', 'Order details', () =>
        import('./features/orders/order-details').then((m) => m.OrderDetails),
      ),
      page('fulfillment', 'Fulfillment', () =>
        import('./features/fulfillment/fulfillment').then((m) => m.Fulfillment),
      ),
      page('products', 'Products', () =>
        import('./features/products/products').then((m) => m.Products),
      ),
      {
        ...page('products/new', 'New product', () =>
          import('./features/products/product-edit').then((m) => m.ProductEdit),
        ),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        ...page('products/:id/edit', 'Edit product', () =>
          import('./features/products/product-edit').then((m) => m.ProductEdit),
        ),
        canDeactivate: [unsavedChangesGuard],
      },
      page('customers', 'Customers', () =>
        import('./features/customers/customers').then((m) => m.Customers),
      ),
      page('customers/:id', 'Customer', () =>
        import('./features/customers/customer-profile').then((m) => m.CustomerProfilePage),
      ),
      page('analytics', 'Analytics', () =>
        import('./features/analytics/analytics').then((m) => m.Analytics),
      ),
      page('settings', 'Settings', () =>
        import('./features/settings/settings').then((m) => m.Settings),
      ),
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
