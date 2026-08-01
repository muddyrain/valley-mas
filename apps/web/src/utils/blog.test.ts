import { describe, expect, it } from 'vitest';
import {
  createPlainTextExcerpt,
  extractToc,
  markdownToPlainText,
  normalizeHtmlImageTags,
  normalizeOrderedListStarts,
  renderMarkdownWithAnchors,
} from './blog';

describe('blog Markdown utilities', () => {
  it('normalizes zero-prefixed ordered lists without changing fenced code', () => {
    const content = ['000. First', '  > 00) Quoted', '```md', '000. Code sample', '```'].join('\n');

    expect(normalizeOrderedListStarts(content)).toBe(
      ['1. First', '  > 1) Quoted', '```md', '000. Code sample', '```'].join('\n'),
    );
  });

  it('converts HTML image tags for the editor without touching fenced examples', () => {
    const content = [
      '<img alt="[cover]" src="https://example.com/a b.png">',
      '```html',
      '<img src="keep.png">',
      '```',
    ].join('\n');

    expect(normalizeHtmlImageTags(content)).toBe(
      [
        '![\\[cover\\]](<https://example.com/a b.png>)',
        '```html',
        '<img src="keep.png">',
        '```',
      ].join('\n'),
    );
  });

  it('creates stable, unique heading anchors and a matching table of contents', () => {
    const content = '# Welcome!\n\n## Welcome!\n\n## 中文标题';

    expect(extractToc(content)).toEqual([
      { level: 1, text: 'Welcome!', id: 'welcome' },
      { level: 2, text: 'Welcome!', id: 'welcome-2' },
      { level: 2, text: '中文标题', id: '中文标题' },
    ]);
    expect(renderMarkdownWithAnchors(content)).toContain('<h2 id="welcome-2">Welcome!</h2>');
  });

  it('creates readable plain text and truncates excerpts at the requested boundary', () => {
    const content = '# Title\n\n**Hello** [world](https://example.com)!\n\n`const x = 1`';

    expect(markdownToPlainText(content)).toBe('Title\nHello world!\nconst x = 1');
    expect(createPlainTextExcerpt(content, 12)).toBe('Title\nHello...');
  });
});
