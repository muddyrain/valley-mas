import type { ClimberLevelDefinition, ClimberPlatformDefinition, ToyPlatformKind } from '../types';

const barn = (
  id: string,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  kind: ToyPlatformKind,
  visualVariant: string,
  extra: Partial<ClimberPlatformDefinition> = {},
): ClimberPlatformDefinition => ({
  id,
  size,
  position,
  color,
  toyProfile: {
    kind,
    themeZone: 'barn',
    difficultyTier: position[1] < 14 ? 'tutorial' : position[1] < 32 ? 'easy' : 'medium',
    visualVariant,
  },
  ...extra,
});

export const TOY_ANIMAL_CLIMB_WORLD_LEVEL: ClimberLevelDefinition = {
  id: 'toy-animal-climb-world',
  name: '玩具动物攀爬场',
  description:
    '从谷仓玩具区开始，沿草垛、木箱、木桶、绳桥和弹力垫一路向上。目标是保留多人攀爬的跌落压力，并用原创玩具模块替代方块平台。',

  startPosition: [0, 1.5, 0],
  cameraOffset: [0, 5.6, 11.5],

  theme: {
    skyColor: '#C8DFF7',
    floorColor: '#C8934A',
    gridPrimaryColor: '#F7D77A',
    gridSecondaryColor: '#FFF2C4',
    sunColor: '#FFF5E0',
  },

  designRules: {
    minPlayableSurfaceSize: 1.15,
    smallPieceClusterRadius: 3.0,
    maxNearbySmallPieces: 4,
    minJumpHeadroom: 0.9,
  },

  platforms: [
    barn('start', [9, 1.2, 7], [0, 0, 0], '#F59E0B', 'square_plate', 'toy_square_plate_s1'),

    // Zone 1: barn toy warm-up. Large readable object modules replace box steps.
    barn(
      'barn-hay-01',
      [4.2, 0.72, 3.2],
      [5.6, 0.95, 3.8],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),
    barn(
      'barn-crate-01',
      [3.8, 1.15, 3.3],
      [9.8, 2.0, 7.2],
      '#B45309',
      'stacked_steps',
      'toy_wood_crate_step',
    ),
    barn(
      'barn-barrel-01',
      [2.6, 0.8, 2.6],
      [7.2, 3.1, 11.6],
      '#D97706',
      'round_disc',
      'toy_barrel_round_top',
    ),
    barn(
      'barn-hay-02',
      [4.4, 0.72, 3.2],
      [2.3, 4.1, 13.7],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),
    barn(
      'barn-rope-01',
      [5.6, 0.42, 1.35],
      [-2.8, 5.0, 13.2],
      '#D97706',
      'narrow_plank',
      'toy_rope_plank_bridge',
    ),
    barn(
      'barn-crate-02',
      [3.6, 1.1, 3.1],
      [-7.4, 5.95, 10.6],
      '#B45309',
      'stacked_steps',
      'toy_wood_crate_step',
    ),
    barn(
      'barn-barrel-02',
      [2.4, 0.78, 2.4],
      [-10.6, 7.05, 6.6],
      '#D97706',
      'round_disc',
      'toy_barrel_round_top',
    ),
    barn(
      'barn-hay-03',
      [4.2, 0.72, 3.2],
      [-7.4, 8.05, 2.7],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),
    barn(
      'barn-trampoline-01',
      [3.2, 0.55, 2.6],
      [-2.7, 8.95, 1.1],
      '#38BDF8',
      'trampoline',
      'toy_trampoline_pad',
      {
        bouncy: { boostVelocity: 11.5, squishDuration: 90 },
      },
    ),
    barn(
      'barn-hay-04',
      [4.4, 0.72, 3.2],
      [1.4, 10.35, 4.1],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),

    // Zone 2: first timing lane. Movement and narrow bridges create the same readable risk pattern.
    barn(
      'barn-moving-bridge-01',
      [5.8, 0.42, 1.35],
      [6.6, 11.45, 4.5],
      '#D97706',
      'narrow_plank',
      'toy_rope_plank_bridge',
      {
        moving: { axis: 'x', amplitude: 1.5, period: 3.8 },
      },
    ),
    barn(
      'barn-barrel-03',
      [2.5, 0.78, 2.5],
      [11.2, 12.45, 6.5],
      '#D97706',
      'round_disc',
      'toy_barrel_round_top',
    ),
    barn(
      'barn-puzzle-01',
      [3.2, 0.48, 2.5],
      [14.2, 13.4, 10.4],
      '#A78BFA',
      'irregular_fragment',
      'toy_broken_puzzle_piece',
    ),
    barn(
      'barn-crate-03',
      [3.8, 1.1, 3.3],
      [12.0, 14.65, 14.2],
      '#B45309',
      'stacked_steps',
      'toy_wood_crate_step',
    ),
    barn(
      'barn-rope-02',
      [6.2, 0.42, 1.35],
      [6.8, 15.6, 16.2],
      '#D97706',
      'narrow_plank',
      'toy_rope_plank_bridge',
    ),
    barn(
      'barn-hay-rest-01',
      [5.4, 0.75, 4.0],
      [1.4, 16.65, 15.2],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),

    // Zone 3: higher barn rafters. Smaller landing tops and crumble pieces raise tension.
    barn(
      'rafter-barrel-01',
      [2.3, 0.78, 2.3],
      [-3.3, 17.75, 11.6],
      '#D97706',
      'round_disc',
      'toy_barrel_round_top',
    ),
    barn(
      'rafter-puzzle-01',
      [3.1, 0.46, 2.25],
      [-6.4, 18.7, 7.7],
      '#A78BFA',
      'crumble_tile',
      'toy_crumble_cookie_tile',
      {
        crumble: { standMs: 950, crumbleMs: 500, resetMs: 2600 },
      },
    ),
    barn(
      'rafter-rope-01',
      [5.7, 0.4, 1.25],
      [-3.0, 19.65, 4.0],
      '#D97706',
      'narrow_plank',
      'toy_rope_plank_bridge',
    ),
    barn(
      'rafter-moving-barrel-01',
      [2.4, 0.78, 2.4],
      [2.0, 20.55, 2.5],
      '#D97706',
      'round_disc',
      'toy_barrel_round_top',
      {
        moving: { axis: 'z', amplitude: 1.4, period: 3.4, phaseOffset: 0.6 },
      },
    ),
    barn(
      'rafter-crate-01',
      [3.7, 1.05, 3.2],
      [6.0, 21.65, 5.1],
      '#B45309',
      'stacked_steps',
      'toy_wood_crate_step',
    ),
    barn(
      'rafter-trampoline-01',
      [3.2, 0.55, 2.6],
      [8.6, 22.75, 9.2],
      '#38BDF8',
      'trampoline',
      'toy_trampoline_pad',
      {
        bouncy: { boostVelocity: 12.5, squishDuration: 90 },
      },
    ),
    barn(
      'rafter-hay-rest-02',
      [5.2, 0.75, 3.8],
      [6.2, 24.15, 13.2],
      '#FDE68A',
      'square_plate',
      'toy_barn_hay_bale',
    ),

    // Temporary finale pad for the first redesigned slice.
    barn(
      'barn-final-bridge',
      [6.8, 0.42, 1.35],
      [0.6, 25.2, 13.4],
      '#D97706',
      'narrow_plank',
      'toy_rope_plank_bridge',
    ),
    barn(
      'goal',
      [4.6, 0.8, 4.0],
      [-4.8, 26.25, 13.4],
      '#FCD34D',
      'square_plate',
      'toy_square_plate_s1',
      {
        isGoal: true,
        toyProfile: {
          kind: 'goal_crown',
          themeZone: 'barn',
          difficultyTier: 'medium',
          visualVariant: 'toy_square_plate_s1',
        },
      },
    ),
  ],
};
