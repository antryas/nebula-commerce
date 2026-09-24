import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategorySales,
  FunnelStep,
  GeoSales,
  HeatCell,
  Kpi,
  Product,
  RevenueRange,
  TimePoint,
} from '../../models';
import { ApiConfigService } from './api-config.service';
import { toHttpParams } from './params';

/** A best-selling product within the requested range. */
export interface TopProduct {
  product: Product;
  unitsSold: number;
  revenue: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    return `${this.config.baseUrl()}/analytics`;
  }

  overview(range: RevenueRange): Observable<Kpi[]> {
    return this.fetch<Kpi[]>('overview', range);
  }

  revenue(range: RevenueRange): Observable<TimePoint[]> {
    return this.fetch<TimePoint[]>('revenue', range);
  }

  categories(range: RevenueRange): Observable<CategorySales[]> {
    return this.fetch<CategorySales[]>('categories', range);
  }

  heatmap(range: RevenueRange): Observable<HeatCell[]> {
    return this.fetch<HeatCell[]>('heatmap', range);
  }

  geo(range: RevenueRange): Observable<GeoSales[]> {
    return this.fetch<GeoSales[]>('geo', range);
  }

  funnel(range: RevenueRange): Observable<FunnelStep[]> {
    return this.fetch<FunnelStep[]>('funnel', range);
  }

  topProducts(range: RevenueRange, limit = 5): Observable<TopProduct[]> {
    return this.fetch<TopProduct[]>('top-products', range, { limit });
  }

  private fetch<T>(
    endpoint: string,
    range: RevenueRange,
    extra: Record<string, number> = {},
  ): Observable<T> {
    return this.http.get<T>(`${this.base}/${endpoint}`, {
      params: toHttpParams({ range, ...extra }),
    });
  }
}
