import { describe, expect, it } from 'vitest';
import { isDevInspectorEnabled } from './devInspector';

describe('isDevInspectorEnabled', () => {
  it('keeps the inspector disabled unless explicitly enabled', () => {
    expect(isDevInspectorEnabled(undefined)).toBe(false);
    expect(isDevInspectorEnabled('false')).toBe(false);
    expect(isDevInspectorEnabled('true')).toBe(true);
  });
});
