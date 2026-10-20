import { expect, it } from 'vitest';
import { getScreenshotCommand } from './screenshot-command';

it('maps completion, file saving, undo and redo without hijacking text editing', () => {
  const key = (key: string, modifiers = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  });
  expect(getScreenshotCommand(key('Enter'), false)).toBe('copy');
  expect(getScreenshotCommand(key('c', { metaKey: true }), false)).toBe('copy');
  expect(getScreenshotCommand(key('s', { metaKey: true }), false)).toBe('save');
  expect(getScreenshotCommand(key('z', { metaKey: true, shiftKey: true }), false)).toBe('redo');
  expect(getScreenshotCommand(key('y', { ctrlKey: true }), false)).toBe('redo');
  expect(getScreenshotCommand(key('z', { metaKey: true }), true)).toBeUndefined();
  expect(getScreenshotCommand(key('c', { metaKey: true }), true)).toBeUndefined();
  expect(getScreenshotCommand(key('Enter'), true)).toBeUndefined();
  expect(getScreenshotCommand(key('s', { metaKey: true }), true)).toBe('save');
  expect(getScreenshotCommand(key('Enter', { isComposing: true }), false)).toBeUndefined();
});
