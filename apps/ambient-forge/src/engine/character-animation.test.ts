import { AnimationClip, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createWalkAnimationClip,
  getLocomotionVerticalMotionScale,
  getLocomotionVerticalRange,
  stabilizeLocomotionVerticalMotion,
} from './character-animation';

describe('character animation clip polish', () => {
  it('从奔跑和待机姿势合成更收敛的步行循环，不直接复制奔跑幅度', () => {
    const idle = new AnimationClip('Idle', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 0, 1, 0]),
      new QuaternionKeyframeTrack('LeftUpLeg.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    const runQuarterTurn = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const run = new AnimationClip('Run', 2 / 3, [
      new VectorKeyframeTrack('Hips.position', [0, 2 / 3], [0.4, 0.65, 0.3, -0.4, 0.7, -0.3]),
      new QuaternionKeyframeTrack(
        'LeftUpLeg.quaternion',
        [0, 2 / 3],
        [
          runQuarterTurn.x,
          runQuarterTurn.y,
          runQuarterTurn.z,
          runQuarterTurn.w,
          -runQuarterTurn.x,
          runQuarterTurn.y,
          runQuarterTurn.z,
          runQuarterTurn.w,
        ],
      ),
    ]);

    const walk = createWalkAnimationClip(run, idle);
    const hips = walk.tracks.find((track) => track.name === 'Hips.position');
    const leg = walk.tracks.find((track) => track.name === 'LeftUpLeg.quaternion');

    expect(walk.name).toBe('Root|Walk');
    expect(walk.duration).toBeCloseTo(0.9, 2);
    expect(Array.from(hips?.values ?? [])).toHaveLength(6);
    [0.2, 0.825, 0.15, -0.2, 0.85, -0.15].forEach((value, index) => {
      expect(hips?.values[index]).toBeCloseTo(value, 4);
    });
    const walkLeg = new Quaternion().fromArray(leg?.values ?? [], 0);
    expect(new Quaternion().angleTo(walkLeg)).toBeCloseTo(Math.PI / 4, 2);
    [0.4, 0.65, 0.3].forEach((value, index) => {
      expect(run.tracks[0]?.values[index]).toBeCloseTo(value, 4);
    });
  });

  it('压缩髋部控制器的垂直颠簸，同时保留水平位移和原始动画资源', () => {
    const source = new AnimationClip('Root|Run', 0.8, [
      new VectorKeyframeTrack(
        'HipsCtrl.position',
        [0, 0.4, 0.8],
        [0.1, 0.2, 1.4, 0.2, 0.2, 1.5, 0.3, 0.2, 1.4],
      ),
      new VectorKeyframeTrack('Root.position', [0, 0.8], [0, 0, 0, 0, 0, 0]),
    ]);

    const stabilized = stabilizeLocomotionVerticalMotion(source, 0.4);
    const hips = stabilized.tracks.find((track) => track.name === 'HipsCtrl.position');

    expect(hips?.values[0]).toBeCloseTo(0.1, 5);
    expect(hips?.values[3]).toBeCloseTo(0.2, 5);
    expect(hips?.values[6]).toBeCloseTo(0.3, 5);
    const verticalValues = [hips?.values[2] ?? 0, hips?.values[5] ?? 0, hips?.values[8] ?? 0];
    expect(Math.max(...verticalValues) - Math.min(...verticalValues)).toBeCloseTo(0.04, 4);
    expect(hips?.values[2]).toBeCloseTo(1.42, 3);
    expect(hips?.values[5]).toBeCloseTo(1.46, 3);
    expect(source.tracks[0]?.values[5]).toBeCloseTo(1.5, 5);
    expect(getLocomotionVerticalRange(source)).toBeCloseTo(0.1, 4);
    expect(getLocomotionVerticalRange(stabilized)).toBeCloseTo(0.04, 4);
  });

  it('近景跑步只保留轻微重心起伏，步行幅度不高于跑步', () => {
    const runScale = getLocomotionVerticalMotionScale('run');
    const walkScale = getLocomotionVerticalMotionScale('walk');

    expect(runScale).toBeGreaterThan(0.08);
    expect(runScale).toBeLessThanOrEqual(0.22);
    expect(walkScale).toBeGreaterThan(0.05);
    expect(walkScale).toBeLessThanOrEqual(runScale);
  });
});
