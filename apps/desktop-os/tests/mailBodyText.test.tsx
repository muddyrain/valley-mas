import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MailBodyText from '../src/apps/MailBodyText';

describe('MailBodyText', () => {
  it('renders plain text as readable paragraphs with safe links and quotes', () => {
    const html = renderToStaticMarkup(
      <MailBodyText
        text={[
          'Hello from inbox.',
          '',
          '> A quoted reply',
          '',
          'Read more at https://example.com/news?from=mail',
        ].join('\n')}
      />,
    );

    expect(html).toContain('mail-body-text__paragraph');
    expect(html).toContain('mail-body-text__quote');
    expect(html).toContain('href="https://example.com/news?from=mail"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it('keeps html-looking content as escaped text', () => {
    const html = renderToStaticMarkup(
      <MailBodyText text={'<strong>Injected</strong>\n<script>alert(1)</script>'} />,
    );

    expect(html).toContain('&lt;strong&gt;Injected&lt;/strong&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<strong>Injected</strong>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders a compact fallback for empty mail bodies', () => {
    const html = renderToStaticMarkup(<MailBodyText text="" fallback="暂无正文预览" />);

    expect(html).toContain('mail-body-text__empty');
    expect(html).toContain('暂无正文预览');
  });
});
