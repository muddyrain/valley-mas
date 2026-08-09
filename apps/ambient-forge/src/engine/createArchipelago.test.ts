import { describe, expect, it } from 'vitest';
import { getQualityProfile } from '../core/quality';
import { createArchipelago } from './createArchipelago';

describe('createArchipelago', () => {
  it('装配三座主题副岛和可按质量档裁剪的远景岛链', () => {
    const archipelago = createArchipelago(getQualityProfile('high'));

    expect(archipelago.root.getObjectByName('lantern-garden-island')?.userData.cameraView).toBe(
      'garden',
    );
    expect(archipelago.root.getObjectByName('crystal-grove-island')?.userData.cameraView).toBe(
      'crystal',
    );
    expect(archipelago.root.getObjectByName('ruined-pool-island')?.userData.cameraView).toBe(
      'ruins',
    );
    expect(archipelago.root.getObjectByName('garden-suspension-bridge')).toBeTruthy();
    expect(archipelago.getEffectCount()).toBe(5);

    archipelago.setQuality(getQualityProfile('low'));

    expect(archipelago.getEffectCount()).toBe(3);
    archipelago.dispose();
  });
});
