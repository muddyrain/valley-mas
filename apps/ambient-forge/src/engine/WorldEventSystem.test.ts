import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { createWorldEventSystem } from './WorldEventSystem';

describe('WorldEventSystem', () => {
  it('为本局事件创建场景道具和当前事件信标', () => {
    const system = createWorldEventSystem(17);
    const snapshot = system.getSnapshot();
    const current = snapshot.current;

    expect(system.root).toBeInstanceOf(Group);
    expect(system.root.children).toHaveLength(snapshot.sessionSize);
    expect(current).toBeTruthy();
    expect(system.root.getObjectByName(`world-event-${current?.id}`)?.visible).toBe(true);
    expect(system.root.getObjectByName(`${current?.id}-${current?.stageId}-beacon`)?.visible).toBe(
      true,
    );

    system.dispose();
  });

  it('靠近事件后开始参与，并按现场停留时间推进进度', () => {
    const system = createWorldEventSystem(23);
    const current = system.getSnapshot().current;
    expect(current).toBeTruthy();
    if (!current) return;

    expect(system.tryInteract('traveler', [90, 0.22, 90])).toBe(false);
    expect(system.tryInteract('traveler', current.position)).toBe(true);
    system.update(1, current.playerDuration * 0.5, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: true,
    });

    expect(system.getSnapshot().current).toMatchObject({
      phase: 'participating',
      participantId: 'traveler',
      progress: 0.5,
    });

    system.dispose();
  });

  it('完成一个步骤后保留结果道具，并把信标推进到同一事件链的下一步', () => {
    const system = createWorldEventSystem(17);
    const first = system.getSnapshot().current;
    expect(first).toBeTruthy();
    if (!first) return;

    system.update(1, first.automaticDuration, {
      assignedNpcWorking: first.actor === 'resident',
      assignedVehicleWorking: first.actor === 'vehicle',
      participantNearby: false,
    });
    const choosing = system.getSnapshot().current;
    system.update(2, (choosing?.branchSecondsRemaining ?? 2.9) + 0.1, {
      assignedNpcWorking: false,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    const next = system.getSnapshot().current;

    expect(next).toMatchObject({ id: first.id, stageIndex: 1 });
    expect(system.root.getObjectByName(`${first.id}-${first.stageId}-outcome`)?.visible).toBe(true);
    expect(system.root.getObjectByName(`${first.id}-${next?.stageId}-beacon`)?.visible).toBe(true);

    system.dispose();
  });

  it('分支阶段显示选择标记并把选择结果暴露到场景节点', () => {
    let system = createWorldEventSystem(1);
    for (let seed = 1; system.getSnapshot().current?.id !== 'roadside-repair'; seed += 1) {
      system.dispose();
      system = createWorldEventSystem(seed + 1);
    }
    const current = system.getSnapshot().current;
    expect(current).toBeTruthy();
    if (!current) return;

    system.update(1, current.automaticDuration, {
      assignedNpcWorking: true,
      assignedVehicleWorking: false,
      participantNearby: false,
    });
    expect(system.getSnapshot().current?.phase).toBe('choosing');
    expect(
      system.root.getObjectByName(`${current.id}-${current.stageId}-branch-choice`)?.visible,
    ).toBe(true);

    expect(system.chooseBranch('roadside-fix')).toBe(true);
    expect(system.root.getObjectByName(`world-event-${current.id}`)?.userData.branchId).toBe(
      'roadside-fix',
    );

    system.dispose();
  });
});
