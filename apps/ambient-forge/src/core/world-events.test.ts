import { describe, expect, it } from 'vitest';
import {
  cancelWorldEventParticipation,
  chooseWorldEventBranch,
  createWorldEventSession,
  didWorldEventStageComplete,
  getCurrentWorldEvent,
  stepWorldEventSession,
  tryStartVehicleWorldEvent,
  tryStartWorldEvent,
  WORLD_EVENT_CATALOG,
} from './world-events';

const noWorkers = {
  assignedNpcWorking: false,
  assignedVehicleWorking: false,
  participantNearby: false,
};

describe('world events', () => {
  it('一个步骤只在首次进入完成或选择态时记为完成', () => {
    const initial = createWorldEventSession(23);
    const current = getCurrentWorldEvent(initial);
    expect(current).toBeTruthy();
    if (!current) return;
    const choosing = stepWorldEventSession(initial, current.automaticDuration, {
      assignedNpcWorking: true,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    const choosingEvent = getCurrentWorldEvent(choosing);

    expect(didWorldEventStageComplete(current, choosingEvent)).toBe(true);
    expect(didWorldEventStageComplete(choosingEvent, choosingEvent)).toBe(false);
  });

  const createEventFirst = (eventId: (typeof WORLD_EVENT_CATALOG)[number]['id']) => {
    for (let seed = 1; seed < 500; seed += 1) {
      const state = createWorldEventSession(seed);
      if (getCurrentWorldEvent(state)?.id === eventId) return state;
    }
    throw new Error(`未找到事件 ${eventId}`);
  };

  it('每局稳定选择三到五个不同事件，并立即激活第一个', () => {
    const first = createWorldEventSession(17);
    const repeated = createWorldEventSession(17);
    const eventIds = first.events.map((event) => event.id);

    expect(first.events.length).toBeGreaterThanOrEqual(3);
    expect(first.events.length).toBeLessThanOrEqual(5);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(first).toEqual(repeated);
    expect(getCurrentWorldEvent(first)?.phase).toBe('active');
  });

  it('五条事件链都提供两个会改变后续步骤的选择', () => {
    expect(WORLD_EVENT_CATALOG).toHaveLength(5);
    for (const event of WORLD_EVENT_CATALOG) {
      expect(event.branch?.options).toHaveLength(2);
      expect(
        event.branch?.options.every((option) => Object.keys(option.stageOverrides).length > 0),
      ).toBe(true);
    }
  });

  it('关键步骤完成后等待选择，并按玩家决定切换后续演员与地点', () => {
    const initial = createEventFirst('roadside-repair');
    const current = getCurrentWorldEvent(initial);
    expect(current?.stageId).toBe('breakdown-check');
    if (!current) return;
    const choosing = stepWorldEventSession(initial, current.automaticDuration, {
      assignedNpcWorking: true,
      assignedVehicleWorking: false,
      participantNearby: false,
    });

    expect(getCurrentWorldEvent(choosing)).toMatchObject({
      phase: 'choosing',
      branchPrompt: '这辆车怎么处理？',
    });
    expect(getCurrentWorldEvent(choosing)?.branchOptions).toHaveLength(2);

    const selected = chooseWorldEventBranch(choosing, 'roadside-fix');
    const advanced = stepWorldEventSession(selected, 0.1, noWorkers);
    expect(getCurrentWorldEvent(selected)).toMatchObject({
      phase: 'completed',
      branchId: 'roadside-fix',
      selectedBranchLabel: '就地维修',
    });
    expect(getCurrentWorldEvent(advanced)).toMatchObject({
      phase: 'active',
      stageIndex: 1,
      actor: 'resident',
      assignedResidentId: 'mechanic',
      assignedVehicleId: null,
      title: '就地修复传动轴',
      location: '港口支路',
    });
  });

  it('分支等待超时后采用默认方案并继续事件链', () => {
    const initial = createEventFirst('plaza-escort');
    const current = getCurrentWorldEvent(initial);
    expect(current).toBeTruthy();
    if (!current) return;
    const choosing = stepWorldEventSession(initial, current.automaticDuration, {
      assignedNpcWorking: true,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    const advanced = stepWorldEventSession(choosing, 6.1, noWorkers);

    expect(getCurrentWorldEvent(advanced)).toMatchObject({
      stageIndex: 1,
      phase: 'active',
      branchId: 'escort-taxi',
      actor: 'vehicle',
    });
  });

  it('只有靠近目标的受控居民能开始互动，留在现场后更快完成事件', () => {
    const initial = createWorldEventSession(23);
    const current = getCurrentWorldEvent(initial);
    expect(current).toBeTruthy();
    if (!current) return;

    const far = tryStartWorldEvent(initial, 'traveler', [99, 0.22, 99]);
    const started = tryStartWorldEvent(initial, 'traveler', current.position);
    const halfway = stepWorldEventSession(started, current.playerDuration * 0.5, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: true,
    });
    const paused = stepWorldEventSession(halfway, 1, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    const completed = stepWorldEventSession(paused, current.playerDuration, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: true,
    });

    expect(far).toEqual(initial);
    expect(getCurrentWorldEvent(started)).toMatchObject({
      phase: 'participating',
      participantId: 'traveler',
    });
    expect(getCurrentWorldEvent(halfway)?.progress).toBeCloseTo(0.5, 3);
    expect(getCurrentWorldEvent(paused)?.progress).toBeCloseTo(0.5, 3);
    expect(getCurrentWorldEvent(completed)).toMatchObject({
      phase: 'choosing',
      completedBy: 'player',
      progress: 1,
    });
  });

  it('玩家释放角色会退出互动，原职业居民随后可以继续处理事件', () => {
    const initial = createWorldEventSession(31);
    const current = getCurrentWorldEvent(initial);
    expect(current).toBeTruthy();
    if (!current) return;

    const started = tryStartWorldEvent(initial, 'courier', current.position);
    const canceled = cancelWorldEventParticipation(started, 'courier');
    const completed = stepWorldEventSession(canceled, current.automaticDuration, {
      assignedNpcWorking: true,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    const advanced = stepWorldEventSession(completed, completed.cooldownRemaining + 0.1, noWorkers);

    expect(getCurrentWorldEvent(canceled)).toMatchObject({
      phase: 'active',
      participantId: null,
    });
    expect(getCurrentWorldEvent(completed)?.completedBy).toBe('npc');
    expect(getCurrentWorldEvent(advanced)?.phase).toBe('active');
    expect(getCurrentWorldEvent(advanced)).toMatchObject({
      id: current.id,
      stageIndex: 1,
      progress: 0,
    });
  });

  it('完成当前步骤后推进同一事件链，最后一步完成后才累计整条事件', () => {
    let state = createWorldEventSession(17);
    const first = getCurrentWorldEvent(state);
    expect(first).toBeTruthy();
    if (!first) return;

    const firstCompleted = stepWorldEventSession(state, first.automaticDuration, {
      assignedNpcWorking: first.actor === 'resident',
      assignedVehicleWorking: first.actor === 'vehicle',
      participantNearby: false,
    });
    state = stepWorldEventSession(
      firstCompleted,
      firstCompleted.cooldownRemaining + 0.1,
      noWorkers,
    );
    expect(getCurrentWorldEvent(state)).toMatchObject({
      id: first.id,
      stageIndex: 1,
      completedStages: 1,
    });
    expect(state.completedTotal).toBe(0);

    while (getCurrentWorldEvent(state)?.id === first.id) {
      const current = getCurrentWorldEvent(state);
      if (!current) break;
      const completed = stepWorldEventSession(state, current.automaticDuration, {
        assignedNpcWorking: current.actor === 'resident',
        assignedVehicleWorking: current.actor === 'vehicle',
        participantNearby: false,
      });
      state = stepWorldEventSession(completed, completed.cooldownRemaining + 0.1, noWorkers);
    }

    expect(state.completedTotal).toBe(1);
    expect(state.completedStagesTotal).toBe(first.stageCount);
    expect(getCurrentWorldEvent(state)?.id).not.toBe(first.id);
  });

  it('车辆步骤允许驾驶中的玩家在目标点按 E 参与完成', () => {
    let state = createWorldEventSession(23);
    let current = getCurrentWorldEvent(state);
    for (let safety = 0; current?.actor !== 'vehicle' && safety < 12; safety += 1) {
      if (!current) break;
      const completed = stepWorldEventSession(state, current.automaticDuration, {
        assignedNpcWorking: true,
        assignedVehicleWorking: false,
        participantNearby: false,
      });
      state = stepWorldEventSession(completed, completed.cooldownRemaining + 0.1, noWorkers);
      current = getCurrentWorldEvent(state);
    }
    expect(current?.actor).toBe('vehicle');
    if (!current) return;

    expect(tryStartVehicleWorldEvent(state, 'copper', [99, 0.38, 99])).toBe(state);
    const started = tryStartVehicleWorldEvent(state, 'copper', current.position);
    const completed = stepWorldEventSession(started, current.playerDuration, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: true,
    });

    expect(getCurrentWorldEvent(started)).toMatchObject({
      phase: 'participating',
      vehicleParticipantId: 'copper',
    });
    expect(getCurrentWorldEvent(completed)).toMatchObject({
      phase: 'completed',
      completedBy: 'player',
    });
  });
});
