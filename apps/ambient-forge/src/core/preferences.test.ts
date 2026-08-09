import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from './preferences';

describe('preferences', () => {
  it('使用版本化格式往返保存安全设置', () => {
    const value = { ...DEFAULT_PREFERENCES, weather: 'snow' as const, quality: 'high' as const };
    expect(parsePreferences(serializePreferences(value))).toEqual(value);
  });

  it('对非法版本、越界值和损坏 JSON 回退默认值', () => {
    expect(parsePreferences('{broken')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(JSON.stringify({ version: 99, settings: {} }))).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      parsePreferences(
        JSON.stringify({ version: 1, settings: { weatherIntensity: 10, quality: 'ultra' } }),
      ),
    ).toEqual(DEFAULT_PREFERENCES);
  });
});
