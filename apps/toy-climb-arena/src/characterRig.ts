import {
  type AnimationAction,
  type AnimationClip,
  AnimationMixer,
  AnimationUtils,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  type Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CHARACTER_MODEL_URLS,
  CLIMBER_CHARACTER_OPTIONS,
  isModelCharacter,
} from './characterAssets';
import type {
  ClimberCharacterAnimationDebugSnapshot,
  ClimberCharacterAnimationState,
  ClimberCharacterId,
  ClimberCharacterRuntimeStatus,
} from './types';

export { CLIMBER_CHARACTER_OPTIONS } from './characterAssets';

interface CharacterUpdateContext {
  delta: number;
  elapsed: number;
  horizontalSpeed: number;
  verticalSpeed: number;
}

interface CharacterRigController {
  group: Group;
  setState: (state: ClimberCharacterAnimationState) => void;
  setGrounded: (grounded: boolean) => void;
  setLandingLockMs: (ms: number) => void;
  setAutoFootCalibrationEnabled: (enabled: boolean) => void;
  getDebugSnapshot: () => ClimberCharacterAnimationDebugSnapshot;
  update: (context: CharacterUpdateContext) => void;
  dispose: () => void;
}

interface CreateCharacterRigOptions {
  onRuntimeStatusChange?: (status: ClimberCharacterRuntimeStatus) => void;
}

interface CharacterPartSet {
  root: Group;
  materials: Material[];
  update: (context: CharacterUpdateContext, state: ClimberCharacterAnimationState) => void;
}

interface ModelRuntime {
  root: Group;
  mixer: AnimationMixer;
  actions: Partial<Record<ClimberCharacterAnimationState, AnimationAction>>;
  currentState: ClimberCharacterAnimationState;
  isAnimated: boolean;
  hasSkeleton: boolean;
  usesProceduralOverlay: boolean;
  baseOffsetY: number;
  baseScale: Vector3;
  autoFootCalibrationOffsetY: number;
  autoFootCalibrationEnabled: boolean;
  actionNames: Partial<Record<ClimberCharacterAnimationState, string>>;
  update: (context: CharacterUpdateContext, state: ClimberCharacterAnimationState) => void;
  dispose: () => void;
}

interface BoneEntry {
  node: Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
}

interface ProceduralBoneAnimator {
  update: (context: CharacterUpdateContext, state: ClimberCharacterAnimationState) => void;
}

function usesPrincessRigHeuristics(characterId: Exclude<ClimberCharacterId, 'orb'>): boolean {
  return characterId === 'peach' || characterId === 'daisy';
}

const RUNNER_STATE_CLIP_ALIASES: Record<ClimberCharacterAnimationState, string[]> = {
  idle: ['idle', 'stand', 'wait', 'breath', 'pose'],
  run: ['run', 'jog', 'sprint', 'walk', 'move'],
  stop: ['stop', 'brake', 'skid', 'halt', 'endrun'],
  jump: ['jump', 'hop', 'takeoff', 'startjump'],
  fall: ['fall', 'air', 'descending', 'drop'],
  land: ['land', 'landing', 'impact'],
};

const STATE_CLIP_FALLBACK_HINTS: Record<ClimberCharacterAnimationState, string[]> = {
  idle: ['idle', 'stand', 'wait'],
  run: ['run', 'jog', 'walk'],
  stop: ['stop', 'brake', 'skid'],
  jump: ['jump', 'hop', 'takeoff'],
  fall: ['fall', 'air', 'drop'],
  land: ['land', 'impact'],
};

interface ResolvedClipSet {
  idle?: AnimationClip;
  run?: AnimationClip;
  stop?: AnimationClip;
  jump?: AnimationClip;
  fall?: AnimationClip;
  land?: AnimationClip;
}

interface JumpPhaseTuning {
  jumpStartRatio: number;
  jumpEndRatio: number;
  fallStartRatio: number;
  fallEndRatio: number;
  landStartRatio: number;
  landEndRatio: number;
}

const CHARACTER_JUMP_PHASE_TUNING: Partial<
  Record<Exclude<ClimberCharacterId, 'orb'>, JumpPhaseTuning>
> = {
  // Daisy 的原始 jump 片段偏长，收敛到与 Peach 更接近的起跳-下落-落地节奏。
  daisy: {
    jumpStartRatio: 0.08,
    jumpEndRatio: 0.5,
    fallStartRatio: 0.5,
    fallEndRatio: 0.82,
    landStartRatio: 0.82,
    landEndRatio: 1,
  },
};

const LEFT_ARM_KEYWORDS = [
  'leftarm',
  'lupperarm',
  'arm_l',
  'l_arm',
  'upperarm_l',
  'upperarml',
  'leftshoulder',
  'shoulderl',
];
const RIGHT_ARM_KEYWORDS = [
  'rightarm',
  'rupperarm',
  'arm_r',
  'r_arm',
  'upperarm_r',
  'upperarmr',
  'rightshoulder',
  'shoulderr',
];
const LEFT_FOREARM_KEYWORDS = [
  'lforearm',
  'lowerarm_l',
  'lowerarml',
  'forearm_l',
  'forearml',
  'elbow_l',
  'lowerarmleft',
];
const RIGHT_FOREARM_KEYWORDS = [
  'rforearm',
  'lowerarm_r',
  'lowerarmr',
  'forearm_r',
  'forearmr',
  'elbow_r',
  'lowerarmright',
];
const LEFT_LEG_KEYWORDS = [
  'leftleg',
  'lthigh',
  'leg_l',
  'l_leg',
  'upleg_l',
  'upperlegl',
  'thigh_l',
  'leftupleg',
];
const RIGHT_LEG_KEYWORDS = [
  'rightleg',
  'rthigh',
  'leg_r',
  'r_leg',
  'upleg_r',
  'upperlegr',
  'thigh_r',
  'rightupleg',
];
const LEFT_SHIN_KEYWORDS = ['lowerleg_l', 'lowerlegl', 'calf_l', 'lcalf', 'shin_l'];
const RIGHT_SHIN_KEYWORDS = ['lowerleg_r', 'lowerlegr', 'calf_r', 'rcalf', 'shin_r'];
const LEFT_FOOT_KEYWORDS = ['foot_l', 'footl', 'lfoot', 'ankle_l', 'toes_l', 'toe_l'];
const RIGHT_FOOT_KEYWORDS = ['foot_r', 'footr', 'rfoot', 'ankle_r', 'toes_r', 'toe_r'];
const HIPS_KEYWORDS = ['hips', 'pelvis', 'rootjoint'];
const SPINE_KEYWORDS = ['spine', 'waist', 'torso'];
const CHEST_KEYWORDS = ['chest', 'breastroot', 'upperchest'];
const HEAD_KEYWORDS = ['head', 'neck'];
const LEFT_HAND_KEYWORDS = ['hand_l', 'handl', 'lhand', 'wrist_l'];
const RIGHT_HAND_KEYWORDS = ['hand_r', 'handr', 'rhand', 'wrist_r'];
const ARM_RELAX_DOWN_Z = 0.94;
const ARM_RELAX_YAW = 0.08;

function normalizeNodeName(name: string): string {
  return name.replace(/[\s_.-]/g, '').toLowerCase();
}

function hasAnyKeyword(name: string, keywords: string[]): boolean {
  return keywords.some((keyword) => name.includes(normalizeNodeName(keyword)));
}

function shouldIgnoreBone(name: string): boolean {
  return (
    name.includes('attach') ||
    name.includes('aimcont') ||
    name.includes('helper') ||
    name.includes('ik') ||
    name.includes('target') ||
    name.endsWith('end')
  );
}

function disposeMaterials(materials: Material[]) {
  materials.forEach((material) => material.dispose());
}

function setCastShadowDeep(node: Object3D) {
  node.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

function normalizeModelHeight(root: Group, targetHeight: number) {
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0.001) return;
  const scale = targetHeight / size.y;
  root.scale.setScalar(scale);
  const nextBounds = new Box3().setFromObject(root);
  const minY = nextBounds.min.y;
  root.position.y -= minY + 0.42;
}

function resolveAutoFootCalibrationOffsetY(root: Group): number {
  const bounds = new Box3().setFromObject(root);
  const fallbackMinY = Number.isFinite(bounds.min.y) ? bounds.min.y : -0.42;
  let minFootY = Number.POSITIVE_INFINITY;
  const world = new Vector3();

  root.traverse((node) => {
    const boneLike = node as Object3D & { isBone?: boolean };
    if (!boneLike.isBone) return;
    const normalized = normalizeNodeName(node.name);
    if (
      !hasAnyKeyword(normalized, LEFT_FOOT_KEYWORDS) &&
      !hasAnyKeyword(normalized, RIGHT_FOOT_KEYWORDS)
    ) {
      return;
    }
    node.getWorldPosition(world);
    if (Number.isFinite(world.y) && world.y < minFootY) {
      minFootY = world.y;
    }
  });

  const referenceMinY = Number.isFinite(minFootY) ? minFootY : fallbackMinY;
  const desiredMinY = -0.42;
  return desiredMinY - referenceMinY;
}

function findClip(
  clips: AnimationClip[],
  aliases: string[],
  fallbackIncludes?: string[],
): AnimationClip | undefined {
  const normalizedAliases = aliases.map((item) => item.toLowerCase());
  const normalizedIncludes = (fallbackIncludes ?? []).map((item) => item.toLowerCase());

  return clips.find((clip) => {
    const name = clip.name.toLowerCase();
    if (normalizedAliases.includes(name)) return true;
    if (normalizedAliases.some((alias) => name.includes(alias))) return true;
    if (normalizedIncludes.some((keyword) => name.includes(keyword))) return true;
    return false;
  });
}

function pickDifferentClip(
  clips: AnimationClip[],
  excluded: AnimationClip | undefined,
): AnimationClip | undefined {
  return clips.find((clip) => clip !== excluded);
}

function estimateClipFps(clip: AnimationClip): number {
  for (const track of clip.tracks) {
    const times = track.times;
    if (!times || times.length < 2) continue;
    const step = times[1] - times[0];
    if (!Number.isFinite(step) || step <= 0) continue;
    return MathUtils.clamp(Math.round(1 / step), 24, 60);
  }
  return 30;
}

function createRunJumpFromCompositeClip(
  clip: AnimationClip,
): { run: AnimationClip; jump: AnimationClip } | null {
  if (clip.duration < 1.1) return null;
  const fps = estimateClipFps(clip);
  const totalFrames = Math.max(2, Math.round(clip.duration * fps));
  if (totalFrames < 16) return null;

  const runEnd = Math.max(8, Math.round(totalFrames * 0.56));
  const jumpStart = Math.min(totalFrames - 2, Math.max(runEnd + 1, Math.round(totalFrames * 0.62)));
  if (jumpStart >= totalFrames - 1) return null;

  const runClip = AnimationUtils.subclip(clip, `${clip.name}__auto_run`, 0, runEnd, fps);
  const jumpClip = AnimationUtils.subclip(
    clip,
    `${clip.name}__auto_jump`,
    jumpStart,
    totalFrames - 1,
    fps,
  );
  if (!runClip.tracks.length || !jumpClip.tracks.length) return null;
  return { run: runClip, jump: jumpClip };
}

