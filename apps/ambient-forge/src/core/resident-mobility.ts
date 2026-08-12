import type { NpcId } from './npc';
import type { VehicleId } from './playable-world';

export type ResidentMobilityPhase =
  | 'waiting'
  | 'walking-to-vehicle'
  | 'entering'
  | 'driving'
  | 'parking'
  | 'exiting'
  | 'walking-to-destination'
  | 'dwelling';

export interface ResidentTripPlan {
  id: string;
  residentId: NpcId;
  vehicleId: VehicleId;
  label: string;
  vehicleTarget: readonly [number, number, number];
  finalTarget: readonly [number, number, number];
  dwellSeconds: number;
}

export interface ResidentMobilityState {
  plans: readonly ResidentTripPlan[];
  activePlanIndex: number;
  phase: ResidentMobilityPhase;
  phaseSeconds: number;
  startupDelay: number;
}

export interface ResidentMobilityObservation {
  vehicleAvailable: boolean;
  npcAtVehicle: boolean;
  vehicleAtDestination: boolean;
  vehicleParked: boolean;
  npcAtDestination: boolean;
}

export type ResidentMobilityEffect =
  | { type: 'reserve-vehicle'; plan: ResidentTripPlan }
  | { type: 'walk-to-vehicle'; plan: ResidentTripPlan }
  | { type: 'enter-vehicle'; plan: ResidentTripPlan }
  | { type: 'begin-drive'; plan: ResidentTripPlan }
  | { type: 'begin-parking'; plan: ResidentTripPlan }
  | { type: 'exit-vehicle'; plan: ResidentTripPlan }
  | { type: 'walk-to-destination'; plan: ResidentTripPlan }
  | { type: 'finish-trip'; plan: ResidentTripPlan }
  | { type: 'release-vehicle'; plan: ResidentTripPlan };

export interface ResidentMobilityStep {
  state: ResidentMobilityState;
  effects: readonly ResidentMobilityEffect[];
}

const ENTER_SECONDS = 0.72;
const EXIT_SECONDS = 0.62;

export const createResidentMobilityState = (
  plans: readonly ResidentTripPlan[],
  startupDelay = 8,
): ResidentMobilityState => ({
  plans: plans.map((plan) => ({
    ...plan,
    vehicleTarget: [...plan.vehicleTarget],
    finalTarget: [...plan.finalTarget],
  })),
  activePlanIndex: 0,
  phase: 'waiting',
  phaseSeconds: 0,
  startupDelay: Math.max(0, startupDelay),
});

export function stepResidentMobility(
  current: Readonly<ResidentMobilityState>,
  observation: Readonly<ResidentMobilityObservation>,
  delta: number,
): ResidentMobilityStep {
  const plan = current.plans[current.activePlanIndex];
  if (!plan) return { state: { ...current }, effects: [] };
  const phaseSeconds = current.phaseSeconds + Math.max(0, delta);
  const remain = (phase: ResidentMobilityPhase): ResidentMobilityStep => ({
    state: { ...current, phase, phaseSeconds },
    effects: [],
  });
  const transition = (
    phase: ResidentMobilityPhase,
    ...effects: ResidentMobilityEffect[]
  ): ResidentMobilityStep => ({
    state: { ...current, phase, phaseSeconds: 0 },
    effects,
  });

  if (current.phase === 'waiting') {
    if (phaseSeconds < current.startupDelay || !observation.vehicleAvailable) {
      return remain('waiting');
    }
    return transition(
      'walking-to-vehicle',
      { type: 'reserve-vehicle', plan },
      { type: 'walk-to-vehicle', plan },
    );
  }
  if (current.phase === 'walking-to-vehicle') {
    return observation.npcAtVehicle
      ? transition('entering', { type: 'enter-vehicle', plan })
      : remain('walking-to-vehicle');
  }
  if (current.phase === 'entering') {
    return phaseSeconds >= ENTER_SECONDS
      ? transition('driving', { type: 'begin-drive', plan })
      : remain('entering');
  }
  if (current.phase === 'driving') {
    return observation.vehicleAtDestination
      ? transition('parking', { type: 'begin-parking', plan })
      : remain('driving');
  }
  if (current.phase === 'parking') {
    return observation.vehicleParked
      ? transition('exiting', { type: 'exit-vehicle', plan })
      : remain('parking');
  }
  if (current.phase === 'exiting') {
    return phaseSeconds >= EXIT_SECONDS
      ? transition('walking-to-destination', { type: 'walk-to-destination', plan })
      : remain('exiting');
  }
  if (current.phase === 'walking-to-destination') {
    return observation.npcAtDestination
      ? transition('dwelling', { type: 'finish-trip', plan })
      : remain('walking-to-destination');
  }
  if (phaseSeconds < plan.dwellSeconds) return remain('dwelling');
  return {
    state: {
      ...current,
      activePlanIndex: (current.activePlanIndex + 1) % current.plans.length,
      phase: 'waiting',
      phaseSeconds: 0,
      startupDelay: 5,
    },
    effects: [{ type: 'release-vehicle', plan }],
  };
}
