import type { QualityLevel } from './quality';

export interface AdaptiveQualityState {
  preferred: QualityLevel;
  effective: QualityLevel;
  lowFpsSeconds: number;
  stableSeconds: number;
  cooldownSeconds: number;
}

const QUALITY_ORDER: readonly QualityLevel[] = ['low', 'medium', 'high'];
const DOWNGRADE_FPS = 45;
const RECOVERY_FPS = 56;
const DOWNGRADE_SECONDS = 2;
const RECOVERY_SECONDS = 10;
const SWITCH_COOLDOWN_SECONDS = 6;

export function createAdaptiveQualityState(preferred: QualityLevel): AdaptiveQualityState {
  return {
    preferred,
    effective: preferred,
    lowFpsSeconds: 0,
    stableSeconds: 0,
    cooldownSeconds: 0,
  };
}

export function setAdaptiveQualityPreference(
  state: Readonly<AdaptiveQualityState>,
  preferred: QualityLevel,
): AdaptiveQualityState {
  if (state.preferred === preferred && state.effective === preferred) return { ...state };
  return createAdaptiveQualityState(preferred);
}

export function stepAdaptiveQuality(
  state: Readonly<AdaptiveQualityState>,
  fps: number,
  deltaSeconds: number,
): AdaptiveQualityState {
  const delta = Math.max(0, deltaSeconds);
  if (!Number.isFinite(fps) || delta === 0) return { ...state };

  const activeDelta = Math.max(0, delta - state.cooldownSeconds);
  const cooldownSeconds = Math.max(0, state.cooldownSeconds - delta);
  if (activeDelta === 0) {
    return { ...state, cooldownSeconds, lowFpsSeconds: 0, stableSeconds: 0 };
  }

  const currentIndex = QUALITY_ORDER.indexOf(state.effective);
  const preferredIndex = QUALITY_ORDER.indexOf(state.preferred);
  if (fps < DOWNGRADE_FPS && currentIndex > 0) {
    const lowFpsSeconds = state.lowFpsSeconds + activeDelta;
    if (lowFpsSeconds >= DOWNGRADE_SECONDS) {
      return {
        ...state,
        effective: QUALITY_ORDER[currentIndex - 1] ?? 'low',
        lowFpsSeconds: 0,
        stableSeconds: 0,
        cooldownSeconds: SWITCH_COOLDOWN_SECONDS,
      };
    }
    return { ...state, lowFpsSeconds, stableSeconds: 0, cooldownSeconds };
  }

  if (fps > RECOVERY_FPS && currentIndex < preferredIndex) {
    const stableSeconds = state.stableSeconds + activeDelta;
    if (stableSeconds >= RECOVERY_SECONDS) {
      return {
        ...state,
        effective: QUALITY_ORDER[currentIndex + 1] ?? state.preferred,
        lowFpsSeconds: 0,
        stableSeconds: 0,
        cooldownSeconds: SWITCH_COOLDOWN_SECONDS,
      };
    }
    return { ...state, lowFpsSeconds: 0, stableSeconds, cooldownSeconds };
  }

  return { ...state, lowFpsSeconds: 0, stableSeconds: 0, cooldownSeconds };
}