function createClipByRatios(
  clip: AnimationClip,
  name: string,
  startRatio: number,
  endRatio: number,
): AnimationClip | null {
  const fps = estimateClipFps(clip);
  const totalFrames = Math.max(2, Math.round(clip.duration * fps));
  if (totalFrames < 6) return null;

  const startFrame = MathUtils.clamp(Math.round(totalFrames * startRatio), 0, totalFrames - 2);
  const endFrame = MathUtils.clamp(
    Math.round(totalFrames * endRatio),
    startFrame + 1,
    totalFrames - 1,
  );
  if (endFrame <= startFrame + 1) return null;

  const sub = AnimationUtils.subclip(clip, `${clip.name}__${name}`, startFrame, endFrame, fps);
  if (!sub.tracks.length) return null;
  return sub;
}

function createJumpFallLandFromSingleJump(
  clip: AnimationClip,
  tuning: JumpPhaseTuning,
): { jump: AnimationClip; fall: AnimationClip; land: AnimationClip } | null {
  const jumpClip = createClipByRatios(
    clip,
    'jump_phase',
    tuning.jumpStartRatio,
    tuning.jumpEndRatio,
  );
  const fallClip = createClipByRatios(
    clip,
    'fall_phase',
    tuning.fallStartRatio,
    tuning.fallEndRatio,
  );
  const landClip = createClipByRatios(
    clip,
    'land_phase',
    tuning.landStartRatio,
    tuning.landEndRatio,
  );
  if (!jumpClip || !fallClip || !landClip) return null;
  return { jump: jumpClip, fall: fallClip, land: landClip };
}

function getPreferredAnimationPool(
  characterId: Exclude<ClimberCharacterId, 'orb'>,
  clips: AnimationClip[],
): AnimationClip[] {
  if (!usesPrincessRigHeuristics(characterId)) return clips;
  const mixamoClips = clips.filter((clip) => clip.name.toLowerCase().includes('mixamo'));
  return mixamoClips.length >= 2 ? mixamoClips : clips;
}

function pickLongestDurationClip(clips: AnimationClip[]): AnimationClip | undefined {
  if (!clips.length) return undefined;
  return clips.reduce((best, clip) => {
    if (clip.duration > best.duration) return clip;
    if (clip.duration === best.duration && clip.tracks.length > best.tracks.length) return clip;
    return best;
  });
}

function pickShortestDurationClip(
  clips: AnimationClip[],
  excluded: AnimationClip | undefined,
): AnimationClip | undefined {
  const candidates = clips.filter((clip) => clip !== excluded);
  if (!candidates.length) return undefined;
  return candidates.reduce((best, clip) => {
    if (clip.duration < best.duration) return clip;
    if (clip.duration === best.duration && clip.tracks.length > best.tracks.length) return clip;
    return best;
  });
}

function readTrackValueSize(track: {
  times: ArrayLike<number>;
  values: ArrayLike<number>;
}): number {
  const timeCount = track.times?.length ?? 0;
  const valueCount = track.values?.length ?? 0;
  if (!timeCount || !valueCount) return 0;
  const size = valueCount / timeCount;
  return Number.isFinite(size) ? Math.max(0, Math.round(size)) : 0;
}

function estimateClipVerticalMotion(clip: AnimationClip): number {
  let score = 0;
  for (const track of clip.tracks as Array<{
    name: string;
    times: ArrayLike<number>;
    values: ArrayLike<number>;
  }>) {
    const normalizedName = track.name.toLowerCase();
    if (!normalizedName.includes('.position')) continue;
    const valueSize = readTrackValueSize(track);
    if (valueSize < 2) continue;

    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 1; i < track.values.length; i += valueSize) {
      const y = Number(track.values[i]);
      if (!Number.isFinite(y)) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) continue;
    const range = Math.max(0, maxY - minY);
    const rootWeight = /hips|pelvis|root|armature/.test(normalizedName) ? 2.4 : 1;
    score += range * rootWeight;
  }
  return score;
}

function pickMostJumpLikeClip(
  clips: AnimationClip[],
  runClip: AnimationClip | undefined,
): AnimationClip | undefined {
  const candidates = clips.filter((clip) => clip !== runClip);
  if (!candidates.length) return undefined;

  const ranked = candidates
    .map((clip) => ({
      clip,
      vertical: estimateClipVerticalMotion(clip),
    }))
    .sort((a, b) => {
      if (b.vertical !== a.vertical) return b.vertical - a.vertical;
      if (b.clip.duration !== a.clip.duration) return b.clip.duration - a.clip.duration;
      return b.clip.tracks.length - a.clip.tracks.length;
    });
  return ranked[0]?.clip;
}

function resolveCharacterClips(
  characterId: Exclude<ClimberCharacterId, 'orb'>,
  clips: AnimationClip[],
): ResolvedClipSet {
  if (!clips.length) {
    return {};
  }

  const idleByName = findClip(
    clips,
    RUNNER_STATE_CLIP_ALIASES.idle,
    STATE_CLIP_FALLBACK_HINTS.idle,
  );
  const runByName = findClip(clips, RUNNER_STATE_CLIP_ALIASES.run, STATE_CLIP_FALLBACK_HINTS.run);
  const stopByName = findClip(
    clips,
    RUNNER_STATE_CLIP_ALIASES.stop,
    STATE_CLIP_FALLBACK_HINTS.stop,
  );
  const jumpByName = findClip(
    clips,
    RUNNER_STATE_CLIP_ALIASES.jump,
    STATE_CLIP_FALLBACK_HINTS.jump,
  );
  const fallByName = findClip(
    clips,
    RUNNER_STATE_CLIP_ALIASES.fall,
    STATE_CLIP_FALLBACK_HINTS.fall,
  );
  const landByName = findClip(
    clips,
    RUNNER_STATE_CLIP_ALIASES.land,
    STATE_CLIP_FALLBACK_HINTS.land,
  );

  // 角色动画优先按名字绑定 run/jump；命名不标准时，再按“跳跃特征”自动挑 jump。
  if (usesPrincessRigHeuristics(characterId)) {
    const preferredPool = getPreferredAnimationPool(characterId, clips);
    const jumpPhaseTuning = CHARACTER_JUMP_PHASE_TUNING[characterId];
    if (runByName && jumpByName) {
      const phasedJump = jumpPhaseTuning
        ? createJumpFallLandFromSingleJump(jumpByName, jumpPhaseTuning)
        : null;
      return {
        idle: idleByName ?? runByName,
        run: runByName,
        stop: stopByName ?? idleByName ?? runByName,
        jump: phasedJump?.jump ?? jumpByName,
        fall: fallByName ?? phasedJump?.fall ?? jumpByName,
        land: landByName ?? phasedJump?.land ?? stopByName ?? idleByName ?? runByName,
      };
    }

    if (runByName && !jumpByName) {
      const jumpFromAll = pickMostJumpLikeClip(clips, runByName);
      const jumpFromPool = pickMostJumpLikeClip(preferredPool, runByName);
      const jump = jumpFromAll ?? jumpFromPool ?? runByName;
      const phasedJump = jumpPhaseTuning
        ? createJumpFallLandFromSingleJump(jump, jumpPhaseTuning)
        : null;
      return {
        idle: idleByName ?? runByName,
        run: runByName,
        stop: stopByName ?? idleByName ?? runByName,
        jump: phasedJump?.jump ?? jump,
        fall: fallByName ?? phasedJump?.fall ?? jump,
        land: landByName ?? phasedJump?.land ?? stopByName ?? idleByName ?? runByName,
      };
    }

    const compositeSource = pickLongestDurationClip(preferredPool);
    const compositeSplit = compositeSource ? createRunJumpFromCompositeClip(compositeSource) : null;
    const runFallback = compositeSplit?.run ?? compositeSource ?? clips[0];
    const jumpFallback =
      compositeSplit?.jump ??
      pickShortestDurationClip(preferredPool, compositeSource) ??
      pickDifferentClip(preferredPool, compositeSource) ??
      pickDifferentClip(clips, compositeSource) ??
      runFallback;
    const run = runByName ?? runFallback;
    const jump = jumpByName ?? jumpFallback;
    const phasedJump = jumpPhaseTuning
      ? createJumpFallLandFromSingleJump(jump, jumpPhaseTuning)
      : null;

    return {
      idle: idleByName ?? run,
      run,
      stop: stopByName ?? idleByName ?? run,
      jump: phasedJump?.jump ?? jump,
      fall: fallByName ?? phasedJump?.fall ?? jump,
      land: landByName ?? phasedJump?.land ?? stopByName ?? idleByName ?? run,
    };
  }

  const run = runByName ?? clips[0];
  const jump = jumpByName ?? pickDifferentClip(clips, run) ?? run;
  return {
    idle: idleByName ?? run,
    run,
    stop: stopByName ?? idleByName ?? run,
    jump,
    fall: fallByName ?? jump,
    land: landByName ?? stopByName ?? idleByName ?? run,
  };
}

function resolveActionForState(
  actions: Partial<Record<ClimberCharacterAnimationState, AnimationAction>>,
  state: ClimberCharacterAnimationState,
): AnimationAction | undefined {
  if (state === 'stop') {
    return actions.stop ?? actions.idle ?? actions.run;
  }
  if (state === 'jump') {
    return actions.jump ?? actions.fall ?? actions.run ?? actions.idle;
  }
  if (state === 'fall') {
    return actions.fall ?? actions.jump ?? actions.run ?? actions.idle;
  }
  if (state === 'land') {
    return actions.land ?? actions.stop ?? actions.idle ?? actions.run;
  }
  if (state === 'run') {
    return actions.run ?? actions.stop ?? actions.idle ?? actions.jump;
  }
  return actions.idle ?? actions.stop ?? actions.run ?? actions.jump;
}

