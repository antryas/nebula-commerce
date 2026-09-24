export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export type SortDir = 'asc' | 'desc';

export interface ListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  dir?: SortDir;
  search?: string;
}
