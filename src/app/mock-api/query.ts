import { ListQuery, Paged, SortDir } from '../models';

export interface ListQueryOptions<T> {
  searchFields: (keyof T)[];
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Applies search, sorting and 1-based paging to an in-memory list. Never mutates `rows`. */
export function applyListQuery<T>(rows: T[], q: ListQuery, opts: ListQueryOptions<T>): Paged<T> {
  const term = q.search?.trim().toLowerCase();
  let result =
    term && opts.searchFields.length
      ? rows.filter((row) =>
          opts.searchFields.some((f) =>
            String(row[f] ?? '')
              .toLowerCase()
              .includes(term),
          ),
        )
      : [...rows];

  if (q.sort) {
    const key = q.sort;
    const sign = (q.dir ?? 'desc') === 'asc' ? 1 : -1;
    result = result.sort(
      (a, b) =>
        sign *
        compareValues((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  const pageSize = clamp(finiteInt(q.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);
  const page = Math.max(1, finiteInt(q.page, 1));
  const start = (page - 1) * pageSize;
  return { items: result.slice(start, start + pageSize), total: result.length, page, pageSize };
}

/** Reads the common list parameters (`page,pageSize,sort,dir,search`) from a query string. */
export function parseListQuery(query: URLSearchParams): ListQuery {
  const dir = query.get('dir');
  return {
    page: toInt(query.get('page'), 1),
    pageSize: toInt(query.get('pageSize'), DEFAULT_PAGE_SIZE),
    sort: query.get('sort') || undefined,
    dir: dir === 'asc' || dir === 'desc' ? (dir as SortDir) : undefined,
    search: query.get('search') || undefined,
  };
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
}

function toInt(raw: string | null, fallback: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function finiteInt(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
