import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const profilePageSource = readFileSync(resolve(__dirname, '../src/pages/ProfilePage.tsx'), 'utf8');
const reminderSettingsPageSource = readFileSync(
  resolve(__dirname, '../src/pages/ReminderSettingsPage.tsx'),
  'utf8',
);

describe('profile page surface', () => {
  it('keeps the hero summary free of duplicate daily brief timing copy', () => {
    expect(profilePageSource).not.toContain(
      '{settings.commuteMethod}通勤 · {settings.dailyBriefTime} 简报',
    );
    expect(profilePageSource).toContain('工作时段');
  });

  it('keeps developer analysis copy out of the visible profile settings UI', () => {
    expect(profilePageSource).not.toContain('天气城市会影响 Today');
    expect(profilePageSource).not.toContain('这里只保留摘要和入口');
  });

  it('exposes an immediate daily brief preview entry inside reminder settings', () => {
    expect(reminderSettingsPageSource).toContain('立即预览简报通知');
  });
});
