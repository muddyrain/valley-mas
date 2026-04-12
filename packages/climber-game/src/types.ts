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
  | 'road_segment';

export type ClimberSetPieceSurfacePreset =
  | 'wood'
  | 'hazard'
  | 'container'
  | 'metal'
  | 'concrete'
  | 'grass'
  | 'asphalt'
  | 'leaf';

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
  requestPointerLock: () => void;
  dispose: () => void;
}
