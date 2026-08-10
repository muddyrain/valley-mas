import { describe, expect, it } from 'vitest';
import { getSelectionSurfaceLayers, getSelectionSurfaceMode } from './selection-surface';

describe('getSelectionSurfaceMode', () => {
  it('reuses the selection window for screenshot editing', () => {
    expect(getSelectionSurfaceMode('selecting')).toBe('selection');
    expect(getSelectionSurfaceMode('capturing')).toBe('selection');
    expect(getSelectionSurfaceMode('editing')).toBe('screenshot-editor');
    expect(getSelectionSurfaceMode('long-capturing')).toBe('screenshot-editor');
  });

  it('does not remount a selection overlay after the screenshot task ends', () => {
    expect(getSelectionSurfaceMode('idle')).toBe('empty');
    expect(getSelectionSurfaceMode('completed')).toBe('empty');
    expect(getSelectionSurfaceMode('error')).toBe('empty');
  });

  it('keeps the selection frame covering the desktop until the editor canvas is ready', () => {
    expect(getSelectionSurfaceLayers('selection', false)).toEqual({
      showEditor: false,
      showSelection: true,
    });
    expect(getSelectionSurfaceLayers('screenshot-editor', false)).toEqual({
      showEditor: true,
      showSelection: true,
    });
    expect(getSelectionSurfaceLayers('screenshot-editor', true)).toEqual({
      showEditor: true,
      showSelection: false,
    });
  });
});
