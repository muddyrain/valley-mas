import { describe, expect, it } from 'vitest';
import { isAllowedIpcSender } from './ipc-source';

describe('isAllowedIpcSender', () => {
  it('accepts either the selection window or recording setup window', () => {
    expect(isAllowedIpcSender(12, [12, 24])).toBe(true);
    expect(isAllowedIpcSender(24, [12, 24])).toBe(true);
  });

  it('rejects unknown and missing window ids', () => {
    expect(isAllowedIpcSender(36, [12, 24])).toBe(false);
    expect(isAllowedIpcSender(12, [undefined, 24])).toBe(false);
  });
});