async function applySpecGlossinessFallback(gltf: {
  scene: Group;
  parser?: {
    getDependency?: (type: string, index: number) => Promise<unknown>;
  };
}): Promise<void> {
  const parser = gltf.parser;
  const getDependency = parser?.getDependency;
  if (!getDependency) return;

  const pending: Array<Promise<void>> = [];

  gltf.scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const runtimeMaterial = material as Material & {
        map?: unknown;
        color?: { setRGB: (r: number, g: number, b: number) => void };
        opacity?: number;
        transparent?: boolean;
        needsUpdate?: boolean;
        userData?: Record<string, unknown>;
      };
      const extensions = runtimeMaterial.userData?.gltfExtensions as
        | {
            KHR_materials_pbrSpecularGlossiness?: {
              diffuseTexture?: { index?: number };
              diffuseFactor?: number[];
            };
          }
        | undefined;
      const specGloss = extensions?.KHR_materials_pbrSpecularGlossiness;
      if (!specGloss) return;

      const diffuseFactor = specGloss.diffuseFactor;
      if (Array.isArray(diffuseFactor) && diffuseFactor.length >= 3 && runtimeMaterial.color) {
        const alpha = diffuseFactor[3] ?? 1;
        runtimeMaterial.color.setRGB(diffuseFactor[0], diffuseFactor[1], diffuseFactor[2]);
        if (typeof runtimeMaterial.opacity === 'number') {
          runtimeMaterial.opacity = alpha;
          runtimeMaterial.transparent = alpha < 0.999;
        }
      }

      const textureIndex = specGloss.diffuseTexture?.index;
      if (typeof textureIndex === 'number' && !runtimeMaterial.map) {
        const task = getDependency('texture', textureIndex)
          .then((texture) => {
            runtimeMaterial.map = texture;
            runtimeMaterial.needsUpdate = true;
          })
          .catch(() => undefined);
        pending.push(task);
        return;
      }
      runtimeMaterial.needsUpdate = true;
    });
  });

  if (pending.length > 0) {
    await Promise.all(pending);
  }
}

function applyModelMaterialStabilityFix(root: Group): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const standard = material as MeshStandardMaterial & {
        alphaTest?: number;
        opacity?: number;
        transparent?: boolean;
        depthWrite?: boolean;
        depthTest?: boolean;
        side?: number;
      };
      if (!standard) return;

      const maybeCutout = standard.transparent && (standard.opacity ?? 1) >= 0.999;
      if (maybeCutout) {
        // Blender 导出的大量 BLEND 材质在 Three.js 会触发深度排序问题，转 cutout 更稳定。
        standard.transparent = false;
        standard.alphaTest = Math.max(standard.alphaTest ?? 0, 0.33);
        standard.depthWrite = true;
        standard.depthTest = true;
      }

      if (!standard.transparent) {
        standard.depthWrite = true;
        standard.depthTest = true;
      }

      standard.needsUpdate = true;
    });
  });
}

function createProceduralBoneAnimator(
  root: Group,
  characterId: Exclude<ClimberCharacterId, 'orb'>,
): ProceduralBoneAnimator | null {
  const hips: BoneEntry[] = [];
  const spines: BoneEntry[] = [];
  const chests: BoneEntry[] = [];
  const heads: BoneEntry[] = [];
  const leftArms: BoneEntry[] = [];
  const rightArms: BoneEntry[] = [];
  const leftForearms: BoneEntry[] = [];
  const rightForearms: BoneEntry[] = [];
  const leftHands: BoneEntry[] = [];
  const rightHands: BoneEntry[] = [];
  const leftLegs: BoneEntry[] = [];
  const rightLegs: BoneEntry[] = [];
  const leftShins: BoneEntry[] = [];
  const rightShins: BoneEntry[] = [];
  const leftFeet: BoneEntry[] = [];
  const rightFeet: BoneEntry[] = [];

  root.traverse((node) => {
    const boneLike = node as Object3D & { isBone?: boolean };
    if (!boneLike.isBone) return;
    const normalized = normalizeNodeName(node.name);
    if (shouldIgnoreBone(normalized)) return;
    const entry: BoneEntry = {
      node,
      baseX: node.rotation.x,
      baseY: node.rotation.y,
      baseZ: node.rotation.z,
    };

    if (hasAnyKeyword(normalized, HIPS_KEYWORDS)) {
      hips.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, CHEST_KEYWORDS)) {
      chests.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, SPINE_KEYWORDS)) {
      spines.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, HEAD_KEYWORDS)) {
      heads.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_FOREARM_KEYWORDS)) {
      leftForearms.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_FOREARM_KEYWORDS)) {
      rightForearms.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_HAND_KEYWORDS)) {
      leftHands.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_HAND_KEYWORDS)) {
      rightHands.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_ARM_KEYWORDS)) {
      leftArms.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_ARM_KEYWORDS)) {
      rightArms.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_SHIN_KEYWORDS)) {
      leftShins.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_SHIN_KEYWORDS)) {
      rightShins.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_FOOT_KEYWORDS)) {
      leftFeet.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_FOOT_KEYWORDS)) {
      rightFeet.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, LEFT_LEG_KEYWORDS)) {
      leftLegs.push(entry);
      return;
    }
    if (hasAnyKeyword(normalized, RIGHT_LEG_KEYWORDS)) {
      rightLegs.push(entry);
    }
  });

  const animatedBoneCount =
    hips.length +
    spines.length +
    chests.length +
    heads.length +
    leftArms.length +
    rightArms.length +
    leftForearms.length +
    rightForearms.length +
    leftHands.length +
    rightHands.length +
    leftLegs.length +
    rightLegs.length +
    leftShins.length +
    rightShins.length +
    leftFeet.length +
    rightFeet.length;
  if (animatedBoneCount === 0) {
    return null;
  }

  const applyEntries = (
    entries: BoneEntry[],
    targetX: number,
    targetY: number,
    targetZ: number,
    delta: number,
    responsiveness: number,
  ) => {
    entries.forEach((entry) => {
      entry.node.rotation.x = MathUtils.damp(
        entry.node.rotation.x,
        entry.baseX + targetX,
        responsiveness,
        delta,
      );
      entry.node.rotation.y = MathUtils.damp(
        entry.node.rotation.y,
        entry.baseY + targetY,
        responsiveness,
        delta,
      );
      entry.node.rotation.z = MathUtils.damp(
        entry.node.rotation.z,
        entry.baseZ + targetZ,
        responsiveness,
        delta,
      );
    });
  };

  return {
    update(context, state) {
      const runningBlend = MathUtils.clamp(context.horizontalSpeed / 6.6, 0, 1);
      const moveBlend = state === 'run' ? runningBlend : runningBlend * 0.25;
      const phase = context.elapsed * MathUtils.lerp(5.6, 12.6, moveBlend);
      const stride = Math.sin(phase);
      const strideOpposite = Math.sin(phase + Math.PI);
      const bounce = Math.sin(phase * 2);

      let legAmplitude = 0;
      let armAmplitude = 0;
      let legPoseBias = 0;
      let armPoseBias = 0;
      let shinBendBase = 0.12;
      let shinBendGain = 0.08;
      let footPitchBase = -0.04;
      let footPitchGain = 0.06;
      let elbowBendBias = -0.28;
      let elbowRunGain = 0;
      let hipPitch = 0;
      let spinePitch = 0;
      let chestPitch = 0;
      let headPitch = 0;
      let torsoRollAmp = 0;
      let armDownZ = ARM_RELAX_DOWN_Z;
      let armYaw = ARM_RELAX_YAW;
      let handPitch = -0.04;
      let handSwingGain = 0.08;
      let forearmCounterSwing = 0.08;
      let legMaxForward = 0.68;
      let legMaxBackward = -0.52;

      if (state === 'run') {
        legAmplitude = 0.66 * runningBlend;
        armAmplitude = 1.02 * runningBlend;
        shinBendBase = 0.22;
        shinBendGain = 0.3 * runningBlend;
        footPitchBase = -0.14;
        footPitchGain = 0.24 * runningBlend;
        elbowBendBias = -0.46;
        elbowRunGain = 0.26 * runningBlend;
        hipPitch = -0.04;
        spinePitch = 0.05;
        chestPitch = 0.03;
        headPitch = 0.02;
        torsoRollAmp = 0.03 * runningBlend;
        armDownZ = 0.74;
        armYaw = 0.12;
        handPitch = -0.1;
        handSwingGain = 0.22;
        forearmCounterSwing = 0.18;
        legMaxForward = 0.64;
        legMaxBackward = -0.46;
      } else if (state === 'jump') {
        legPoseBias = -0.2;
        armPoseBias = -0.26;
        shinBendBase = 0.42;
        shinBendGain = 0.1;
        footPitchBase = 0.18;
        footPitchGain = 0.04;
        elbowBendBias = -0.52;
        hipPitch = -0.1;
        spinePitch = 0.1;
        chestPitch = 0.06;
        headPitch = -0.02;
        armDownZ = 0.64;
        armYaw = 0.14;
        handPitch = -0.16;
        handSwingGain = 0.05;
        forearmCounterSwing = 0.04;
      } else if (state === 'fall') {
        legPoseBias = 0.16;
        armPoseBias = -0.05;
        shinBendBase = 0.22;
        shinBendGain = 0.12;
        footPitchBase = 0.06;
        footPitchGain = 0.06;
        elbowBendBias = -0.3;
        hipPitch = 0.04;
        spinePitch = -0.04;
        chestPitch = -0.03;
        headPitch = 0.05;
        armDownZ = 0.68;
        armYaw = 0.18;
        handPitch = -0.07;
        handSwingGain = 0.05;
        forearmCounterSwing = 0.05;
      } else if (state === 'land') {
        legPoseBias = 0.22;
        armPoseBias = 0.2;
        shinBendBase = 0.5;
        shinBendGain = 0.1;
        footPitchBase = -0.22;
        footPitchGain = 0.03;
        elbowBendBias = -0.48;
        hipPitch = 0.2;
        spinePitch = -0.1;
        chestPitch = -0.06;
        headPitch = 0.02;
        armDownZ = 0.82;
        armYaw = 0.09;
        handPitch = -0.14;
        handSwingGain = 0.04;
        forearmCounterSwing = 0.05;
      } else {
        legAmplitude = 0.06 * runningBlend;
        armAmplitude = 0.12 * runningBlend;
        shinBendBase = 0.15;
        shinBendGain = 0.06;
        footPitchBase = -0.04;
        footPitchGain = 0.03;
        elbowBendBias = -0.34;
        hipPitch = 0.01;
        spinePitch = 0.02;
        chestPitch = 0.01;
        headPitch = -0.01;
        armDownZ = 0.9;
        armYaw = 0.08;
        handPitch = -0.06;
        handSwingGain = 0.06;
        forearmCounterSwing = 0.04;
      }

      const strideAbs = Math.abs(stride);
      const leftLegRaw = legPoseBias + stride * legAmplitude;
      const rightLegRaw = legPoseBias + strideOpposite * legAmplitude;
      const leftLegTarget = MathUtils.clamp(leftLegRaw, legMaxBackward, legMaxForward);
      const rightLegTarget = MathUtils.clamp(rightLegRaw, legMaxBackward, legMaxForward);

      const leftKneeLift = (1 - Math.cos(phase - Math.PI * 0.18)) * 0.5;
      const rightKneeLift = (1 - Math.cos(phase + Math.PI - Math.PI * 0.18)) * 0.5;
      const leftShinTarget = shinBendBase + leftKneeLift * shinBendGain;
      const rightShinTarget = shinBendBase + rightKneeLift * shinBendGain;
      const leftFootTarget = footPitchBase - stride * footPitchGain;
      const rightFootTarget = footPitchBase - strideOpposite * footPitchGain;

      const leftArmTarget = armPoseBias - stride * armAmplitude;
      const rightArmTarget = armPoseBias - strideOpposite * armAmplitude;
      const torsoRoll = Math.sin(phase) * torsoRollAmp;
      const elbowWave = strideAbs * elbowRunGain;
      const leftForearmTarget =
        elbowBendBias -
        elbowWave -
        Math.max(0, leftArmTarget) * 0.2 +
        strideOpposite * forearmCounterSwing;
      const rightForearmTarget =
        elbowBendBias -
        elbowWave -
        Math.max(0, rightArmTarget) * 0.2 +
        stride * forearmCounterSwing;
      const leftArmZ = -(armDownZ + torsoRoll * 0.35);
      const rightArmZ = armDownZ + torsoRoll * 0.35;
      const handSwing = stride * handSwingGain * moveBlend;

      const spineBounce = bounce * 0.04 * moveBlend;
      const headNod = bounce * 0.03 * moveBlend;

      applyEntries(hips, hipPitch + spineBounce * 0.35, 0, torsoRoll * 0.55, context.delta, 8);
      applyEntries(spines, spinePitch + spineBounce, 0, -torsoRoll * 0.75, context.delta, 9);
      applyEntries(chests, chestPitch + spineBounce * 0.45, 0, -torsoRoll * 0.55, context.delta, 9);
      applyEntries(heads, headPitch - headNod, 0, torsoRoll * 0.35, context.delta, 10);

      applyEntries(leftLegs, leftLegTarget, 0, 0, context.delta, 10);
      applyEntries(rightLegs, rightLegTarget, 0, 0, context.delta, 10);
      applyEntries(leftShins, leftShinTarget, 0, 0, context.delta, 12);
      applyEntries(rightShins, rightShinTarget, 0, 0, context.delta, 12);
      applyEntries(leftFeet, leftFootTarget, 0, 0, context.delta, 12);
      applyEntries(rightFeet, rightFootTarget, 0, 0, context.delta, 12);

      applyEntries(leftArms, leftArmTarget, armYaw, leftArmZ, context.delta, 10);
      applyEntries(rightArms, rightArmTarget, -armYaw, rightArmZ, context.delta, 10);
      applyEntries(leftForearms, leftForearmTarget, 0, -0.12, context.delta, 12);
      applyEntries(rightForearms, rightForearmTarget, 0, 0.12, context.delta, 12);
      applyEntries(leftHands, handPitch - handSwing, 0, -0.08, context.delta, 12);
      applyEntries(rightHands, handPitch + handSwing, 0, 0.08, context.delta, 12);
    },
  };
}

