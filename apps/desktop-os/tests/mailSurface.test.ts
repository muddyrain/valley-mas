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
    expect(mailWindow).not.toContain('sendMail');
  });
});
