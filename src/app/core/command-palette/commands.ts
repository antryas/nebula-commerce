export type CommandGroup = 'Pages' | 'Actions' | 'Orders' | 'Products' | 'Customers';

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  /** Material Symbols ligature. */
  icon: string;
  run: () => void;
}

/** Display order of groups in the palette. */
export const COMMAND_GROUPS: readonly CommandGroup[] = [
  'Pages',
  'Actions',
  'Orders',
  'Products',
  'Customers',
];

const WORD_SEPARATORS = new Set([' ', '-', '_', '/', '#', '.', '@']);

/**
 * Subsequence fuzzy match. Returns 0 when not every query character appears in order;
 * otherwise a positive score where consecutive runs, word starts and a prefix match
 * weigh more, and gaps between matches weigh less.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = text.toLowerCase();

  let score = 0;
  let from = 0;
  let prev = -1;
  for (const ch of q) {
    const i = t.indexOf(ch, from);
    if (i === -1) return 0;
    score += 1;
    if (i === prev + 1) score += 5;
    if (i === 0 || WORD_SEPARATORS.has(t[i - 1])) score += 8;
    if (prev >= 0) score -= Math.min(i - prev - 1, 5) * 0.5;
    prev = i;
    from = i + 1;
  }
  if (t.startsWith(q)) score += 10;
  // Shorter texts win ties: "Orders" beats "Orders archive" for the same query.
  return Math.max(score - t.length * 0.01, 0.01);
}

/** Commands matching `query` by label (or hint), best first; all commands when empty. */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  if (!query.trim()) return [...commands];
  return commands
    .map((command) => ({
      command,
      score: Math.max(
        fuzzyScore(query, command.label),
        command.hint ? fuzzyScore(query, command.hint) * 0.8 : 0,
      ),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.command);
}
