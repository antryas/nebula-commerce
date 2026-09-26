import { TestBed } from '@angular/core/testing';
import { MarkdownLite, parseInline, parseMarkdownLite } from './markdown-lite';

describe('parseMarkdownLite', () => {
  it('splits paragraphs on blank lines and keeps single newlines as line breaks', () => {
    expect(parseMarkdownLite('First line\nsecond line\n\nNext paragraph')).toEqual([
      {
        kind: 'p',
        lines: [[{ text: 'First line', bold: false }], [{ text: 'second line', bold: false }]],
      },
      { kind: 'p', lines: [[{ text: 'Next paragraph', bold: false }]] },
    ]);
  });

  it('groups consecutive bullets into one list, even right after a paragraph', () => {
    const blocks = parseMarkdownLite('Top products:\n- **Hoodie**: $10\n* Cap\n\nDone');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'p']);
    expect(blocks[1]).toEqual({
      kind: 'ul',
      items: [
        [
          { text: 'Hoodie', bold: true },
          { text: ': $10', bold: false },
        ],
        [{ text: 'Cap', bold: false }],
      ],
    });
  });

  it('turns headings into a bold line and normalizes CRLF', () => {
    expect(parseMarkdownLite('## Summary\r\nAll good')).toEqual([
      {
        kind: 'p',
        lines: [[{ text: 'Summary', bold: true }], [{ text: 'All good', bold: false }]],
      },
    ]);
  });

  it('keeps an unmatched ** as literal text', () => {
    expect(parseInline('a **b** and **c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' and **c', bold: false },
    ]);
    expect(parseInline('a ** b')).toEqual([{ text: 'a ** b', bold: false }]);
  });
});

describe('MarkdownLite', () => {
  function render(text: string): HTMLElement {
    const fixture = TestBed.createComponent(MarkdownLite);
    fixture.componentRef.setInput('text', text);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders paragraphs, bullets and bold text', () => {
    const el = render('Revenue is **$1,200**.\n\n- one\n- **two**');
    expect(el.querySelector('p strong')?.textContent).toBe('$1,200');
    expect([...el.querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual([
      'one',
      'two',
    ]);
    expect(el.querySelector('li strong')?.textContent).toBe('two');
  });

  it('escapes model output instead of rendering it as HTML', () => {
    const el = render('<img src=x onerror="alert(1)"> **<script>alert(2)</script>**');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(el.querySelector('strong')?.textContent).toBe('<script>alert(2)</script>');
  });
});
