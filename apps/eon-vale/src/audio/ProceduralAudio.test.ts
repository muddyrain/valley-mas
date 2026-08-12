import { describe, expect, it } from 'vitest';
import { toneProfile } from './ProceduralAudio';

describe('procedural audio cues', () => {
  it('uses distinct profiles for creation, intervention and danger', () => {
    expect(toneProfile('create')).not.toEqual(toneProfile('power'));
    expect(toneProfile('danger').frequency).toBeLessThan(toneProfile('power').frequency);
  });
});
