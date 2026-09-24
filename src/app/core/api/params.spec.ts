import { toHttpParams } from './params';

describe('toHttpParams', () => {
  it('skips empty values and joins arrays with commas', () => {
    const p = toHttpParams({
      page: 2,
      pageSize: 20,
      search: '',
      sort: undefined,
      dir: null,
      status: ['new', 'shipped'],
      tags: [],
    });
    expect(p.toString()).toBe('page=2&pageSize=20&status=new,shipped');
  });

  it('keeps zero', () => {
    expect(toHttpParams({ page: 0 }).get('page')).toBe('0');
  });
});
