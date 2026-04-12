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
  theme?: ClimberLevelTheme;
}

export interface ClimberPrototypeController {
  reset: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  requestPointerLock: () => void;
  dispose: () => void;
}
