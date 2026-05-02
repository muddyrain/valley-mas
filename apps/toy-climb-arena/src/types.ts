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

export type ClimberCharacterId =
  | 'orb'
  | 'peach'
  | 'daisy'
  | 'woodendoll'
  | 'panda'
  | 'frog'
  | 'cat';

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

export type ToyPlatformKind =
  | 'square_plate'
  | 'round_disc'
  | 'narrow_plank'
  | 'irregular_fragment'
  | 'stacked_steps'
  | 'wobble_board'
  | 'moving_lift'
  | 'rotating_gear'
  | 'extendable_bridge'
  | 'tilting_board'
  | 'blink_panel'
  | 'trampoline'
  | 'bounce_pad'
  | 'conveyor_belt'
  | 'ice_block'
  | 'sticky_pad'
  | 'crumble_tile'
  | 'climb_wall'
  | 'swing_rope'
  | 'ladder'
  | 'balance_pole'
  | 'goal_crown';

export type ToyPlatformThemeZone = 'barn' | 'castle' | 'sky_island' | 'olympus' | 'workshop';

export type ToyPlatformDifficultyTier = 'tutorial' | 'easy' | 'medium' | 'hard' | 'finale';

export type ToyPlatformMechanicTag =
  | 'static'
  | 'precision'
  | 'narrow'
  | 'unstable'
  | 'moving'
  | 'rotating'
  | 'timing'
  | 'bounce'
  | 'conveyor'
  | 'slippery'
  | 'sticky'
  | 'crumble'
  | 'vertical'
  | 'swing'
  | 'goal'
  | 'rest';

export interface ToyPlatformProfile {
  kind: ToyPlatformKind;
  themeZone?: ToyPlatformThemeZone;
  difficultyTier?: ToyPlatformDifficultyTier;
  mechanicTags?: ToyPlatformMechanicTag[];
  visualVariant?: string;
}

export interface ClimberPlatformDefinition {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  /** 玩具风重制的平台语义，用于统一模型、机关、音效和区域难度。 */
  toyProfile?: ToyPlatformProfile;
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
   * 伸缩平台配置。平台沿水平轴周期性缩短/恢复，碰撞体跟随可见模型缩放。
   * - axis: 伸缩轴 'x' | 'z'
   * - minScale: 缩回后的轴向比例（0.25~1，默认 0.35）
   * - period: 完整伸缩周期（秒）
   * - phaseOffset: 相位偏移（弧度，默认 0）
   */
  extendable?: {
    axis: 'x' | 'z';
    minScale?: number;
    period: number;
    phaseOffset?: number;
  };
  /**
   * 倾斜平台配置。平台绕水平轴周期性倾斜，模型级碰撞体跟随旋转。
   * - axis: 绕 'x' 或 'z' 轴倾斜
   * - angleDeg: 最大倾斜角度（度，建议 6~14）
   * - period: 往复周期（秒）
   * - phaseOffset: 相位偏移（弧度，默认 0）
   */
  tilting?: {
    axis: 'x' | 'z';
    angleDeg: number;
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
  /**
   * 旋转平台配置。平台绕 Y 轴匀速旋转，站在上面的玩家会被带动旋转。
   * - speed: 旋转角速度（rad/s，正数顺时针，默认 0.8）
   */
  rotating?: {
    speed?: number;
  };
  /**
   * 传送带平台配置。站在上面的玩家被持续施加水平推力。
   * - axis:  推进方向 'x' | 'z'
   * - speed: 推进速度（m/s，正负决定方向，默认 3.0）
   */
  conveyor?: {
    axis: 'x' | 'z';
    speed: number;
  };
  /**
   * 消失重现平台配置。定时在可见+可踩 / 不可见+穿透 之间切换。
   * - visibleMs:   可见持续时间（ms，默认 2000）
   * - hiddenMs:    隐藏持续时间（ms，默认 1500）
   * - phaseOffset: 初始相位偏移（ms，默认 0，用于错开多个平台节奏）
   */
  blink?: {
    visibleMs?: number;
    hiddenMs?: number;
    phaseOffset?: number;
  };
  /**
   * 碎裂平台配置。玩家踩上后延迟碎裂消失，等待一段时间后复原。
   * - standMs:    踩上后多久开始碎裂（ms，默认 800）
   * - crumbleMs: 碎裂动画持续时间（ms，默认 400）
   * - resetMs:   消失后多久复原（ms，默认 3000）
   */
  crumble?: {
    standMs?: number;
    crumbleMs?: number;
    resetMs?: number;
  };
  /** 冰面平台：摩擦力极低，玩家制动极慢，会持续滑行。 */
  icy?: boolean;
  /** 粘性平台：降低地面移动速度和起跳力度，用于制造软糖/橡皮泥阻滞感。 */
  sticky?: boolean;
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
