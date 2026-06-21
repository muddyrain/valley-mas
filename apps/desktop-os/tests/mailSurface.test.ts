import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('mail desktop surface', () => {
  it('registers Mail as a real Desktop OS app and Dock window target', () => {
    const appRegistry = readSource('src/apps/desktopApps.ts');
    const appRenderers = readSource('src/apps/appRenderers.tsx');
    const dockStore = readSource('src/store/dockStore.ts');

    expect(appRegistry).toContain("| 'mail'");
    expect(appRegistry).toContain("id: 'mail'");
    expect(appRegistry).toContain("title: '邮件'");
    expect(appRegistry).toContain("icon: '/icons/mail.png'");
    expect(appRenderers).toContain('MailWindow');
    expect(appRenderers).toContain('mail: () => <MailWindow />');
    expect(dockStore).not.toContain("id: 'mail',\n    label: '邮件'");
  });

  it('adds mailbox binding controls to Account and a read-only Mail window', () => {
    const accountWindow = readSource('src/apps/AccountWindow.tsx');
    const mailWindow = readSource('src/apps/MailWindow.tsx');

    expect(accountWindow).toContain('邮箱绑定');
    expect(accountWindow).toContain('bindQQMailAccount');
    expect(accountWindow).toContain('startGmailBinding');
    expect(mailWindow).toContain('统一收件箱');
    expect(mailWindow).toContain('syncMailAccount');
    expect(mailWindow).toContain('listMailMessages');
    expect(mailWindow).toContain('MailHTMLFrame');
    expect(mailWindow).toContain('MailBodyText');
    expect(mailWindow).toContain('mail-window__reader');
    expect(mailWindow).toContain('mail-message__meta');
    expect(mailWindow).toContain('mail-window__account-card');
    expect(mailWindow).not.toContain('sendMail');
  });

  it('renders HTML mail inside a sanitized sandbox iframe', () => {
    const mailApi = readSource('src/api/mail.ts');
    const htmlFrame = readSource('src/apps/MailHTMLFrame.tsx');

    expect(mailApi).toContain('htmlBody?: string');
    expect(htmlFrame).toContain("from 'dompurify'");
    expect(htmlFrame).toContain('DOMPurify.sanitize');
    expect(htmlFrame).toContain('sandbox=""');
    expect(htmlFrame).toContain('srcDoc');
  });

  it('keeps Mail window chrome fixed while only pane content scrolls', () => {
    const windowStyles = readSource('src/components/window/Window.css');
    const styles = readSource('src/apps/DockAppWindows.css');
    const mailWindow = readSource('src/apps/MailWindow.tsx');
    const accountCardRule = styles.match(/\.mail-window__account-card\s*{(?<body>[^}]*)}/s)?.groups
      ?.body;

    expect(mailWindow).toContain('mail-window__accounts-scroll');
    expect(mailWindow).toContain('mail-window__message-list');
    expect(mailWindow).toContain('mail-window__reader-body');
    expect(windowStyles).toMatch(
      /\.window__body-content:has\(\.mail-window\)\s*{[^}]*height:\s*100%;/s,
    );
    expect(windowStyles).toMatch(
      /\.window__body-content:has\(\.mail-window\)\s*{[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(/\.mail-window\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.mail-window\s*{[^}]*height:\s*100%;/s);
    expect(styles).toMatch(/\.mail-window__layout\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.mail-window__layout\s*{[^}]*align-items:\s*stretch;/s);
    expect(styles).toMatch(/\.mail-window__accounts\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.mail-window__messages\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.mail-window__accounts-scroll\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).toMatch(/\.mail-window__message-list\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).toMatch(/\.mail-window__reader-body\s*{[^}]*overflow:\s*auto;/s);
    expect(styles).toMatch(/\.mail-window__reader\s*{[^}]*overflow:\s*hidden;/s);
    expect(styles).not.toMatch(/\.mail-window__detail\s*{[^}]*overflow:\s*auto;/s);
    expect(accountCardRule).not.toContain('flex: 1;');
  });
});