function createRigidPartAnimator(root: Group): ProceduralBoneAnimator | null {
  interface RigidPartEntry extends BoneEntry {
    centerX: number;
    centerY: number;
  }

  const candidates: RigidPartEntry[] = [];
  const center = new Vector3();
  const size = new Vector3();

  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const bounds = new Box3().setFromObject(mesh);
    if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) return;

    bounds.getCenter(center);
    bounds.getSize(size);
    if (size.length() < 0.04) return;

    const localCenter = root.worldToLocal(center.clone());
    candidates.push({
      node,
      baseX: node.rotation.x,
      baseY: node.rotation.y,
      baseZ: node.rotation.z,
      centerX: localCenter.x,
      centerY: localCenter.y,
    });
  });

  if (candidates.length < 3) return null;

  const minY = Math.min(...candidates.map((item) => item.centerY));
  const maxY = Math.max(...candidates.map((item) => item.centerY));
  const minX = Math.min(...candidates.map((item) => item.centerX));
  const maxX = Math.max(...candidates.map((item) => item.centerX));
  const ySpan = Math.max(0.001, maxY - minY);
  const xSpan = Math.max(0.001, maxX - minX);
  const upperY = minY + ySpan * 0.58;
  const lowerY = minY + ySpan * 0.42;
  const sideThreshold = Math.max(0.04, xSpan * 0.13);

  const leftArms: RigidPartEntry[] = [];
  const rightArms: RigidPartEntry[] = [];
  const leftLegs: RigidPartEntry[] = [];
  const rightLegs: RigidPartEntry[] = [];
  const torso: RigidPartEntry[] = [];

  candidates.forEach((item) => {
    const absX = Math.abs(item.centerX);
    if (item.centerY >= upperY && absX >= sideThreshold) {
      if (item.centerX < 0) leftArms.push(item);
      else rightArms.push(item);
      return;
    }
    if (item.centerY <= lowerY && absX >= sideThreshold * 0.65) {
      if (item.centerX < 0) leftLegs.push(item);
      else rightLegs.push(item);
      return;
    }
    torso.push(item);
  });

  if (!leftArms.length && !rightArms.length && !leftLegs.length && !rightLegs.length) {
    return null;
  }

  const applyEntries = (
    entries: RigidPartEntry[],
    targetX: number,
    targetY: number,
    targetZ: number,
    delta: number,
    responsiveness: number,
  ) => {
    entries.forEach((entry) => {
      entry.node.rotation.x = MathUtils.damp(
        entry.node.rotation.x,
        entry.baseX + targetX,
        responsiveness,
        delta,
      );
      entry.node.rotation.y = MathUtils.damp(
        entry.node.rotation.y,
        entry.baseY + targetY,
        responsiveness,
        delta,
      );
      entry.node.rotation.z = MathUtils.damp(
        entry.node.rotation.z,
        entry.baseZ + targetZ,
        responsiveness,
        delta,
      );
    });
  };

  return {
    update(context, state) {
      const runningBlend = MathUtils.clamp(context.horizontalSpeed / 6.4, 0, 1);
      const phase = context.elapsed * MathUtils.lerp(5.8, 11.8, runningBlend);
      const stride = Math.sin(phase);
      const strideOpposite = Math.sin(phase + Math.PI);

      let legAmplitude = 0.28 + runningBlend * 0.28;
      let armAmplitude = 0.22 + runningBlend * 0.24;
      let legBias = 0;
      let armBias = 0;
      let torsoPitch = 0;

      if (state === 'jump') {
        legBias = -0.16;
        armBias = -0.18;
        torsoPitch = -0.04;
      } else if (state === 'fall') {
        legBias = 0.12;
        armBias = -0.08;
        torsoPitch = 0.03;
      } else if (state === 'land') {
        legBias = 0.18;
        armBias = 0.14;
        torsoPitch = 0.04;
      } else if (state !== 'run') {
        legAmplitude *= 0.35;
        armAmplitude *= 0.4;
      }

      const leftLegX = MathUtils.clamp(legBias + stride * legAmplitude, -0.42, 0.48);
      const rightLegX = MathUtils.clamp(legBias + strideOpposite * legAmplitude, -0.42, 0.48);
      const leftArmX = MathUtils.clamp(armBias - stride * armAmplitude, -0.56, 0.52);
      const rightArmX = MathUtils.clamp(armBias - strideOpposite * armAmplitude, -0.56, 0.52);

      applyEntries(leftLegs, leftLegX, 0, 0, context.delta, 10);
      applyEntries(rightLegs, rightLegX, 0, 0, context.delta, 10);
      applyEntries(leftArms, leftArmX, 0.06, -0.16, context.delta, 10);
      applyEntries(rightArms, rightArmX, -0.06, 0.16, context.delta, 10);
      applyEntries(torso, torsoPitch, 0, 0, context.delta, 8);
    },
  };
}

