export interface ClimberRunStats {
  elapsedMs: number;
  currentHeight: number;
  bestHeight: number;
  progress: number;
  goalReached: boolean;
  goalReachedAtMs: number | null;
}

export type ClimberJumpClearanceSeverity = 'high' | 'medium';

export interface ClimberJumpClearanceIssue {
  id: string;
  severity: ClimberJumpClearanceSeverity;
  linkId: string;
  sourceId: string;
  targetId: string;
  blockerId: string;
  blockerAssetId?: string;
  reason: string;
}

export interface ClimberJumpClearanceReport {
  generatedAt: number;
  checkedLinks: number;
  earlyRouteCheckedLinks: number;
  highRiskCount: number;
  earlyRouteHighRiskCount: number;
  mediumRiskCount: number;
  smallPieceCount: number;
  denseSmallPieceClusterCount: number;
  spawnBlockerCount: number;
  spawnZoneClear: boolean;
  routeRegressionPassed: boolean;
  issues: ClimberJumpClearanceIssue[];
}

export type ClimberCharacterId = 'orb' | 'peach' | 'daisy' | 'woodendoll';

export type ClimberCharacterAnimationState = 'idle' | 'run' | 'stop' | 'jump' | 'fall' | 'land';

export type ClimberCharacterRuntimeStatus =
  | 'procedural'
  | 'model-loading'
  | 'model-ready'
  | 'model-ready-static'
  | 'model-no-rig'
  | 'model-fallback';

export interface ClimberCharacterAnimationDebugSnapshot {
  currentState: ClimberCharacterAnimationState;
  horizontalSpeed: number;
  verticalSpeed: number;
  grounded: boolean;
  landingLockMs: number;
  activeActionName: string;
  availableActions: Partial<Record<ClimberCharacterAnimationState, string>>;
  hasSkeleton: boolean;
  isAnimated: boolean;
  usesProceduralOverlay: boolean;
  autoFootCalibrationEnabled: boolean;
}

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
  /** 标记为安全存档点，接地时自动更新重生位置 */
  isCheckpoint?: boolean;
  /** 标记为终点平台 */
  isGoal?: boolean;
  /**
   * 移动平台配置。平台将沿指定轴在 [origin ± amplitude] 范围内以 sin 往复运动。
   * - axis: 移动轴方向 'x' | 'y' | 'z'
   * - amplitude: 振幅（米），单向最大偏移
   * - period: 周期（秒），完整来回一次的时间
   * - phaseOffset: 相位偏移（弧度），用于错开多个平台的节奏（默认 0）
   */
  moving?: {
    axis: 'x' | 'y' | 'z';
    amplitude: number;
    period: number;
    phaseOffset?: number;
  };
  /**
   * 弹跳板配置。玩家落地时给予额外向上速度，并触发视觉压缩-弹出动画。
   * - boostVelocity: 起跳速度（m/s），叠加在正常跳跃基础上（建议 10~16）
   * - squishDuration: 压缩动画时长（ms，默认 80）
   */
  bouncy?: {
    boostVelocity: number;
    squishDuration?: number;
  };
  /**
   * 不稳定平台配置。玩家站上后延迟开始晃动，再延迟后下沉消失，随后重置。
   * - shakeDelay:   踩上后多久开始晃动（ms，默认 600）
   * - shakeDuration: 晃动持续多久后开始下沉（ms，默认 1200）
   * - fallSpeed:    下沉速度（m/s，默认 4）
   * - resetDelay:   下沉消失后多久重置回原位（ms，默认 2000）
   */
  unstable?: {
    shakeDelay?: number;
    shakeDuration?: number;
    fallSpeed?: number;
    resetDelay?: number;
  };
}

export type ClimberSetPieceAssetId =
  | 'plank_long'
  | 'pipe_long'
  | 'container_short'
  | 'container_long'
  | 'ramp_wedge'
  | 'beam_hazard'
  | 'rock_slab'
  | 'crate_tall'
  | 'cliff_block'
  | 'stepping_stone'
  | 'barrel_tower';

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

export interface ClimberLevelDesignRules {
  minPlayableSurfaceSize?: number;
  smallPieceClusterRadius?: number;
  maxNearbySmallPieces?: number;
  minJumpHeadroom?: number;
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
  designRules?: ClimberLevelDesignRules;
}

export interface ClimberPrototypeController {
  reset: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  setDebugCollidersVisible: (visible: boolean) => void;
  setDebugInstanceLabelsVisible: (visible: boolean) => void;
  setDebugJumpClearanceVisible: (visible: boolean) => void;
  setDebugColliderFocusAssetId: (assetId: ClimberSetPieceAssetId | null) => void;
  setDebugCharacterAnimationVisible: (visible: boolean) => void;
  setCharacterAutoFootCalibrationEnabled: (enabled: boolean) => void;
  /** 玩家状态叠加层（高度/接地/速度/状态/平台ID） */
  setDebugPlayerStateVisible: (visible: boolean) => void;
  requestPointerLock: () => void;
  dispose: () => void;
}
