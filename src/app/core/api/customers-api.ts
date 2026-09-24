import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Customer, ListQuery, Order, Paged } from '../../models';
import { toHttpParams } from './params';

/** Customer profile with their orders, newest first. */
export interface CustomerProfile {
  customer: Customer;
  orders: Order[];
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers`;

  list(q: ListQuery): Observable<Paged<Customer>> {
    return this.http.get<Paged<Customer>>(this.base, { params: toHttpParams({ ...q }) });
  }

  get(id: string): Observable<CustomerProfile> {
    return this.http.get<CustomerProfile>(`${this.base}/${encodeURIComponent(id)}`);
  }
}
