import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './random';

describe('createSeededRandom', () => {
  it('replays the same world sequence for the same seed', () => {
    const first = createSeededRandom('eon-vale');
    const second = createSeededRandom('eon-vale');

    expect(Array.from({ length: 16 }, first)).toEqual(Array.from({ length: 16 }, second));
  });
});
