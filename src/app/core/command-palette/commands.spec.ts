import { Command, filterCommands, fuzzyScore } from './commands';

describe('fuzzyScore', () => {
  it('returns 0 when characters are missing', () => expect(fuzzyScore('xyz', 'Orders')).toBe(0));

  it('matches case-insensitively', () => expect(fuzzyScore('ord', 'Orders')).toBeGreaterThan(0));

  it('prefers prefix over scattered match', () =>
    expect(fuzzyScore('pro', 'Products')).toBeGreaterThan(fuzzyScore('pro', 'Top reorders')));

  it('prefers word-start matches', () =>
    expect(fuzzyScore('lo', 'Log out')).toBeGreaterThan(fuzzyScore('lo', 'Toggle colors')));

  it('requires characters in order', () => expect(fuzzyScore('sro', 'Orders')).toBe(0));

  it('treats an empty query as a neutral match', () => expect(fuzzyScore('', 'Orders')).toBe(1));
});

describe('filterCommands', () => {
  const cmd = (label: string, group: Command['group'] = 'Pages'): Command => ({
    id: label,
    group,
    label,
    icon: 'x',
    run: () => undefined,
  });
  const all = [cmd('Overview'), cmd('Orders'), cmd('Products'), cmd('Toggle theme', 'Actions')];

  it('returns everything in original order for an empty query', () => {
    expect(filterCommands(all, '  ')).toEqual(all);
  });

  it('drops non-matches and ranks by score', () => {
    expect(filterCommands(all, 'or').map((c) => c.label)).toEqual(['Orders', 'Overview']);
  });

  it('also matches on the hint', () => {
    const withHint = { ...cmd('Settings'), hint: 'Profile and theme' };
    expect(filterCommands([withHint], 'profile')).toEqual([withHint]);
  });
});
