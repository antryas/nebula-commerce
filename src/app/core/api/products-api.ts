import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListQuery, Paged, Product, ProductCategory, StockFilter } from '../../models';
import { ApiConfigService } from './api-config.service';
import { toHttpParams } from './params';

/** Editable product fields; server-owned fields are omitted. */
export type ProductInput = Omit<Product, 'id' | 'sold' | 'rating' | 'createdAt'>;

export interface ProductsQuery extends ListQuery {
  category?: ProductCategory;
  stock?: StockFilter;
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    return `${this.config.baseUrl()}/products`;
  }

  list(q: ProductsQuery): Observable<Paged<Product>> {
    return this.http.get<Paged<Product>>(this.base, { params: toHttpParams({ ...q }) });
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(this.url(id));
  }

  create(p: ProductInput): Observable<Product> {
    return this.http.post<Product>(this.base, p);
  }

  update(id: string, p: ProductInput): Observable<Product> {
    return this.http.put<Product>(this.url(id), p);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.url(id));
  }

  private url(id: string): string {
    return `${this.base}/${encodeURIComponent(id)}`;
  }
}