function createOrbParts(): CharacterPartSet {
  const root = new Group();

  const bodyMaterial = new MeshStandardMaterial({
    color: '#fb7185',
    roughness: 0.36,
    metalness: 0.09,
  });
  const ringMaterial = new MeshStandardMaterial({
    color: '#f97316',
    roughness: 0.4,
    metalness: 0.3,
    emissive: '#f97316',
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.58,
    side: 2,
  });

  const body = new Mesh(new SphereGeometry(0.42, 26, 24), bodyMaterial);
  body.castShadow = true;
  root.add(body);

  const ring = new Mesh(new RingGeometry(0.52, 0.67, 36), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.39;
  root.add(ring);

  return {
    root,
    materials: [bodyMaterial, ringMaterial],
    update: (context, state) => {
      const { delta, elapsed, horizontalSpeed, verticalSpeed } = context;
      const moveFactor = Math.min(1, horizontalSpeed / 6.2);
      body.rotation.y += delta * (1.2 + moveFactor * 3.2);

      if (state === 'jump') {
        root.scale.set(0.95, 1.08, 0.95);
      } else if (state === 'land') {
        root.scale.set(1.08, 0.92, 1.08);
      } else {
        root.scale.set(1, 1, 1);
      }

      const bobBase = state === 'run' ? 0.05 : 0.02;
      const bob = Math.sin(elapsed * (state === 'run' ? 12 : 6)) * bobBase;
      root.position.y = bob + (verticalSpeed > 0 ? 0.04 : 0);
      ring.rotation.z += delta * (state === 'run' ? 5.2 : 2.3);
      ring.material.opacity = state === 'fall' ? 0.4 : 0.58;
    },
  };
}

function createRunnerFallbackParts(): CharacterPartSet {
  const root = new Group();

  const bodyMaterial = new MeshStandardMaterial({
    color: new Color('#f59e0b'),
    roughness: 0.4,
    metalness: 0.12,
  });
  const headMaterial = new MeshStandardMaterial({
    color: new Color('#fef3c7'),
    roughness: 0.45,
    metalness: 0.08,
  });
  const legMaterial = new MeshStandardMaterial({
    color: new Color('#1f2937'),
    roughness: 0.5,
    metalness: 0.1,
  });
  const accentMaterial = new MeshStandardMaterial({
    color: new Color('#22d3ee'),
    roughness: 0.36,
    metalness: 0.2,
    emissive: '#0891b2',
    emissiveIntensity: 0.1,
  });

  const torso = new Mesh(new BoxGeometry(0.5, 0.62, 0.34), bodyMaterial);
  torso.position.y = 0.18;
  torso.castShadow = true;

  const head = new Mesh(new SphereGeometry(0.23, 18, 16), headMaterial);
  head.position.y = 0.66;
  head.castShadow = true;

  const leftLeg = new Mesh(new BoxGeometry(0.14, 0.38, 0.14), legMaterial);
  const rightLeg = new Mesh(new BoxGeometry(0.14, 0.38, 0.14), legMaterial);
  leftLeg.position.set(-0.14, -0.23, 0);
  rightLeg.position.set(0.14, -0.23, 0);
  leftLeg.castShadow = true;
  rightLeg.castShadow = true;

  const backpack = new Mesh(new BoxGeometry(0.16, 0.28, 0.12), accentMaterial);
  backpack.position.set(0, 0.16, -0.22);
  backpack.castShadow = true;

  root.add(torso);
  root.add(head);
  root.add(leftLeg);
  root.add(rightLeg);
  root.add(backpack);

  return {
    root,
    materials: [bodyMaterial, headMaterial, legMaterial, accentMaterial],
    update: (context, state) => {
      const { elapsed, horizontalSpeed, verticalSpeed } = context;
      const running = state === 'run';
      const swing = running ? Math.sin(elapsed * 13) * Math.min(0.45, horizontalSpeed * 0.08) : 0;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;

      if (state === 'jump') {
        root.rotation.z = -0.05;
        root.scale.set(0.98, 1.06, 0.98);
      } else if (state === 'fall') {
        root.rotation.z = 0.07;
        root.scale.set(1, 1, 1);
      } else if (state === 'land') {
        root.rotation.z = 0;
        root.scale.set(1.06, 0.92, 1.06);
      } else {
        root.rotation.z = 0;
        root.scale.set(1, 1, 1);
      }

      root.position.y = Math.sin(elapsed * (running ? 18 : 5)) * (running ? 0.04 : 0.015);
      if (verticalSpeed > 0.2) {
        root.position.y += 0.03;
      }
    },
  };
}

// ── 木制玩偶角色（程序化，无 GLB）──────────────────────────────────────────────
// ─── 🐼 熊猫角色（程序化） ───────────────────────────────────────────────────
function createPandaParts(): CharacterPartSet {
  const root = new Group();

  const whiteMat = new MeshStandardMaterial({ color: '#F5F5F0', roughness: 0.65, metalness: 0.0 });
  const blackMat = new MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.72, metalness: 0.0 });
  const noseMat = new MeshStandardMaterial({ color: '#3D2B1F', roughness: 0.8, metalness: 0.0 });
  const eyeWMat = new MeshStandardMaterial({ color: '#F0EEE8', roughness: 0.5, metalness: 0.0 });
  const pupilMat = new MeshStandardMaterial({ color: '#0A0A0A', roughness: 0.5, metalness: 0.0 });

  // ── 躯干（椭球感：XZ 宽，Y 矮）──────────────────────────────────────────
  const torso = new Mesh(new SphereGeometry(0.24, 16, 12), whiteMat);
  torso.scale.set(1, 0.88, 0.9);
  torso.position.y = 0.28;
  torso.castShadow = true;

  // ── 头（大圆）────────────────────────────────────────────────────────────
  const head = new Mesh(new SphereGeometry(0.25, 20, 16), whiteMat);
  head.position.y = 0.74;
  head.castShadow = true;

  // ── 圆耳（黑色）─────────────────────────────────────────────────────────
  const earGeo = new SphereGeometry(0.085, 10, 8);
  const leftEar = new Mesh(earGeo, blackMat);
  leftEar.position.set(-0.2, 0.96, 0.0);
  const rightEar = new Mesh(earGeo, blackMat);
  rightEar.position.set(0.2, 0.96, 0.0);

  // ── 黑眼圈（椭圆形黑斑）──────────────────────────────────────────────────
  const eyePatchGeo = new SphereGeometry(0.085, 10, 8);
  const leftPatch = new Mesh(eyePatchGeo, blackMat);
  leftPatch.scale.set(0.9, 0.7, 0.5);
  leftPatch.position.set(-0.1, 0.77, 0.22);
  const rightPatch = new Mesh(eyePatchGeo, blackMat);
  rightPatch.scale.set(0.9, 0.7, 0.5);
  rightPatch.position.set(0.1, 0.77, 0.22);

  // ── 眼白 + 瞳孔 ──────────────────────────────────────────────────────────
  const eyeWGeo = new SphereGeometry(0.045, 8, 6);
  const leftEyeW = new Mesh(eyeWGeo, eyeWMat);
  leftEyeW.position.set(-0.1, 0.78, 0.27);
  const rightEyeW = new Mesh(eyeWGeo, eyeWMat);
  rightEyeW.position.set(0.1, 0.78, 0.27);
  const pupilGeo = new SphereGeometry(0.025, 6, 4);
  const leftPupil = new Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.1, 0.78, 0.31);
  const rightPupil = new Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.1, 0.78, 0.31);

  // ── 鼻子 ─────────────────────────────────────────────────────────────────
  const nose = new Mesh(new SphereGeometry(0.04, 8, 6), noseMat);
  nose.scale.set(1.1, 0.7, 0.8);
  nose.position.set(0, 0.71, 0.3);

  // ── 黑色手臂（前肢）─────────────────────────────────────────────────────
  const armGeo = new CylinderGeometry(0.07, 0.06, 0.32, 10);
  const leftArm = new Mesh(armGeo, blackMat);
  leftArm.position.set(-0.28, 0.28, 0.04);
  leftArm.rotation.z = 0.5;
  leftArm.castShadow = true;
  const rightArm = new Mesh(armGeo, blackMat);
  rightArm.position.set(0.28, 0.28, 0.04);
  rightArm.rotation.z = -0.5;
  rightArm.castShadow = true;

  // ── 黑色腿（后肢）───────────────────────────────────────────────────────
  const legGeo = new CylinderGeometry(0.09, 0.08, 0.3, 12);
  const leftLeg = new Mesh(legGeo, blackMat);
  leftLeg.position.set(-0.13, -0.04, 0.0);
  leftLeg.castShadow = true;
  const rightLeg = new Mesh(legGeo, blackMat);
  rightLeg.position.set(0.13, -0.04, 0.0);
  rightLeg.castShadow = true;

  // ── 小尾巴（白色圆球）────────────────────────────────────────────────────
  const tail = new Mesh(new SphereGeometry(0.07, 8, 6), whiteMat);
  tail.position.set(0, 0.24, -0.26);

  root.add(
    torso,
    head,
    leftEar,
    rightEar,
    leftPatch,
    rightPatch,
    leftEyeW,
    rightEyeW,
    leftPupil,
    rightPupil,
    nose,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tail,
  );

  const allMaterials: Material[] = [whiteMat, blackMat, noseMat, eyeWMat, pupilMat];

  // ── 动画更新（与木偶相似的跑步/跳跃动画）────────────────────────────────
  function update(ctx: CharacterUpdateContext, st: ClimberCharacterAnimationState): void {
    const { elapsed, horizontalSpeed, verticalSpeed } = ctx;
    const runT = Math.min(1, horizontalSpeed / 5.4);

    // 腿部交替摆动
    const legSwing = Math.sin(elapsed * 9.0) * 0.55 * runT;
    leftLeg.rotation.x = legSwing;
    rightLeg.rotation.x = -legSwing;

    // 手臂对向摆动
    const armSwing = Math.sin(elapsed * 9.0) * 0.4 * runT;
    leftArm.rotation.x = -armSwing;
    rightArm.rotation.x = armSwing;

    // 躯干轻微左右倾斜
    torso.rotation.z = Math.sin(elapsed * 9.0) * 0.05 * runT;

    // 头部小幅晃动
    head.position.y = 0.74 + Math.sin(elapsed * 9.0 * 2) * 0.015 * runT;

    if (st === 'jump' || st === 'fall') {
      // 跳跃时腿收起，耳朵略向后
      leftLeg.rotation.x = 0.6;
      rightLeg.rotation.x = 0.6;
      leftArm.rotation.z = 0.8;
      rightArm.rotation.z = -0.8;
      // Squash & stretch
      const stretch = verticalSpeed > 0 ? 1.12 : 0.92;
      torso.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
      head.scale.setScalar(verticalSpeed > 0 ? 1.05 : 0.96);
    } else if (st === 'land') {
      torso.scale.set(1.14, 0.82, 1.14);
      head.scale.setScalar(0.94);
    } else {
      torso.scale.set(1, 0.88, 0.9);
      head.scale.setScalar(1);
      // 平时手臂自然下垂
      if (runT < 0.05) {
        leftArm.rotation.z = 0.5;
        rightArm.rotation.z = -0.5;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
      }
    }

    // 尾巴小幅摆动
    tail.rotation.x = Math.sin(elapsed * 3.5) * 0.12;
  }

  return { root, materials: allMaterials, update };
}

