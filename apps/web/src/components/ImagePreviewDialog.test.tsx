import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ImagePreviewDialog, {
  resolveInitialImageLoadState,
  shouldRestoreImagePreviewFocus,
} from './ImagePreviewDialog';

describe('ImagePreviewDialog', () => {
  it('renders safely while closed', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ImagePreviewDialog open={false} onOpenChange={() => undefined} />
      </MemoryRouter>,
    );

    expect(markup).toBe('');
  });

  it('does not restore the loading overlay over an already cached image', () => {
    expect(
      resolveInitialImageLoadState('/reference.png', {
        complete: true,
        naturalWidth: 797,
        naturalHeight: 1047,
      }),
    ).toEqual({
      loading: false,
      size: { width: 797, height: 1047 },
    });
  });

  it('only restores focus when the preview is closed from the keyboard', () => {
    expect(shouldRestoreImagePreviewFocus('keyboard')).toBe(true);
    expect(shouldRestoreImagePreviewFocus('mouse')).toBe(false);
    expect(shouldRestoreImagePreviewFocus('touch')).toBe(false);
    expect(shouldRestoreImagePreviewFocus('pen')).toBe(false);
    expect(shouldRestoreImagePreviewFocus('')).toBe(false);
  });
});
