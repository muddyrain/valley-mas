import { describe, expect, it } from 'vitest';
import { appendResourcePolicyFormData, validateResourcePolicy } from './resourcePolicy';

describe('resourcePolicy', () => {
  it('requires an original link for licensed collections', () => {
    expect(
      validateResourcePolicy({
        sourceKind: 'licensed',
        sourceUrl: '',
        license: 'preview_only',
      }),
    ).toBe('请填写原始出处');
  });

  it('serializes explicit source and license fields for upload', () => {
    const formData = new FormData();
    appendResourcePolicyFormData(formData, {
      sourceKind: 'ai_generated',
      sourceUrl: '',
      license: 'download_allowed',
    });

    expect(formData.get('sourceKind')).toBe('ai_generated');
    expect(formData.get('license')).toBe('download_allowed');
    expect(formData.get('downloadAllowed')).toBe('true');
  });
});
