import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadScreenshotImage } from './screenshot-image';

afterEach(() => vi.unstubAllGlobals());

describe('shared desktop image decoding', () => {
  it('shares one decode across selection and editor, including concurrent callers', async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    const ImageConstructor = vi.fn(
      class {
        decode = decode;
      },
    );
    vi.stubGlobal('Image', ImageConstructor);
    const selecting = loadScreenshotImage('capture-frame://desktop/first');
    const editing = loadScreenshotImage('capture-frame://desktop/first');
    expect(editing).toBe(selecting);
    expect(await editing).toBe(await selecting);
    expect(ImageConstructor).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    await loadScreenshotImage('capture-frame://desktop/next-display');
    expect(ImageConstructor).toHaveBeenCalledTimes(2);
  });

  it('allows retry after a decode error instead of retaining a failed image', async () => {
    const decode = vi
      .fn()
      .mockRejectedValueOnce(new Error('decode failed'))
      .mockResolvedValue(undefined);
    vi.stubGlobal(
      'Image',
      class {
        decode = decode;
      },
    );
    await expect(loadScreenshotImage('capture-frame://desktop/retry')).rejects.toThrow(
      'decode failed',
    );
    await expect(loadScreenshotImage('capture-frame://desktop/retry')).resolves.toBeDefined();
    expect(decode).toHaveBeenCalledTimes(2);
  });
});
