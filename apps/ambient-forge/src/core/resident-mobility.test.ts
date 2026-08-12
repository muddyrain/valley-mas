import { describe, expect, it } from 'vitest';
import {
  createResidentMobilityState,
  type ResidentMobilityObservation,
  type ResidentTripPlan,
  stepResidentMobility,
} from './resident-mobility';

const plan: ResidentTripPlan = {
  id: 'courier-riverside-run',
  residentId: 'courier',
  vehicleId: 'copper',
  label: '前往河岸市场送件',
  vehicleTarget: [7.8, 0.38, 50.2],
  finalTarget: [8.1, 0.22, 42.5],
  dwellSeconds: 4,
};

const observation = (
  overrides: Partial<ResidentMobilityObservation> = {},
): ResidentMobilityObservation => ({
  vehicleAvailable: true,
  npcAtVehicle: false,
  vehicleAtDestination: false,
  vehicleParked: false,
  npcAtDestination: false,
  ...overrides,
});

describe('resident mobility', () => {
  it('按步行到车、上车、驾驶、泊车、下车和末段步行推进完整出行', () => {
    let state = createResidentMobilityState([plan], 0);

    let step = stepResidentMobility(state, observation(), 0.1);
    state = step.state;
    expect(state.phase).toBe('walking-to-vehicle');
    expect(step.effects).toEqual([
      { type: 'reserve-vehicle', plan },
      { type: 'walk-to-vehicle', plan },
    ]);

    step = stepResidentMobility(state, observation({ npcAtVehicle: true }), 0.1);
    state = step.state;
    expect(state.phase).toBe('entering');
    expect(step.effects).toEqual([{ type: 'enter-vehicle', plan }]);

    step = stepResidentMobility(state, observation(), 0.8);
    state = step.state;
    expect(state.phase).toBe('driving');
    expect(step.effects).toEqual([{ type: 'begin-drive', plan }]);

    step = stepResidentMobility(state, observation({ vehicleAtDestination: true }), 0.1);
    state = step.state;
    expect(state.phase).toBe('parking');
    expect(step.effects).toEqual([{ type: 'begin-parking', plan }]);

    step = stepResidentMobility(state, observation({ vehicleParked: true }), 0.1);
    state = step.state;
    expect(state.phase).toBe('exiting');
    expect(step.effects).toEqual([{ type: 'exit-vehicle', plan }]);

    step = stepResidentMobility(state, observation(), 0.7);
    state = step.state;
    expect(state.phase).toBe('walking-to-destination');
    expect(step.effects).toEqual([{ type: 'walk-to-destination', plan }]);

    step = stepResidentMobility(state, observation({ npcAtDestination: true }), 0.1);
    state = step.state;
    expect(state.phase).toBe('dwelling');
    expect(step.effects).toEqual([{ type: 'finish-trip', plan }]);
  });

  it('车辆被玩家占用时保持等待，不抢车也不跳转居民', () => {
    const state = createResidentMobilityState([plan], 0);
    const step = stepResidentMobility(state, observation({ vehicleAvailable: false }), 3);

    expect(step.state.phase).toBe('waiting');
    expect(step.effects).toHaveLength(0);
  });

  it('完成停留后轮换下一条出行计划', () => {
    const nextPlan: ResidentTripPlan = {
      ...plan,
      id: 'gardener-hillside-run',
      residentId: 'gardener',
      vehicleId: 'sage',
    };
    let state = createResidentMobilityState([plan, nextPlan], 0);
    state = {
      ...state,
      phase: 'dwelling',
      phaseSeconds: plan.dwellSeconds,
      activePlanIndex: 0,
    };

    const step = stepResidentMobility(state, observation(), 0.1);

    expect(step.state.phase).toBe('waiting');
    expect(step.state.activePlanIndex).toBe(1);
    expect(step.effects).toEqual([{ type: 'release-vehicle', plan }]);
  });
});
