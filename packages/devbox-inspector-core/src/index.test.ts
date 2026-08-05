import { describe, expect, test } from 'vitest';
import {
  buildOpenUrl,
  DEFAULT_EDITOR_TEMPLATE,
  isAbsoluteWorkspaceRoot,
  parseInspectionValue,
  resolveOpenTarget,
} from './index';

describe('devbox inspector core', () => {
  test('parseInspectionValue handles tag suffix', () => {
    expect(parseInspectionValue('src/App.tsx:12:34:div')).toEqual({
      relativePath: 'src/App.tsx',
      line: 12,
      column: 34,
      extra: 'div',
    });
  });

  test('parseInspectionValue supports windows-style path fragment', () => {
    expect(parseInspectionValue('src:foo:bar.tsx:120:8')).toEqual({
      relativePath: 'src:foo:bar.tsx',
      line: 120,
      column: 8,
      extra: '',
    });
  });

  test('resolveOpenTarget fails without absolute workspaceRoot', () => {
    expect(
      resolveOpenTarget('src/App.tsx:1:2', 'relative/path', DEFAULT_EDITOR_TEMPLATE),
    ).toMatchObject({
      ok: false,
      reason: 'no-workspace-root',
    });
  });

  test('resolveOpenTarget builds deep link', () => {
    expect(
      resolveOpenTarget('src/App.tsx:1:2', '/Users/me/proj', DEFAULT_EDITOR_TEMPLATE),
    ).toMatchObject({
      ok: true,
    });
  });

  test('buildOpenUrl replaces placeholders', () => {
    expect(
      buildOpenUrl('vscode://file{path}:{line}:{col}', {
        path: '/Users/me/proj/src/App.tsx',
        relPath: 'src/App.tsx',
        line: 3,
        col: 4,
      }),
    ).toBe('vscode://file/Users/me/proj/src/App.tsx:3:4');
  });

  test('isAbsoluteWorkspaceRoot accepts unix absolute path', () => {
    expect(isAbsoluteWorkspaceRoot('/Users/me/proj')).toBe(true);
    expect(isAbsoluteWorkspaceRoot('C:\\Users\\me\\proj')).toBe(false);
  });
});
