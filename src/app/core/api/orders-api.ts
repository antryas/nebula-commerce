import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ListQuery, Order, OrderStatus, Paged } from '../../models';
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
  private readonly base = `${environment.apiUrl}/orders`;

  list(q: OrdersQuery): Observable<Paged<Order>> {
    return this.http.get<Paged<Order>>(this.base, { params: toHttpParams({ ...q }) });
  }

  get(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.base}/${encodeURIComponent(id)}`);
  }

  updateStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.base}/${encodeURIComponent(id)}/status`, { status });
  }

  bulkStatus(ids: string[], status: OrderStatus): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.base}/bulk-status`, { ids, status });
  }
}
