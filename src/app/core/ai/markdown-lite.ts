import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A run of text, optionally bold. Rendered as a text node, never as HTML. */
export interface MdSpan {
  text: string;
  bold: boolean;
}

/** One line of inline content. */
export type MdLine = MdSpan[];

export type MdBlock = { kind: 'p'; lines: MdLine[] } | { kind: 'ul'; items: MdLine[] };

const BULLET = /^\s*[-*•]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

/**
 * Parses the small markdown subset model answers use: paragraphs (blank-line separated, single
 * newlines kept as line breaks), `-` / `*` bullet lists and `**bold**`. Headings degrade to a
 * bold line; everything else stays literal text. The output is plain data, so the template
 * renders it with interpolation and model text can never inject markup.
 */
export function parseMarkdownLite(source: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let current: MdBlock | null = null;

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) {
      current = null;
      continue;
    }
    if (BULLET.test(raw)) {
      if (current?.kind !== 'ul') blocks.push((current = { kind: 'ul', items: [] }));
      current.items.push(parseInline(raw.replace(BULLET, '')));
      continue;
    }
    const line = HEADING.test(raw)
      ? [{ text: stripBold(raw.replace(HEADING, '').trim()), bold: true }]
      : parseInline(raw.trim());
    if (current?.kind !== 'p') blocks.push((current = { kind: 'p', lines: [] }));
    current.lines.push(line);
  }
  return blocks;
}

/** Splits a line on `**` pairs; an unmatched `**` is kept as literal text. */
export function parseInline(text: string): MdLine {
  const parts = text.split('**');
  // An even number of parts means one `**` has no partner: glue the last two back together.
  if (parts.length % 2 === 0) {
    const tail = parts.pop() ?? '';
    parts[parts.length - 1] += `**${tail}`;
  }
  return parts
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((span) => span.text.length > 0);
}

function stripBold(text: string): string {
  return text.replaceAll('**', '');
}

/**
 * Renders `parseMarkdownLite` output with template nodes only (no `innerHTML`). Every span is an
 * element so template whitespace never leaks between runs ("**$10**, up" stays "$10, up").
 */
@Component({
  selector: 'nb-markdown-lite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (block of blocks(); track $index) {
      @if (block.kind === 'ul') {
        <ul>
          @for (item of block.items; track $index) {
            <li>
              @for (span of item; track $index) {
                @if (span.bold) {
                  <strong>{{ span.text }}</strong>
                } @else {
                  <span>{{ span.text }}</span>
                }
              }
            </li>
          }
        </ul>
      } @else {
        <p>
          @for (line of block.lines; track $index; let last = $last) {
            @for (span of line; track $index) {
              @if (span.bold) {
                <strong>{{ span.text }}</strong>
              } @else {
                <span>{{ span.text }}</span>
              }
            }
            @if (!last) {
              <br />
            }
          }
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    p,
    ul {
      margin: 0;
    }
    p + *,
    ul + * {
      margin-top: 0.625rem;
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: 0.3125rem;
      padding-left: 1.125rem;
      list-style: disc;
    }
    li::marker {
      color: var(--nb-accent-1);
    }
    strong {
      font-weight: 650;
      color: var(--nb-text);
    }
  `,
})
export class MarkdownLite {
  readonly text = input.required<string>();
  protected readonly blocks = computed(() => parseMarkdownLite(this.text()));
}
