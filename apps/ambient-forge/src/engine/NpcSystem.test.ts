import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { createNpcSystem } from './NpcSystem';

describe('NpcSystem', () => {
  it('装配三名带职业细节的程序化居民', () => {
    const system = createNpcSystem(getQualityProfile('high'));

    expect(system.root.getObjectByName('npc-traveler')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-mechanic')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-gardener')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('traveler-backpack')).toBeTruthy();
    expect(system.root.getObjectByName('mechanic-goggles')).toBeTruthy();
    expect(system.root.getObjectByName('gardener-watering-can')).toBeTruthy();
    expect(system.root.getObjectByName('npc-high-detail')).toBeTruthy();
    expect(system.getSnapshots()).toHaveLength(3);

    system.dispose();
  });

  it('更新移动状态、提供镜头姿态并按质量档裁剪装饰细节', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 1, 0.5);
    const after = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const pose = system.getCameraPose('traveler', 'pov');

    expect(after?.position).not.toEqual(before?.position);
    expect(pose?.target[2]).not.toBe(pose?.position[2]);

    system.setQuality(getQualityProfile('low'));
    expect(system.root.getObjectByName('npc-high-detail')?.visible).toBe(false);
    system.setQuality(getQualityProfile('high'));
    expect(system.root.getObjectByName('npc-high-detail')?.visible).toBe(true);

    system.dispose();
  });
});
