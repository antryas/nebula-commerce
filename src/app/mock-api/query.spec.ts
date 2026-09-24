import { applyListQuery, parseListQuery } from './query';

const rows = [
  { id: 'a', name: 'Alpha', total: 30 },
  { id: 'b', name: 'beta', total: 10 },
  { id: 'c', name: 'Gamma', total: 20 },
];

describe('applyListQuery', () => {
  it('sorts descending by default', () => {
    const r = applyListQuery(
      rows,
      { page: 1, pageSize: 10, sort: 'total' },
      { searchFields: ['name'] },
    );
    expect(r.items.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('searches case-insensitively', () => {
    const r = applyListQuery(
      rows,
      { page: 1, pageSize: 10, search: 'BET' },
      { searchFields: ['name'] },
    );
    expect(r.items.map((x) => x.id)).toEqual(['b']);
    expect(r.total).toBe(1);
  });

  it('pages with 1-based index', () => {
    const r = applyListQuery(
      rows,
      { page: 2, pageSize: 2, sort: 'name', dir: 'asc' },
      { searchFields: ['name'] },
    );
    expect(r.items.map((x) => x.id)).toEqual(['c']);
    expect(r).toMatchObject({ total: 3, page: 2, pageSize: 2 });
  });

  it('clamps page size to 1..100', () => {
    expect(applyListQuery(rows, { page: 1, pageSize: 0 }, { searchFields: [] }).pageSize).toBe(1);
    expect(applyListQuery(rows, { page: 1, pageSize: 500 }, { searchFields: [] }).pageSize).toBe(
      100,
    );
  });

  it('does not mutate the source rows', () => {
    const copy = [...rows];
    applyListQuery(
      rows,
      { page: 1, pageSize: 10, sort: 'total', dir: 'asc' },
      { searchFields: [] },
    );
    expect(rows).toEqual(copy);
  });
});

describe('parseListQuery', () => {
  it('reads paging, sorting and search from query params', () => {
    const q = parseListQuery(new URLSearchParams('page=3&pageSize=25&sort=total&dir=asc&search=x'));
    expect(q).toEqual({ page: 3, pageSize: 25, sort: 'total', dir: 'asc', search: 'x' });
  });

  it('falls back to defaults for missing or invalid values', () => {
    const q = parseListQuery(new URLSearchParams('page=abc&dir=sideways'));
    expect(q).toEqual({
      page: 1,
      pageSize: 20,
      sort: undefined,
      dir: undefined,
      search: undefined,
    });
  });
});
