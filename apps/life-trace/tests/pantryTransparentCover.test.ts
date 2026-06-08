import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePantryTransparentCover } from '@/api/pantry';
import { uploadLifeTraceImage } from '@/api/upload';
import { generatePantryTransparentCoverWithFallback } from '@/lib/pantryTransparentCover';

vi.mock('@/api/pantry', () => ({
  generatePantryTransparentCover: vi.fn(),
}));

vi.mock('@/api/upload', () => ({
  uploadLifeTraceImage: vi.fn(),
}));

const token = 'test-token';

afterEach(() => {
  vi.clearAllMocks();
});

describe('pantry transparent cover fallback', () => {
  it('uses remove.bg when the backend transparent cover endpoint succeeds', async () => {
    vi.mocked(generatePantryTransparentCover).mockResolvedValueOnce({
      thumbnailUrl: 'https://cdn.example.com/remove-bg.png',
      source: 'remove-bg',
      tool: 'remove.bg',
      format: 'png',
    });
    const localRunner = vi.fn();

    const result = await generatePantryTransparentCoverWithFallback(
      token,
      { imageUrl: 'https://cdn.example.com/original.jpg' },
      { localRunner },
    );

    expect(result.thumbnailUrl).toBe('https://cdn.example.com/remove-bg.png');
    expect(result.source).toBe('remove-bg');
    expect(localRunner).not.toHaveBeenCalled();
    expect(uploadLifeTraceImage).not.toHaveBeenCalled();
  });

  it('falls back to local IMG.LY cutout and uploads the PNG when remove.bg fails', async () => {
    vi.mocked(generatePantryTransparentCover).mockRejectedValueOnce(new Error('remove.bg quota'));
    vi.mocked(uploadLifeTraceImage).mockResolvedValueOnce({
      url: 'https://cdn.example.com/local-cutout.png',
      storageKey: 'life-trace/1/local-cutout.png',
      fileName: 'local-cutout.png',
      size: 3,
      contentType: 'image/png',
    });
    const sourceImage = new Blob(['jpg'], { type: 'image/jpeg' });
    const localRunner = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));

    const result = await generatePantryTransparentCoverWithFallback(
      token,
      { imageUrl: 'https://cdn.example.com/original.jpg' },
      { sourceImage, localRunner },
    );

    expect(localRunner).toHaveBeenCalledWith(sourceImage, { signal: undefined });
    expect(uploadLifeTraceImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadLifeTraceImage).mock.calls[0][1]).toBeInstanceOf(File);
    expect(result).toMatchObject({
      thumbnailUrl: 'https://cdn.example.com/local-cutout.png',
      source: 'imgly-local',
      tool: '@imgly/background-removal',
      model: 'isnet_quint8',
      localFallback: true,
    });
  });

  it('does not run local fallback when the cloud request was aborted', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    vi.mocked(generatePantryTransparentCover).mockRejectedValueOnce(abortError);
    const localRunner = vi.fn();

    await expect(
      generatePantryTransparentCoverWithFallback(
        token,
        { imageUrl: 'https://cdn.example.com/original.jpg' },
        { localRunner },
      ),
    ).rejects.toThrow('aborted');

    expect(localRunner).not.toHaveBeenCalled();
    expect(uploadLifeTraceImage).not.toHaveBeenCalled();
  });
});
