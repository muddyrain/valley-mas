import { describe, expect, it } from 'vitest';
import { OPTION_PICKER_Z_INDEX_CLASS } from './OptionPickerSheet';

describe('OPTION_PICKER_Z_INDEX_CLASS', () => {
  it('stays above the parent bottom sheet layer', () => {
    expect(OPTION_PICKER_Z_INDEX_CLASS).toBe('z-[80]');
  });
});