function createWoodenDollParts(): CharacterPartSet {
  const root = new Group();

  // 木纹暖棕色
  const woodMat = new MeshStandardMaterial({ color: '#C8874A', roughness: 0.78, metalness: 0.0 });
  // 深色关节
  const jointMat = new MeshStandardMaterial({ color: '#8B5E3C', roughness: 0.88, metalness: 0.0 });
  // 脸部象牙白
  const faceMat = new MeshStandardMaterial({ color: '#F5DEB3', roughness: 0.6, metalness: 0.0 });
  // 眼睛黑
  const eyeMat = new MeshStandardMaterial({ color: '#1a1008', roughness: 0.5, metalness: 0.0 });
  // 衣服（蓝色小围兜感）
  const clothMat = new MeshStandardMaterial({ color: '#4A90D9', roughness: 0.7, metalness: 0.0 });

  // ── 身体各部分 ──────────────────────────────────────────────────────────
  // 躯干：圆柱，稍宽
  const torso = new Mesh(new CylinderGeometry(0.2, 0.22, 0.5, 16), woodMat);
  torso.position.y = 0.25;
  torso.castShadow = true;

  // 胸前小围兜
  const bib = new Mesh(new CylinderGeometry(0.14, 0.15, 0.2, 12), clothMat);
  bib.position.set(0, 0.35, 0.08);
  bib.rotation.x = 0.25;

  // 头：大圆球
  const head = new Mesh(new SphereGeometry(0.22, 20, 16), faceMat);
  head.position.y = 0.68;
  head.castShadow = true;

  // 左眼
  const leftEye = new Mesh(new SphereGeometry(0.04, 10, 8), eyeMat);
  leftEye.position.set(-0.08, 0.73, 0.19);
  // 右眼
  const rightEye = new Mesh(new SphereGeometry(0.04, 10, 8), eyeMat);
  rightEye.position.set(0.08, 0.73, 0.19);

  // 颈部关节球
  const neck = new Mesh(new SphereGeometry(0.1, 12, 10), jointMat);
  neck.position.y = 0.52;

  // 左大腿
  const leftThigh = new Mesh(new CylinderGeometry(0.09, 0.08, 0.26, 12), woodMat);
  leftThigh.position.set(-0.14, -0.02, 0);
  leftThigh.castShadow = true;
  // 左小腿
  const leftShin = new Mesh(new CylinderGeometry(0.07, 0.07, 0.22, 12), woodMat);
  leftShin.position.set(-0.14, -0.29, 0);
  leftShin.castShadow = true;
  // 左膝关节
  const leftKnee = new Mesh(new SphereGeometry(0.075, 10, 8), jointMat);
  leftKnee.position.set(-0.14, -0.16, 0);

  // 右大腿
  const rightThigh = new Mesh(new CylinderGeometry(0.09, 0.08, 0.26, 12), woodMat);
  rightThigh.position.set(0.14, -0.02, 0);
  rightThigh.castShadow = true;
  // 右小腿
  const rightShin = new Mesh(new CylinderGeometry(0.07, 0.07, 0.22, 12), woodMat);
  rightShin.position.set(0.14, -0.29, 0);
  rightShin.castShadow = true;
  // 右膝关节
  const rightKnee = new Mesh(new SphereGeometry(0.075, 10, 8), jointMat);
  rightKnee.position.set(0.14, -0.16, 0);

  // 左臂
  const leftArm = new Mesh(new CylinderGeometry(0.06, 0.055, 0.32, 10), woodMat);
  leftArm.position.set(-0.29, 0.22, 0);
  leftArm.rotation.z = 0.3;
  leftArm.castShadow = true;
  const leftShoulder = new Mesh(new SphereGeometry(0.075, 10, 8), jointMat);
  leftShoulder.position.set(-0.23, 0.38, 0);

  // 右臂
  const rightArm = new Mesh(new CylinderGeometry(0.06, 0.055, 0.32, 10), woodMat);
  rightArm.position.set(0.29, 0.22, 0);
  rightArm.rotation.z = -0.3;
  rightArm.castShadow = true;
  const rightShoulder = new Mesh(new SphereGeometry(0.075, 10, 8), jointMat);
  rightShoulder.position.set(0.23, 0.38, 0);

  // 脚（小圆柱）
  const leftFoot = new Mesh(new CylinderGeometry(0.08, 0.07, 0.1, 10), woodMat);
  leftFoot.position.set(-0.14, -0.44, 0.02);
  leftFoot.rotation.x = 0.15;
  const rightFoot = new Mesh(new CylinderGeometry(0.08, 0.07, 0.1, 10), woodMat);
  rightFoot.position.set(0.14, -0.44, 0.02);
  rightFoot.rotation.x = 0.15;

  root.add(
    torso,
    bib,
    head,
    leftEye,
    rightEye,
    neck,
    leftThigh,
    leftShin,
    leftKnee,
    rightThigh,
    rightShin,
    rightKnee,
    leftArm,
    leftShoulder,
    rightArm,
    rightShoulder,
    leftFoot,
    rightFoot,
  );

  return {
    root,
    materials: [woodMat, jointMat, faceMat, eyeMat, clothMat],
    update: (context, state) => {
      const { elapsed, delta, horizontalSpeed, verticalSpeed } = context;
      const running = state === 'run';
      const speed = Math.min(1, horizontalSpeed / 6);

      // 腿部摆动
      const legSwing = running
        ? Math.sin(elapsed * 14) * (0.3 + speed * 0.35)
        : Math.sin(elapsed * 4) * 0.04;
      leftThigh.rotation.x = legSwing;
      leftShin.rotation.x = legSwing * 0.5 + (running ? 0.1 : 0);
      rightThigh.rotation.x = -legSwing;
      rightShin.rotation.x = -legSwing * 0.5 + (running ? 0.1 : 0);

      // 手臂对向摆动
      const armSwing = running ? -legSwing * 0.6 : Math.sin(elapsed * 3.5) * 0.05;
      leftArm.rotation.x = armSwing;
      rightArm.rotation.x = -armSwing;

      // 头部左右轻晃（idle 时更明显）
      head.rotation.z = Math.sin(elapsed * 2.2) * (running ? 0.02 : 0.06);
      head.rotation.y = Math.sin(elapsed * 1.4) * 0.04;

      // 躯干随跑步微扭
      torso.rotation.y = running ? Math.sin(elapsed * 14) * 0.04 : 0;

      // 跳跃/落地 squash-stretch
      if (state === 'jump') {
        root.scale.set(0.93, 1.1, 0.93);
      } else if (state === 'land') {
        root.scale.set(1.1, 0.88, 1.1);
      } else {
        const s = root.scale.x;
        root.scale.set(
          MathUtils.damp(s, 1, 12, delta),
          MathUtils.damp(root.scale.y, 1, 12, delta),
          MathUtils.damp(s, 1, 12, delta),
        );
      }

      // bob（呼吸感）
      const bobAmp = running ? 0.045 : 0.012;
      const bobFreq = running ? 14 : 5;
      root.position.y = Math.sin(elapsed * bobFreq) * bobAmp;
      if (verticalSpeed > 0.2) root.position.y += 0.04;
    },
  };
}

function createModelRuntime(
  characterId: 'peach' | 'daisy',
  gltfScene: Group,
  clips: AnimationClip[],
): ModelRuntime | null {
  const runtimeRoot = new Group();
  runtimeRoot.add(gltfScene);
  setCastShadowDeep(runtimeRoot);
  normalizeModelHeight(runtimeRoot, 1.32);
  const autoFootCalibrationOffsetY = resolveAutoFootCalibrationOffsetY(runtimeRoot);
  const baseOffsetY = runtimeRoot.position.y;
  const baseScale = runtimeRoot.scale.clone();
  let hasSkeleton = false;
  runtimeRoot.traverse((node) => {
    const mesh = node as Mesh & { isSkinnedMesh?: boolean };
    if (mesh.isSkinnedMesh) {
      hasSkeleton = true;
    }
  });
  const proceduralAnimator = hasSkeleton
    ? createProceduralBoneAnimator(runtimeRoot, characterId)
    : null;
  const rigidPartAnimator = hasSkeleton ? null : createRigidPartAnimator(runtimeRoot);
  const mixer = new AnimationMixer(runtimeRoot);
  const actions: Partial<Record<ClimberCharacterAnimationState, AnimationAction>> = {};

  const resolvedClips = resolveCharacterClips(characterId, clips);
  const bindStateClip = (
    state: ClimberCharacterAnimationState,
    clip: AnimationClip | undefined,
  ) => {
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    actions[state] = action;
  };

  bindStateClip('idle', resolvedClips.idle);
  bindStateClip('run', resolvedClips.run);
  bindStateClip('stop', resolvedClips.stop);
  bindStateClip('jump', resolvedClips.jump);
  bindStateClip('fall', resolvedClips.fall);
  bindStateClip('land', resolvedClips.land);
  const actionNames: Partial<Record<ClimberCharacterAnimationState, string>> = {
    idle: resolvedClips.idle?.name,
    run: resolvedClips.run?.name,
    stop: resolvedClips.stop?.name,
    jump: resolvedClips.jump?.name,
    fall: resolvedClips.fall?.name,
    land: resolvedClips.land?.name,
  };

  if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    const clipName = (clip: AnimationClip | undefined) =>
      clip ? `${clip.name}(${clip.duration.toFixed(2)}s)` : 'none';
    console.info('[climber-game] character clips', {
      characterId,
      jumpPhaseTuned: Boolean(CHARACTER_JUMP_PHASE_TUNING[characterId]),
      available: clips.map((clip) => `${clip.name}(${clip.duration.toFixed(2)}s)`),
      verticalScores: clips.map((clip) => ({
        name: clip.name,
        duration: Number(clip.duration.toFixed(3)),
        vertical: Number(estimateClipVerticalMotion(clip).toFixed(6)),
      })),
      selected: {
        idle: clipName(resolvedClips.idle),
        run: clipName(resolvedClips.run),
        stop: clipName(resolvedClips.stop),
        jump: clipName(resolvedClips.jump),
        fall: clipName(resolvedClips.fall),
        land: clipName(resolvedClips.land),
      },
    });
  }

  const hasPlayableAnimation =
    Boolean(actions.run) ||
    Boolean(actions.stop) ||
    Boolean(actions.idle) ||
    Boolean(actions.jump) ||
    Boolean(actions.fall) ||
    Boolean(actions.land);
  const usesProceduralOverlay = !hasSkeleton || !hasPlayableAnimation;

  if (!hasPlayableAnimation) {
    return {
      root: runtimeRoot,
      mixer,
      actions,
      currentState: 'idle',
      isAnimated: false,
      hasSkeleton,
      usesProceduralOverlay,
      baseOffsetY,
      baseScale,
      autoFootCalibrationOffsetY,
      autoFootCalibrationEnabled: true,
      actionNames,
      update(context, state) {
        if (hasSkeleton) {
          proceduralAnimator?.update(context, state);
        } else {
          rigidPartAnimator?.update(context, state);
        }
      },
      dispose: () => undefined,
    };
  }

  let currentState: ClimberCharacterAnimationState = 'idle';
  const playState = (nextState: ClimberCharacterAnimationState) => {
    if (nextState === currentState) return;
    const currentAction = resolveActionForState(actions, currentState);
    const nextAction = resolveActionForState(actions, nextState);
    if (!nextAction) return;

    nextAction.enabled = true;
    nextAction.loop =
      nextState === 'jump' || nextState === 'land' || nextState === 'stop' ? LoopOnce : LoopRepeat;
    nextAction.clampWhenFinished =
      nextState === 'jump' || nextState === 'land' || nextState === 'stop';

    if (currentAction === nextAction) {
      if ((nextState === 'jump' || nextState === 'stop') && currentState !== nextState) {
        nextAction.reset();
        nextAction.play();
      }
      currentState = nextState;
      return;
    }

    nextAction.reset();
    nextAction.fadeIn(0.15);
    nextAction.play();
    if (currentAction && currentAction !== nextAction) {
      currentAction.fadeOut(0.12);
    }
    currentState = nextState;
  };

  const bootstrapAction = resolveActionForState(actions, 'idle');
  if (bootstrapAction) {
    bootstrapAction.loop = LoopRepeat;
    bootstrapAction.clampWhenFinished = false;
    bootstrapAction.play();
  }

  return {
    root: runtimeRoot,
    mixer,
    actions,
    currentState,
    isAnimated: hasPlayableAnimation,
    hasSkeleton,
    usesProceduralOverlay,
    baseOffsetY,
    baseScale,
    autoFootCalibrationOffsetY,
    autoFootCalibrationEnabled: true,
    actionNames,
    update(context, state) {
      playState(state);
      const runAction = actions.run;
      if (runAction) {
        if (state === 'run') {
          runAction.paused = false;
          runAction.timeScale = MathUtils.clamp(context.horizontalSpeed / 3.2, 0.85, 1.65);
        } else if (!actions.idle) {
          // 仅有 run/jump 时，idle 回退到低速循环，避免停在 T Pose。
          runAction.paused = false;
          runAction.timeScale = MathUtils.damp(runAction.timeScale, 0.32, 9, context.delta);
        } else {
          runAction.paused = false;
          runAction.timeScale = MathUtils.damp(runAction.timeScale, 1, 8, context.delta);
        }
      }
      mixer.update(context.delta);
      if (usesProceduralOverlay && hasSkeleton) {
        proceduralAnimator?.update(context, state);
      } else if (!hasSkeleton) {
        rigidPartAnimator?.update(context, state);
      }
    },
    dispose() {
      mixer.stopAllAction();
    },
  };
}

