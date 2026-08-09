import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHOTO_MODE_STATE,
  getPhotoFilterStyle,
  setPhotoModeEnabled,
  updatePhotoModeSettings,
} from './photo-mode';

describe('photo mode', () => {
  it('进入和退出摄影模式时保留构图设置', () => {
    const configured = updatePhotoModeSettings(DEFAULT_PHOTO_MODE_STATE, {
      grid: true,
      depthOfField: true,
      filter: 'warm',
    });
    const enabled = setPhotoModeEnabled(configured, true);
    expect(enabled).toEqual({ enabled: true, grid: true, depthOfField: true, filter: 'warm' });
    expect(setPhotoModeEnabled(enabled, false)).toMatchObject({
      enabled: false,
      grid: true,
      depthOfField: true,
      filter: 'warm',
    });
  });

  it('为自然、暖色、冷色和电影滤镜提供可用于截图的 CSS 过滤器', () => {
    expect(getPhotoFilterStyle('natural')).toBe('none');
    expect(getPhotoFilterStyle('warm')).toContain('sepia');
    expect(getPhotoFilterStyle('cool')).toContain('hue-rotate');
    expect(getPhotoFilterStyle('cinematic')).toContain('contrast');
  });
});
