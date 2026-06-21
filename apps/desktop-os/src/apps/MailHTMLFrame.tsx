import DOMPurify from 'dompurify';
import { useMemo } from 'react';

type MailHTMLFrameProps = {
  html: string;
  title?: string;
};

const blockedTags = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
];

export default function MailHTMLFrame({ html, title = '邮件正文' }: MailHTMLFrameProps) {
  const srcDoc = useMemo(() => {
    const cleanHTML = DOMPurify.sanitize(html, {
      FORBID_TAGS: blockedTags,
      ADD_ATTR: ['target', 'rel'],
    });

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline' https: http:; font-src https: http: data:; script-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
    <base target="_blank" />
    <style>
      :root {
        color: #5a4a3a;
        background: #fffaf0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      html,
      body {
        min-height: 100%;
        margin: 0;
      }
      body {
        box-sizing: border-box;
        padding: 18px;
        overflow-wrap: anywhere;
        line-height: 1.6;
      }
      img,
      table {
        max-width: 100%;
      }
      img {
        height: auto;
      }
      a {
        color: #3f738a;
        font-weight: 700;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      blockquote {
        margin: 12px 0;
        padding: 8px 12px;
        border-left: 3px solid rgba(143, 180, 94, 0.55);
        background: rgba(238, 244, 213, 0.38);
      }
      pre,
      code {
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>${cleanHTML}</body>
</html>`;
  }, [html]);

  return (
    <iframe
      className="mail-html-frame"
      sandbox=""
      srcDoc={srcDoc}
      title={title}
      referrerPolicy="no-referrer"
    />
  );
}
