import { AnimationClip, type KeyframeTrack, Quaternion } from 'three';

const DEFAULT_POSE_BLEND = 0.5;
const DEFAULT_DURATION_SCALE = 1.35;

export function getLocomotionVerticalMotionScale(action: 'walk' | 'run'): number {
  return action === 'run' ? 0.18 : 0.12;
}

export function getLocomotionVerticalRange(clip: Readonly<AnimationClip>): number {
  const track = clip.tracks.find(
    (candidate) => candidate.name.endsWith('HipsCtrl.position') && candidate.getValueSize() === 3,
  );
  if (!track) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let offset = 2; offset < track.values.length; offset += 3) {
    const value = track.values[offset];
    if (value === undefined) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  return Number.isFinite(minimum) && Number.isFinite(maximum) ? maximum - minimum : 0;
}

export function stabilizeLocomotionVerticalMotion(
  clip: Readonly<AnimationClip>,
  verticalMotionScale: number,
): AnimationClip {
  const stabilized = clip.clone();
  const scale = Math.max(0, Math.min(1, verticalMotionScale));
  for (const track of stabilized.tracks) {
    if (!track.name.endsWith('HipsCtrl.position') || track.getValueSize() !== 3) continue;
    let verticalCenter = 0;
    const keyframeCount = track.values.length / 3;
    for (let offset = 2; offset < track.values.length; offset += 3) {
      verticalCenter += track.values[offset] ?? 0;
    }
    verticalCenter /= Math.max(1, keyframeCount);
    for (let offset = 2; offset < track.values.length; offset += 3) {
      const value = track.values[offset] ?? verticalCenter;
      track.values[offset] = verticalCenter + (value - verticalCenter) * scale;
    }
  }
  return stabilized;
}

function getReferenceTrack(
  referenceClip: Readonly<AnimationClip>,
  sourceTrack: Readonly<KeyframeTrack>,
): KeyframeTrack | null {
  return referenceClip.tracks.find((track) => track.name === sourceTrack.name) ?? null;
}

function sampleTrack(
  track: Readonly<KeyframeTrack>,
  time: number,
  valueSize: number,
  isQuaternion: boolean,
  output: Float32Array,
): void {
  const lastIndex = Math.max(0, track.times.length - 1);
  let upperIndex = 0;
  while (upperIndex < lastIndex && (track.times[upperIndex] ?? 0) < time) upperIndex += 1;
  const lowerIndex = Math.max(0, upperIndex - 1);
  const lowerTime = track.times[lowerIndex] ?? 0;
  const upperTime = track.times[upperIndex] ?? lowerTime;
  const amount = upperTime > lowerTime ? (time - lowerTime) / (upperTime - lowerTime) : 0;
  const lowerOffset = lowerIndex * valueSize;
  const upperOffset = upperIndex * valueSize;
  if (isQuaternion) {
    const lower = new Quaternion().fromArray(track.values, lowerOffset);
    const upper = new Quaternion().fromArray(track.values, upperOffset);
    new Quaternion().slerpQuaternions(lower, upper, amount).toArray(output);
    return;
  }
  for (let component = 0; component < valueSize; component += 1) {
    const lower = track.values[lowerOffset + component] ?? 0;
    const upper = track.values[upperOffset + component] ?? lower;
    output[component] = lower + (upper - lower) * amount;
  }
}

function blendTrack(
  sourceTrack: Readonly<KeyframeTrack>,
  sourceDuration: number,
  referenceTrack: Readonly<KeyframeTrack>,
  referenceDuration: number,
  poseBlend: number,
  durationScale: number,
): KeyframeTrack {
  const blended = sourceTrack.clone();
  const valueSize = sourceTrack.getValueSize();
  const referenceValue = new Float32Array(valueSize);
  const referenceQuaternion = new Quaternion();
  const sourceQuaternion = new Quaternion();
  const outputQuaternion = new Quaternion();
  const isQuaternion = sourceTrack.name.endsWith('.quaternion') && valueSize === 4;

  for (let keyframe = 0; keyframe < sourceTrack.times.length; keyframe += 1) {
    const sourceTime = sourceTrack.times[keyframe] ?? 0;
    const normalizedTime = sourceDuration > 0 ? sourceTime / sourceDuration : 0;
    sampleTrack(
      referenceTrack,
      normalizedTime * referenceDuration,
      valueSize,
      isQuaternion,
      referenceValue,
    );
    const valueOffset = keyframe * valueSize;
    if (isQuaternion) {
      referenceQuaternion.fromArray(referenceValue);
      sourceQuaternion.fromArray(sourceTrack.values, valueOffset);
      outputQuaternion.slerpQuaternions(referenceQuaternion, sourceQuaternion, poseBlend);
      outputQuaternion.toArray(blended.values, valueOffset);
      continue;
    }
    for (let component = 0; component < valueSize; component += 1) {
      const sourceValue = sourceTrack.values[valueOffset + component] ?? 0;
      const reference = referenceValue[component] ?? sourceValue;
      blended.values[valueOffset + component] = reference + (sourceValue - reference) * poseBlend;
    }
  }
  for (let index = 0; index < blended.times.length; index += 1) {
    blended.times[index] = (sourceTrack.times[index] ?? 0) * durationScale;
  }
  return blended;
}

export function createWalkAnimationClip(
  runClip: Readonly<AnimationClip>,
  idleClip: Readonly<AnimationClip>,
  poseBlend = DEFAULT_POSE_BLEND,
  durationScale = DEFAULT_DURATION_SCALE,
): AnimationClip {
  const blend = Math.max(0, Math.min(1, poseBlend));
  const timeScale = Math.max(0.1, durationScale);
  const tracks = runClip.tracks.map((sourceTrack) => {
    const referenceTrack = getReferenceTrack(idleClip, sourceTrack);
    if (!referenceTrack || referenceTrack.getValueSize() !== sourceTrack.getValueSize()) {
      const cloned = sourceTrack.clone();
      for (let index = 0; index < cloned.times.length; index += 1) {
        cloned.times[index] = (sourceTrack.times[index] ?? 0) * timeScale;
      }
      return cloned;
    }
    return blendTrack(
      sourceTrack,
      runClip.duration,
      referenceTrack,
      idleClip.duration,
      blend,
      timeScale,
    );
  });
  return new AnimationClip('Root|Walk', runClip.duration * timeScale, tracks);
}
