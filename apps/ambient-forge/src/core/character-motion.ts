import { clamp } from './ambient-inputs';

export type PlanarVelocity = readonly [number, number];
export type VehicleTransitionPhase = 'entering' | 'exiting';

export interface VehicleTransitionPose {
  travelProgress: number;
  crouch: number;
}

export type LocomotionAnimationAction = 'idle' | 'walk' | 'run' | 'jump';
export type LocomotionLean = readonly [forwardLean: number, turnLean: number];
export type ControlledLocomotionMotion = 'idle' | 'walk' | 'run';

export interface InertialHeadingState {
  heading: number;
  angularVelocity: number;
}

export function getControlledLocomotionMotion(
  previousMotion: string,
  moved: boolean,
  sprint: boolean,
  speed: number,
): ControlledLocomotionMotion {
  if (!moved) return 'idle';
  if (previousMotion === 'run' && speed > 3) return 'run';
  if (sprint && speed > 3.35) return 'run';
  return 'walk';
}

export function getLocomotionAnimationAction(
  motion: string,
  speed: number,
): LocomotionAnimationAction {
  if (motion === 'jump' || motion === 'vault') return 'jump';
  if (motion === 'entering' || motion === 'exiting') return 'walk';
  if (motion === 'run') return 'run';
  if (motion === 'walk') return 'walk';
  if (speed >= 3.15) return 'run';
  if (speed >= 0.12) return 'walk';
  return 'idle';
}

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export function getVehicleTransitionPose(
  phase: VehicleTransitionPhase,
  progress: number,
): VehicleTransitionPose {
  const normalized = clamp(progress, 0, 1);
  if (phase === 'entering') {
    return {
      travelProgress: smoothstep(clamp(normalized / 0.7, 0, 1)),
      crouch: smoothstep(clamp((normalized - 0.58) / 0.42, 0, 1)),
    };
  }
  return {
    travelProgress: smoothstep(clamp((normalized - 0.22) / 0.78, 0, 1)),
    crouch: 1 - smoothstep(clamp(normalized / 0.42, 0, 1)),
  };
}

export function stepPlanarVelocity(
  current: PlanarVelocity,
  target: PlanarVelocity,
  deltaSeconds: number,
  acceleration = 12,
  deceleration = 8,
): [number, number] {
  const deltaX = target[0] - current[0];
  const deltaZ = target[1] - current[1];
  const difference = Math.hypot(deltaX, deltaZ);
  if (difference <= 0.0001 || deltaSeconds <= 0) return [target[0], target[1]];
  const currentSpeed = Math.hypot(current[0], current[1]);
  const targetSpeed = Math.hypot(target[0], target[1]);
  const rate = targetSpeed > currentSpeed ? acceleration : deceleration;
  const step = Math.min(difference, Math.max(0, rate) * Math.max(0, deltaSeconds));
  return [current[0] + (deltaX / difference) * step, current[1] + (deltaZ / difference) * step];
}

export function stepSmoothedHeading(
  current: number,
  target: number,
  deltaSeconds: number,
  turnRate = 4.8,
): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const step = Math.max(
    -turnRate * Math.max(0, deltaSeconds),
    Math.min(turnRate * Math.max(0, deltaSeconds), difference),
  );
  return current + step;
}

export function stepInertialHeading(
  current: Readonly<InertialHeadingState>,
  target: number,
  deltaSeconds: number,
  maxTurnRate = 4.4,
  turnAcceleration = 14,
  response = 5.2,
): InertialHeadingState {
  const delta = clamp(deltaSeconds, 0, 0.1);
  if (delta <= 0) return { ...current };
  const difference = Math.atan2(
    Math.sin(target - current.heading),
    Math.cos(target - current.heading),
  );
  if (Math.abs(difference) <= 0.0001 && Math.abs(current.angularVelocity) <= 0.004) {
    return {
      heading: current.heading + difference,
      angularVelocity: 0,
    };
  }

  const direction = Math.sign(difference);
  const brakingRate = Math.sqrt(
    Math.max(0, 2 * Math.max(0, turnAcceleration) * Math.abs(difference)),
  );
  const desiredRate =
    direction *
    Math.min(Math.max(0, maxTurnRate), brakingRate, Math.abs(difference) * Math.max(0, response));
  const velocityDifference = desiredRate - current.angularVelocity;
  const velocityStep = Math.max(
    -Math.max(0, turnAcceleration) * delta,
    Math.min(Math.max(0, turnAcceleration) * delta, velocityDifference),
  );
  const angularVelocity = current.angularVelocity + velocityStep;
  const headingStep = angularVelocity * delta;
  if (Math.sign(headingStep) === direction && Math.abs(headingStep) >= Math.abs(difference)) {
    return {
      heading: current.heading + difference,
      angularVelocity: 0,
    };
  }
  return {
    heading: current.heading + headingStep,
    angularVelocity,
  };
}

