export interface ClimberRunStats {
  elapsedMs: number;
  currentHeight: number;
  bestHeight: number;
  progress: number;
  goalReached: boolean;
  goalReachedAtMs: number | null;
}

export type ClimberCharacterId = 'orb' | 'peach' | 'daisy';

export type ClimberCharacterAnimationState = 'idle' | 'run' | 'stop' | 'jump' | 'fall' | 'land';

export type ClimberCharacterRuntimeStatus =
  | 'procedural'
  | 'model-loading'
  | 'model-ready'
  | 'model-ready-static'
  | 'model-no-rig'
  | 'model-fallback';

export interface ClimberCharacterOption {
  id: ClimberCharacterId;
  name: string;
  description: string;
}

export interface ClimberPlatformDefinition {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  color: string;
}

export type ClimberSetPieceAssetId =
  | 'plank_long'
  | 'pipe_long'
  | 'container_short'
  | 'container_long'
  | 'ramp_wedge'
  | 'beam_hazard'
  | 'round_stool'
  | 'tree_pine'
  | 'grass_patch'
  | 'road_segment'
  | 'rock_slab'
  | 'boulder_round'
  | 'stump_short'
  | 'log_tilt'
  | 'branch_bridge'
  | 'pillar_thin'
  | 'crate_tall'
  | 'ledge_hook'
  | 'cliff_block'
  | 'beam_cross'
  | 'stepping_stone'
  | 'rope_post'
  | 'hut_frame_small'
  | 'hut_frame_large'
  | 'arch_gate'
  | 'tunnel_frame'
  | 'cube_frame'
  | 'house_tunnel'
  | 'cloud_pad'
  | 'cloud_ring'
  | 'cloud_arch'
  | 'floating_island'
  | 'spiral_pillar'
  | 'sky_bridge_long'
  | 'prism_gate'
  | 'lotus_pad'
  | 'meteor_chunk'
  | 'neon_pillar'
  | 'drum_platform'
  | 'zigzag_beam'
  | 'fan_blade'
  | 'bridge_arc'
  | 'crystal_cluster'
  | 'moon_step'
  | 'star_frame'
  | 'barrel_tower'
  | 'totem_mask'
  | 'shell_ridge'
  | 'wing_platform'
  | 'vortex_ring'
  | 'tower_gate'
  | 'hex_pad'
  | 'bridge_lattice'
  | 'orb_podium'
  | 'dune_backbone';

export type ClimberSetPieceSurfacePreset =
  | 'wood'
  | 'hazard'
  | 'container'
  | 'metal'
  | 'concrete'
  | 'grass'
  | 'asphalt'
  | 'leaf'
  | 'cloud';

export type ClimberSetPieceColliderShape = 'box' | 'ramp';

export interface ClimberSetPieceAssetDefinition {
  id: ClimberSetPieceAssetId;
  name: string;
  url: string;
  colliderSize: [number, number, number];
  colliderOffset: [number, number, number];
  colliderShape?: ClimberSetPieceColliderShape;
  colliderLocalRotation?: [number, number, number];
  baseColor: string;
  surfacePreset: ClimberSetPieceSurfacePreset;
  preserveMaterial?: boolean;
}

export interface ClimberSetPieceDefinition {
  id: string;
  assetId: ClimberSetPieceAssetId;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  solid?: boolean;
  colliderSize?: [number, number, number];
  colliderOffset?: [number, number, number];
  colliderInset?: number;
  colliderShape?: ClimberSetPieceColliderShape;
  colliderLocalRotation?: [number, number, number];
  color?: string;
  surfacePreset?: ClimberSetPieceSurfacePreset;
}

export interface ClimberLevelTheme {
  skyColor?: string;
  floorColor?: string;
  gridPrimaryColor?: string;
  gridSecondaryColor?: string;
  sunColor?: string;
}

export interface ClimberLevelDefinition {
  id: string;
  name: string;
  description: string;
  startPosition: [number, number, number];
  cameraOffset?: [number, number, number];
  platforms: ClimberPlatformDefinition[];
  setPieces?: ClimberSetPieceDefinition[];
  theme?: ClimberLevelTheme;
}

export interface ClimberPrototypeController {
  reset: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  setDebugCollidersVisible: (visible: boolean) => void;
  setDebugColliderFocusAssetId: (assetId: ClimberSetPieceAssetId | null) => void;
  requestPointerLock: () => void;
  dispose: () => void;
}