// ─── 🐸 青蛙角色（程序化） ───────────────────────────────────────────────────
function createFrogParts(): CharacterPartSet {
  const root = new Group();

  const bodyMat = new MeshStandardMaterial({ color: '#4CAF50', roughness: 0.7, metalness: 0.0 });
  const bellMat = new MeshStandardMaterial({ color: '#A5D6A7', roughness: 0.7, metalness: 0.0 });
  const eyeWhiteMat = new MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.5,
    metalness: 0.0,
  });
  const eyeGoldMat = new MeshStandardMaterial({ color: '#FFD600', roughness: 0.4, metalness: 0.1 });
  const pupilMatF = new MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.5, metalness: 0.0 });
  const limbMat = new MeshStandardMaterial({ color: '#388E3C', roughness: 0.75, metalness: 0.0 });

  // 躯干（扁宽椭球：scaleX/Z > scaleY）
  const bodyGeo = new SphereGeometry(0.38, 12, 8);
  const body = new Mesh(bodyGeo, bodyMat);
  body.scale.set(1.2, 0.85, 1.1);
  body.position.y = 0.32;
  root.add(body);

  // 腹部浅色
  const bellyGeo = new SphereGeometry(0.26, 12, 8);
  const belly = new Mesh(bellyGeo, bellMat);
  belly.scale.set(0.9, 0.7, 0.5);
  belly.position.set(0, 0.28, 0.22);
  root.add(belly);

  // 眼睛（左右对称，突出大眼球）
  const makeEye = (side: 1 | -1) => {
    const eyeGroup = new Group();
    const sclera = new Mesh(new SphereGeometry(0.12, 10, 8), eyeWhiteMat);
    eyeGroup.add(sclera);
    const iris = new Mesh(new SphereGeometry(0.085, 10, 8), eyeGoldMat);
    iris.position.z = 0.07;
    eyeGroup.add(iris);
    const pupil = new Mesh(new SphereGeometry(0.045, 8, 6), pupilMatF);
    pupil.position.z = 0.13;
    eyeGroup.add(pupil);
    eyeGroup.position.set(side * 0.22, 0.62, 0.26);
    return eyeGroup;
  };
  const leftEye = makeEye(1);
  const rightEye = makeEye(-1);
  root.add(leftEye, rightEye);

  // 前腿（左右）
  const makeFrontLeg = (side: 1 | -1) => {
    const g = new Group();
    const upper = new Mesh(new CylinderGeometry(0.07, 0.06, 0.22, 8), limbMat);
    upper.position.y = -0.11;
    const lower = new Mesh(new CylinderGeometry(0.06, 0.05, 0.18, 8), limbMat);
    lower.position.y = -0.22 - 0.09;
    g.add(upper, lower);
    g.position.set(side * 0.38, 0.26, 0.1);
    g.rotation.z = side * 0.3;
    return g;
  };
  const frontLegL = makeFrontLeg(1);
  const frontLegR = makeFrontLeg(-1);
  root.add(frontLegL, frontLegR);

  // 后腿（左右，更长更有力）
  const makeBackLeg = (side: 1 | -1) => {
    const g = new Group();
    const thigh = new Mesh(new CylinderGeometry(0.09, 0.07, 0.28, 8), limbMat);
    thigh.position.y = -0.14;
    const calf = new Mesh(new CylinderGeometry(0.07, 0.05, 0.26, 8), limbMat);
    calf.position.y = -0.28 - 0.13;
    g.add(thigh, calf);
    g.position.set(side * 0.3, 0.18, -0.2);
    return g;
  };
  const backLegL = makeBackLeg(1);
  const backLegR = makeBackLeg(-1);
  root.add(backLegL, backLegR);

  const allMaterials: Material[] = [bodyMat, bellMat, eyeWhiteMat, eyeGoldMat, pupilMatF, limbMat];

  function update(ctx: CharacterUpdateContext, st: ClimberCharacterAnimationState): void {
    const { elapsed, horizontalSpeed, verticalSpeed } = ctx;

    // 躯干：跳跃时纵向拉伸，落地时压扁
    if (st === 'jump' || st === 'fall') {
      const stretch = verticalSpeed > 0 ? 1.15 : 0.9;
      body.scale.set(1.2 / Math.sqrt(stretch), 0.85 * stretch, 1.1 / Math.sqrt(stretch));
    } else if (st === 'land') {
      body.scale.set(1.4, 0.65, 1.3);
    } else {
      const breathe = Math.sin(elapsed * 1.8) * 0.04;
      body.scale.set(1.2 + breathe, 0.85 - breathe * 0.5, 1.1 + breathe * 0.5);
    }

    // 后腿：跑步时交替摆动，跳跃时猛力伸直
    const runT = Math.min(1, horizontalSpeed / 5.4);
    if (st === 'jump' || st === 'fall') {
      backLegL.rotation.x = -0.7;
      backLegR.rotation.x = -0.7;
      frontLegL.rotation.x = 0.4;
      frontLegR.rotation.x = 0.4;
    } else if (runT > 0.05) {
      const phase = elapsed * 8;
      backLegL.rotation.x = Math.sin(phase) * 0.6 * runT;
      backLegR.rotation.x = Math.sin(phase + Math.PI) * 0.6 * runT;
      frontLegL.rotation.x = Math.sin(phase + Math.PI) * 0.4 * runT;
      frontLegR.rotation.x = Math.sin(phase) * 0.4 * runT;
    } else {
      backLegL.rotation.x = 0;
      backLegR.rotation.x = 0;
      frontLegL.rotation.x = 0;
      frontLegR.rotation.x = 0;
    }

    // 眼睛：随机眨眼（周期约每 2.5s 眨一次）
    const blinkCycle = Math.floor(elapsed * 0.4) % 7;
    const eyeScaleY = blinkCycle === 0 ? Math.max(0.1, 1 - ((elapsed * 0.4) % 1) * 6) : 1;
    leftEye.scale.y = eyeScaleY;
    rightEye.scale.y = eyeScaleY;
  }

  return { root, materials: allMaterials, update };
}

// ─── 🐱 猫咪角色（程序化） ───────────────────────────────────────────────────
function createCatParts(): CharacterPartSet {
  const root = new Group();

  const furMat = new MeshStandardMaterial({ color: '#FF8F00', roughness: 0.75, metalness: 0.0 });
  const innerMat = new MeshStandardMaterial({ color: '#FFCCBC', roughness: 0.7, metalness: 0.0 });
  const whiteCatMat = new MeshStandardMaterial({
    color: '#FAFAFA',
    roughness: 0.65,
    metalness: 0.0,
  });
  const eyeIrisMat = new MeshStandardMaterial({ color: '#00BFA5', roughness: 0.4, metalness: 0.1 });
  const eyeWhiteCatMat = new MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.5,
    metalness: 0.0,
  });
  const pupilCatMat = new MeshStandardMaterial({
    color: '#1A1A1A',
    roughness: 0.5,
    metalness: 0.0,
  });
  const noseCatMat = new MeshStandardMaterial({ color: '#F48FB1', roughness: 0.6, metalness: 0.0 });
  const tailMat = new MeshStandardMaterial({ color: '#E65100', roughness: 0.75, metalness: 0.0 });

  // 躯干（略扁）
  const bodyGeo = new SphereGeometry(0.34, 12, 8);
  const body = new Mesh(bodyGeo, furMat);
  body.scale.set(1.0, 0.9, 1.05);
  body.position.y = 0.3;
  root.add(body);

  // 头部
  const headGroup = new Group();
  const head = new Mesh(new SphereGeometry(0.29, 12, 10), furMat);
  headGroup.add(head);

  // 三角耳（左右）
  const makeEar = (side: 1 | -1) => {
    const g = new CylinderGeometry(0, 0.11, 0.18, 3);
    const ear = new Mesh(g, furMat);
    ear.position.set(side * 0.18, 0.26, 0.0);
    ear.rotation.z = side * 0.15;
    const inner = new Mesh(new CylinderGeometry(0, 0.07, 0.13, 3), innerMat);
    inner.position.set(side * 0.18, 0.26, 0.01);
    inner.rotation.z = side * 0.15;
    headGroup.add(ear, inner);
  };
  makeEar(1);
  makeEar(-1);

  // 眼睛
  const makeCatEye = (side: 1 | -1) => {
    const g = new Group();
    const white = new Mesh(new SphereGeometry(0.085, 10, 8), eyeWhiteCatMat);
    g.add(white);
    const iris = new Mesh(new SphereGeometry(0.065, 10, 8), eyeIrisMat);
    iris.position.z = 0.04;
    g.add(iris);
    const pupil = new Mesh(new SphereGeometry(0.035, 8, 6), pupilCatMat);
    pupil.position.z = 0.09;
    g.add(pupil);
    g.position.set(side * 0.13, 0.07, 0.24);
    return g;
  };
  const leftEyeCat = makeCatEye(1);
  const rightEyeCat = makeCatEye(-1);
  headGroup.add(leftEyeCat, rightEyeCat);

  // 鼻子
  const noseMesh = new Mesh(new SphereGeometry(0.035, 8, 6), noseCatMat);
  noseMesh.scale.set(1.2, 0.7, 0.8);
  noseMesh.position.set(0, -0.04, 0.27);
  headGroup.add(noseMesh);

  headGroup.position.y = 0.68;
  root.add(headGroup);

  // 四肢
  const makeCatLeg = (side: 1 | -1, isFront: boolean) => {
    const g = new Group();
    const upper = new Mesh(new CylinderGeometry(0.075, 0.065, 0.22, 8), furMat);
    upper.position.y = -0.11;
    const lower = new Mesh(new CylinderGeometry(0.065, 0.055, 0.18, 8), furMat);
    lower.position.y = -0.3;
    g.add(upper, lower);
    g.position.set(side * 0.28, 0.22, isFront ? 0.12 : -0.16);
    return g;
  };
  const legFL = makeCatLeg(1, true);
  const legFR = makeCatLeg(-1, true);
  const legBL = makeCatLeg(1, false);
  const legBR = makeCatLeg(-1, false);
  root.add(legFL, legFR, legBL, legBR);

  // 尾巴（Group 绕根部摆动）
  const tailGroup = new Group();
  const tailSeg1 = new Mesh(new CylinderGeometry(0.055, 0.04, 0.3, 8), tailMat);
  tailSeg1.position.y = 0.15;
  const tailSeg2 = new Mesh(new CylinderGeometry(0.04, 0.03, 0.28, 8), tailMat);
  tailSeg2.position.y = 0.44;
  tailSeg2.rotation.x = 0.5;
  const tailTip = new Mesh(new SphereGeometry(0.06, 8, 6), whiteCatMat);
  tailTip.position.y = 0.62;
  tailGroup.add(tailSeg1, tailSeg2, tailTip);
  tailGroup.position.set(0, 0.28, -0.36);
  root.add(tailGroup);

  const allMaterials: Material[] = [
    furMat,
    innerMat,
    whiteCatMat,
    eyeIrisMat,
    eyeWhiteCatMat,
    pupilCatMat,
    noseCatMat,
    tailMat,
  ];

  function update(ctx: CharacterUpdateContext, st: ClimberCharacterAnimationState): void {
    const { elapsed, horizontalSpeed, verticalSpeed } = ctx;
    const runT = Math.min(1, horizontalSpeed / 5.4);

    // 头部随速度方向轻微点头
    headGroup.rotation.x = runT * -0.12;

    // 四肢
    if (st === 'jump' || st === 'fall') {
      legBL.rotation.x = -0.6;
      legBR.rotation.x = -0.6;
      legFL.rotation.x = 0.4;
      legFR.rotation.x = 0.4;
      const stretch = verticalSpeed > 0 ? 1.1 : 0.92;
      body.scale.set(1.0 / Math.sqrt(stretch), 0.9 * stretch, 1.05 / Math.sqrt(stretch));
    } else if (runT > 0.05) {
      const phase = elapsed * 9;
      legFL.rotation.x = Math.sin(phase) * 0.55 * runT;
      legFR.rotation.x = Math.sin(phase + Math.PI) * 0.55 * runT;
      legBL.rotation.x = Math.sin(phase + Math.PI) * 0.55 * runT;
      legBR.rotation.x = Math.sin(phase) * 0.55 * runT;
      body.scale.set(1.0, 0.9, 1.05);
    } else {
      legFL.rotation.x = 0;
      legFR.rotation.x = 0;
      legBL.rotation.x = 0;
      legBR.rotation.x = 0;
      const breathe = Math.sin(elapsed * 2) * 0.03;
      body.scale.set(1.0 + breathe, 0.9 - breathe * 0.5, 1.05 + breathe * 0.3);
    }

    // 尾巴：idle 懒洋洋左右摆，跑步向后伸直，跳跃时翘起
    if (st === 'jump' || st === 'fall') {
      tailGroup.rotation.x = -0.9;
      tailGroup.rotation.z = 0;
    } else if (runT > 0.05) {
      tailGroup.rotation.x = 0.3;
      tailGroup.rotation.z = Math.sin(elapsed * 9) * 0.12 * runT;
    } else {
      tailGroup.rotation.x = Math.sin(elapsed * 1.5) * 0.15;
      tailGroup.rotation.z = Math.sin(elapsed * 1.2) * 0.25;
    }
  }

  return { root, materials: allMaterials, update };
}

