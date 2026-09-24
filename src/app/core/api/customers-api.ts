import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer, ListQuery, Order, Paged } from '../../models';
import { ApiConfigService } from './api-config.service';
import { toHttpParams } from './params';

/** Customer profile with their orders, newest first. */
export interface CustomerProfile {
  customer: Customer;
  orders: Order[];
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    return `${this.config.baseUrl()}/customers`;
  }

  list(q: ListQuery): Observable<Paged<Customer>> {
    return this.http.get<Paged<Customer>>(this.base, { params: toHttpParams({ ...q }) });
  }

  get(id: string): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.base}/${encodeURIComponent(id)}`);
  }
}