export function getLocomotionLeanTarget(
  action: LocomotionAnimationAction,
  speed: number,
  headingDelta: number,
): [number, number] {
  if (action !== 'walk' && action !== 'run') return [0, 0];
  const run = action === 'run';
  const speedRatio = clamp(Math.max(0, speed) / (run ? 5.4 : 3.05), 0, 1);
  const forwardLean = (run ? 0.082 : 0.025) * speedRatio;
  const turnRatio = clamp(headingDelta / (Math.PI / 2), -1, 1);
  const turnLean = turnRatio * (run ? 0.065 : 0.035) * speedRatio;
  return [forwardLean, turnLean];
}

export function stepLocomotionLean(
  current: LocomotionLean,
  target: LocomotionLean,
  deltaSeconds: number,
  response = 7.5,
): [number, number] {
  const blend = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds));
  return [
    current[0] + (target[0] - current[0]) * blend,
    current[1] + (target[1] - current[1]) * blend,
  ];
}

export function getMotionPlaybackRate(speed: number): number {
  return clamp(0.55 + (Math.max(0, speed) / 5.4) * 0.73, 0.55, 1.28);
}

export function getWalkPlaybackRate(speed: number): number {
  return clamp(0.72 + (Math.max(0, speed) / 3.05) * 0.4, 0.72, 1.12);
}

export function getCharacterRootBobScale(
  usesExternalAnimation: boolean,
  stableContact: boolean,
): number {
  if (usesExternalAnimation) return 0;
  return stableContact ? 0.12 : 1;
}

export function getLocomotionTransitionEntryTime(
  previousAction: LocomotionAnimationAction | null,
  nextAction: LocomotionAnimationAction,
  previousTime: number,
  previousDuration: number,
  nextDuration: number,
  gaitPhase?: number,
): number {
  const carriesGaitPhase =
    (previousAction === 'walk' || previousAction === 'run') &&
    (nextAction === 'walk' || nextAction === 'run') &&
    previousDuration > 0 &&
    nextDuration > 0;
  if (carriesGaitPhase) {
    const wrappedTime = ((previousTime % previousDuration) + previousDuration) % previousDuration;
    return (wrappedTime / previousDuration) * nextDuration;
  }
  if (nextAction === 'walk' || nextAction === 'run') {
    if (gaitPhase !== undefined && Number.isFinite(gaitPhase) && nextDuration > 0) {
      const normalizedPhase = (((gaitPhase / (Math.PI * 2)) % 1) + 1) % 1;
      return normalizedPhase * nextDuration;
    }
    return Math.min(0.16, nextDuration * 0.18);
  }
  if (nextAction === 'jump') return Math.min(0.08, nextDuration * 0.18);
  return 0;
}

export function selectNamedAnimationClip<T extends { name: string }>(
  clips: readonly T[],
  actionName: string,
): T | null {
  const normalizedAction = actionName.trim().toLowerCase();
  const named = clips.find((clip) => {
    const normalizedName = clip.name.trim().toLowerCase();
    return (
      !normalizedName.includes('targeting pose') &&
      (normalizedName === normalizedAction || normalizedName.endsWith(`|${normalizedAction}`))
    );
  });
  return named ?? clips.find((clip) => !clip.name.toLowerCase().includes('targeting pose')) ?? null;
}
