import {
  DOMINANT_SHARE_FULL,
  DOMINANT_SHARE_START,
  EXPANSION_ATTEMPTS_MAX,
  EXPANSION_ATTEMPTS_MIN,
  EXPANSION_ATTEMPTS_MULTIPLIER,
  SPEEDUP_FULL_OCCUPIED,
  SPEEDUP_LIVE_FACTIONS_FULL,
  SPEEDUP_LIVE_FACTIONS_START,
  SPEEDUP_MAX_MULTIPLIER,
  SPEEDUP_START_OCCUPIED,
  SMALL_REALM_COLLAPSE_FULL_OCCUPIED,
  SMALL_REALM_COLLAPSE_MAX_BONUS,
  SMALL_REALM_COLLAPSE_REGION_THRESHOLD,
  SMALL_REALM_COLLAPSE_START_OCCUPIED,
  STRENGTH_BIAS_SCALE_DOMINANT,
  STRENGTH_BIAS_SCALE_NORMAL,
  WAR_PREFERENCE_FULL_OCCUPIED,
  WAR_PREFERENCE_MAX,
  WAR_PREFERENCE_MIN,
  WAR_PREFERENCE_START_OCCUPIED,
} from '@/shared/types';

type TempoConfigInput = {
  occupiedRatio: number;
  liveCount: number;
  largestFactionShare: number;
};

export type TempoConfig = {
  label: string;
  isEndgame: boolean;
  speedMultiplier: number;
  attempts: number;
  ownedTargetPreference: number;
  strengthBiasScale: number;
};

export function getTempoConfig(input: TempoConfigInput): TempoConfig {
  const warProgress = smoothstep(
    WAR_PREFERENCE_START_OCCUPIED,
    WAR_PREFERENCE_FULL_OCCUPIED,
    input.occupiedRatio,
  );
  const occupiedSpeedProgress = smoothstep(
    SPEEDUP_START_OCCUPIED,
    SPEEDUP_FULL_OCCUPIED,
    input.occupiedRatio,
  );
  const liveCollapseProgress = smoothstep(
    SPEEDUP_LIVE_FACTIONS_START,
    SPEEDUP_LIVE_FACTIONS_FULL,
    input.liveCount,
  );
  const dominantProgress = smoothstep(
    DOMINANT_SHARE_START,
    DOMINANT_SHARE_FULL,
    input.largestFactionShare,
  );
  const endgameProgress = Math.max(occupiedSpeedProgress, liveCollapseProgress);
  const speedMultiplier = 1 + (SPEEDUP_MAX_MULTIPLIER - 1) * endgameProgress;
  const ownedTargetPreference = lerp(WAR_PREFERENCE_MIN, WAR_PREFERENCE_MAX, warProgress);
  const strengthBiasScale = lerp(
    STRENGTH_BIAS_SCALE_NORMAL,
    STRENGTH_BIAS_SCALE_DOMINANT,
    dominantProgress,
  );

  return {
    label: getTempoLabel(warProgress, endgameProgress),
    isEndgame: endgameProgress >= 0.5,
    speedMultiplier,
    attempts: Math.round(
      clamp(
        input.liveCount * EXPANSION_ATTEMPTS_MULTIPLIER * speedMultiplier,
        EXPANSION_ATTEMPTS_MIN * speedMultiplier,
        EXPANSION_ATTEMPTS_MAX * speedMultiplier,
      ),
    ),
    ownedTargetPreference,
    strengthBiasScale,
  };
}

export function getOwnedTargetPreference(occupiedRatio: number): number {
  return lerp(
    WAR_PREFERENCE_MIN,
    WAR_PREFERENCE_MAX,
    smoothstep(WAR_PREFERENCE_START_OCCUPIED, WAR_PREFERENCE_FULL_OCCUPIED, occupiedRatio),
  );
}

export function getSmallRealmCollapseBias(occupiedRatio: number, defenderRegions: number): number {
  if (defenderRegions >= SMALL_REALM_COLLAPSE_REGION_THRESHOLD) return 0;
  const occupiedProgress = smoothstep(
    SMALL_REALM_COLLAPSE_START_OCCUPIED,
    SMALL_REALM_COLLAPSE_FULL_OCCUPIED,
    occupiedRatio,
  );
  const sizeProgress =
    (SMALL_REALM_COLLAPSE_REGION_THRESHOLD - Math.max(1, defenderRegions)) /
    (SMALL_REALM_COLLAPSE_REGION_THRESHOLD - 1);
  return SMALL_REALM_COLLAPSE_MAX_BONUS * occupiedProgress * sizeProgress;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function getTempoLabel(warProgress: number, endgameProgress: number): string {
  if (endgameProgress >= 0.5) return '终局';
  if (warProgress < 0.25) return '早期扩张';
  if (warProgress < 0.75) return '接触战争';
  return '霸权吞并';
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
