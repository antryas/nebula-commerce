import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListQuery, Order, OrderStatus, Paged } from '../../models';
import { SKIP_ERROR_TOAST } from '../http/error.interceptor';
import { ApiConfigService } from './api-config.service';
import { toHttpParams } from './params';

export interface OrdersQuery extends ListQuery {
  status?: OrderStatus[];
  /** ISO date (inclusive). */
  from?: string;
  /** ISO date (inclusive). */
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    return `${this.config.baseUrl()}/orders`;
  }

  list(q: OrdersQuery): Observable<Paged<Order>> {
    return this.http.get<Paged<Order>>(this.base, { params: toHttpParams({ ...q }) });
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.base}/${encodeURIComponent(id)}`);
  }

  /** `silent` suppresses the global error toast when the caller reports failures itself. */
  updateStatus(
    id: string,
    status: OrderStatus,
    opts: { silent?: boolean } = {},
  ): Observable<Order> {
    return this.http.patch<Order>(
      `${this.base}/${encodeURIComponent(id)}/status`,
      { status },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, opts.silent ?? false) },
    );
  }

  bulkStatus(ids: string[], status: OrderStatus): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.base}/bulk-status`, { ids, status });
  }
}