function loadCharacterModel(
  characterId: 'peach' | 'daisy',
  onLoaded: (runtime: ModelRuntime) => void,
  onFailed: () => void,
): { dispose: () => void } {
  const modelUrls = CHARACTER_MODEL_URLS[characterId];
  const loader = new GLTFLoader();
  let disposed = false;
  let runtime: ModelRuntime | null = null;

  const tryLoad = (index: number) => {
    if (disposed) return;
    if (index >= modelUrls.length) {
      if (
        typeof window !== 'undefined' &&
        /localhost|127\.0\.0\.1/.test(window.location.hostname)
      ) {
        console.warn('[climber-game] character model load failed', { characterId, modelUrls });
      }
      onFailed();
      return;
    }
    loader.load(
      modelUrls[index],
      (gltf) => {
        if (disposed) return;
        const prepare = async () => {
          await applySpecGlossinessFallback(
            gltf as {
              scene: Group;
              parser?: { getDependency?: (type: string, index: number) => Promise<unknown> };
            },
          );
          if (disposed) return;

          const modelScene = gltf.scene as Group;
          applyModelMaterialStabilityFix(modelScene);
          runtime = createModelRuntime(characterId, modelScene, gltf.animations ?? []);
          if (!runtime) {
            onFailed();
            return;
          }
          onLoaded(runtime);
        };
        void prepare().catch(() => {
          if (!disposed) {
            onFailed();
          }
        });
      },
      undefined,
      () => {
        if (
          typeof window !== 'undefined' &&
          /localhost|127\.0\.0\.1/.test(window.location.hostname)
        ) {
          console.warn('[climber-game] character model url failed, try next', {
            characterId,
            url: modelUrls[index],
          });
        }
        tryLoad(index + 1);
      },
    );
  };

  tryLoad(0);
  return {
    dispose() {
      disposed = true;
      runtime?.dispose();
      runtime = null;
    },
  };
}

export function createCharacterRig(
  characterId: ClimberCharacterId,
  options: CreateCharacterRigOptions = {},
): CharacterRigController {
  const { onRuntimeStatusChange } = options;
  const usesModelCharacter = isModelCharacter(characterId);
  const root = new Group();

  // 选择程序化回退角色：woodendoll 用木偶，panda 用熊猫，frog 用青蛙，cat 用猫咪，orb 用圆球，其余 GLB 加载前用 runner
  const fallback =
    characterId === 'woodendoll'
      ? createWoodenDollParts()
      : characterId === 'panda'
        ? createPandaParts()
        : characterId === 'frog'
          ? createFrogParts()
          : characterId === 'cat'
            ? createCatParts()
            : usesModelCharacter
              ? createRunnerFallbackParts()
              : createOrbParts();
  root.add(fallback.root);

  let state: ClimberCharacterAnimationState = 'idle';
  let grounded = false;
  let landingLockMs = 0;
  let latestHorizontalSpeed = 0;
  let latestVerticalSpeed = 0;
  let disposed = false;
  let modelRuntime: ModelRuntime | null = null;
  let modelLoaderDisposable: { dispose: () => void } | null = null;

  onRuntimeStatusChange?.(usesModelCharacter ? 'model-loading' : 'procedural');

  if (usesModelCharacter) {
    modelLoaderDisposable = loadCharacterModel(
      characterId,
      (runtime) => {
        if (disposed) {
          runtime.dispose();
          return;
        }
        modelRuntime = runtime;
        fallback.root.visible = false;
        root.add(runtime.root);
        if (!runtime.hasSkeleton) {
          onRuntimeStatusChange?.('model-no-rig');
        } else {
          onRuntimeStatusChange?.(runtime.isAnimated ? 'model-ready' : 'model-ready-static');
        }
      },
      () => {
        // keep fallback silently when model assets are missing
        onRuntimeStatusChange?.('model-fallback');
      },
    );
  }

  return {
    group: root,
    setState(nextState) {
      state = nextState;
    },
    setGrounded(nextGrounded) {
      grounded = nextGrounded;
    },
    setLandingLockMs(ms) {
      landingLockMs = Math.max(0, ms);
    },
    setAutoFootCalibrationEnabled(enabled) {
      if (!modelRuntime) return;
      modelRuntime.autoFootCalibrationEnabled = enabled;
    },
    getDebugSnapshot() {
      const availableActions: Partial<Record<ClimberCharacterAnimationState, string>> = modelRuntime
        ? modelRuntime.actionNames
        : {};
      const activeActionName = availableActions[state] ?? 'fallback';
      return {
        currentState: state,
        horizontalSpeed: latestHorizontalSpeed,
        verticalSpeed: latestVerticalSpeed,
        grounded,
        landingLockMs,
        activeActionName,
        availableActions,
        hasSkeleton: modelRuntime?.hasSkeleton ?? false,
        isAnimated: modelRuntime?.isAnimated ?? false,
        usesProceduralOverlay: modelRuntime?.usesProceduralOverlay ?? true,
        autoFootCalibrationEnabled: modelRuntime?.autoFootCalibrationEnabled ?? true,
      };
    },
    update(context) {
      latestHorizontalSpeed = context.horizontalSpeed;
      latestVerticalSpeed = context.verticalSpeed;
      if (modelRuntime) {
        modelRuntime.update(context, state);

        if (!modelRuntime.usesProceduralOverlay) {
          modelRuntime.root.position.y = MathUtils.damp(
            modelRuntime.root.position.y,
            modelRuntime.baseOffsetY,
            10,
            context.delta,
          );
          modelRuntime.root.rotation.x = MathUtils.damp(
            modelRuntime.root.rotation.x,
            0,
            10,
            context.delta,
          );
          modelRuntime.root.rotation.z = MathUtils.damp(
            modelRuntime.root.rotation.z,
            0,
            10,
            context.delta,
          );
          modelRuntime.root.scale.x = MathUtils.damp(
            modelRuntime.root.scale.x,
            modelRuntime.baseScale.x,
            12,
            context.delta,
          );
          modelRuntime.root.scale.y = MathUtils.damp(
            modelRuntime.root.scale.y,
            modelRuntime.baseScale.y,
            12,
            context.delta,
          );
          modelRuntime.root.scale.z = MathUtils.damp(
            modelRuntime.root.scale.z,
            modelRuntime.baseScale.z,
            12,
            context.delta,
          );
          return;
        }

        const runBlend = MathUtils.clamp(context.horizontalSpeed / 6.6, 0, 1);
        const locomotionSway =
          Math.sin(context.elapsed * (state === 'run' ? 12.6 : 6.4)) *
          (state === 'run' ? 0.028 : 0.012);

        let targetYOffset = modelRuntime.baseOffsetY + locomotionSway * Math.max(0.2, runBlend);
        if (modelRuntime.autoFootCalibrationEnabled) {
          targetYOffset += modelRuntime.autoFootCalibrationOffsetY;
        }
        let targetScaleX = modelRuntime.baseScale.x;
        let targetScaleY = modelRuntime.baseScale.y;
        let targetScaleZ = modelRuntime.baseScale.z;
        let targetRoll = 0;
        let targetPitch = 0;

        if (state === 'jump') {
          targetYOffset += 0.045;
          targetScaleX *= 0.98;
          targetScaleY *= 1.06;
          targetScaleZ *= 0.98;
          targetPitch = -0.02;
        } else if (state === 'fall') {
          targetYOffset += 0.012;
          targetScaleX *= 1.02;
          targetScaleY *= 0.985;
          targetScaleZ *= 1.02;
          targetRoll = 0.06;
          targetPitch = 0.02;
        } else if (state === 'land') {
          targetYOffset -= 0.03;
          targetScaleX *= 1.06;
          targetScaleY *= 0.92;
          targetScaleZ *= 1.06;
          targetPitch = 0.05;
        } else if (state === 'run') {
          targetPitch = -0.04;
          targetRoll = Math.sin(context.elapsed * 12.6) * 0.03 * runBlend;
        }

        if (context.verticalSpeed > 0.22) {
          targetYOffset += 0.02;
        } else if (context.verticalSpeed < -2) {
          targetYOffset -= 0.01;
        }

        modelRuntime.root.position.y = MathUtils.damp(
          modelRuntime.root.position.y,
          targetYOffset,
          10,
          context.delta,
        );
        modelRuntime.root.rotation.z = MathUtils.damp(
          modelRuntime.root.rotation.z,
          targetRoll,
          10,
          context.delta,
        );
        modelRuntime.root.rotation.x = MathUtils.damp(
          modelRuntime.root.rotation.x,
          targetPitch,
          9,
          context.delta,
        );
        modelRuntime.root.scale.x = MathUtils.damp(
          modelRuntime.root.scale.x,
          targetScaleX,
          12,
          context.delta,
        );
        modelRuntime.root.scale.y = MathUtils.damp(
          modelRuntime.root.scale.y,
          targetScaleY,
          12,
          context.delta,
        );
        modelRuntime.root.scale.z = MathUtils.damp(
          modelRuntime.root.scale.z,
          targetScaleZ,
          12,
          context.delta,
        );
        return;
      }

      fallback.update(context, state);
    },
    dispose() {
      disposed = true;
      modelLoaderDisposable?.dispose();
      modelRuntime?.dispose();

      root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            material.dispose();
          });
        } else {
          mesh.material.dispose();
        }
      });
      disposeMaterials(fallback.materials);
    },
  };
}
