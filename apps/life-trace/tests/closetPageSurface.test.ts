import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
const todayPageSource = readFileSync(resolve(__dirname, '../src/pages/TodayPage.tsx'), 'utf8');
const aiPageSource = readFileSync(resolve(__dirname, '../src/pages/AiPage.tsx'), 'utf8');
const profilePageSource = readFileSync(resolve(__dirname, '../src/pages/ProfilePage.tsx'), 'utf8');
const closetApiSource = readFileSync(resolve(__dirname, '../src/api/closet.ts'), 'utf8');
const closetPagePath = resolve(__dirname, '../src/pages/ClosetPage.tsx');
const clothingAnalysisPagePath = resolve(__dirname, '../src/pages/PhotoClothingAnalysisPage.tsx');

describe('closet page surface', () => {
  it('registers closet routes and primary entry points', () => {
    expect(existsSync(closetPagePath)).toBe(true);
    expect(existsSync(clothingAnalysisPagePath)).toBe(true);
    expect(appSource).toContain('path="/closet"');
    expect(appSource).toContain('path="/closet/items/:itemId"');
    expect(appSource).toContain('path="/closet/outfits/:outfitId"');
    expect(appSource).toContain('path="/ai/photo-clothing-analysis"');
    expect(todayPageSource).toContain('今日穿搭');
    expect(todayPageSource).toContain("navigate('/closet')");
    expect(todayPageSource).toContain("navigate('/ai/photo-clothing-analysis')");
    expect(aiPageSource).toContain('label="今日穿搭"');
    expect(aiPageSource).toContain('label="拍照识别衣物"');
    expect(profilePageSource).toContain("navigate('/closet')");
    expect(profilePageSource).toContain('衣橱与穿搭');
  });

  it('keeps closet API calls aligned with backend routes', () => {
    expect(closetApiSource).toContain('/life-trace/closet/items');
    expect(closetApiSource).toContain('/life-trace/closet/outfits');
    expect(closetApiSource).toContain('/life-trace/ai/clothing-photo-analysis');
    expect(closetApiSource).toContain('/life-trace/ai/outfit-suggestions');
  });

  it('keeps developer analysis copy out of visible closet UI', () => {
    const closetPageSource = readFileSync(closetPagePath, 'utf8');
    const clothingAnalysisPageSource = readFileSync(clothingAnalysisPagePath, 'utf8');

    expect(closetPageSource).not.toContain('这个页面');
    expect(closetPageSource).not.toContain('用于');
    expect(clothingAnalysisPageSource).not.toContain('这个页面');
    expect(clothingAnalysisPageSource).not.toContain('用于');
  });
});
