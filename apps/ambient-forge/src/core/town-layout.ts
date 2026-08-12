export const TOWN_LAYOUT_SCALE = 1.35;
export const TOWN_PLAYABLE_MIN_X = -72 * TOWN_LAYOUT_SCALE;
export const TOWN_PLAYABLE_MAX_X = 72 * TOWN_LAYOUT_SCALE;
export const TOWN_PLAYABLE_MIN_Z = -62 * TOWN_LAYOUT_SCALE;
export const TOWN_PLAYABLE_MAX_Z = 66 * TOWN_LAYOUT_SCALE;
export const TOWN_PLAYABLE_HALF_WIDTH = Math.max(
  Math.abs(TOWN_PLAYABLE_MIN_X),
  Math.abs(TOWN_PLAYABLE_MAX_X),
);
export const TOWN_PLAYABLE_HALF_DEPTH = Math.max(
  Math.abs(TOWN_PLAYABLE_MIN_Z),
  Math.abs(TOWN_PLAYABLE_MAX_Z),
);

export const scaleTownVec2 = (position: readonly [number, number]): readonly [number, number] => [
  position[0] * TOWN_LAYOUT_SCALE,
  position[1] * TOWN_LAYOUT_SCALE,
];

export const scaleTownVec3 = (
  position: readonly [number, number, number],
): readonly [number, number, number] => [
  position[0] * TOWN_LAYOUT_SCALE,
  position[1],
  position[2] * TOWN_LAYOUT_SCALE,
];
