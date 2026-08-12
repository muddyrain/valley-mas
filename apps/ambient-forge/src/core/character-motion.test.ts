import { describe, expect, it } from 'vitest';
import {
  getCharacterRootBobScale,
  getControlledLocomotionMotion,
  getLocomotionAnimationAction,
  getLocomotionLeanTarget,
  getLocomotionTransitionEntryTime,
  getMotionPlaybackRate,
  getVehicleTransitionPose,
  getWalkPlaybackRate,
  selectNamedAnimationClip,
  stepInertialHeading,
  stepLocomotionLean,
  stepPlanarVelocity,
  stepSmoothedHeading,
} from './character-motion';

describe('character motion polish', () => {
  it('起步和停步都经过速度缓冲而不是瞬间跳变', () => {
    const started = stepPlanarVelocity([0, 0], [0, 5], 0.1);
    const stopping = stepPlanarVelocity(started, [0, 0], 0.1);

    expect(started[1]).toBeGreaterThan(0);
    expect(started[1]).toBeLessThan(5);
    expect(stopping[1]).toBeGreaterThan(0);
    expect(stopping[1]).toBeLessThan(started[1]);
  });

  it('急转弯时保留连续速度方向，避免角色瞬间反折', () => {
    const turned = stepPlanarVelocity([0, 3], [3, 0], 0.08);

    expect(turned[0]).toBeGreaterThan(0);
    expect(turned[1]).toBeGreaterThan(0);
  });

  it('朝向跨越正负 PI 时选择最短旋转路径', () => {
    const heading = stepSmoothedHeading(Math.PI - 0.04, -Math.PI + 0.04, 0.1);

    expect(Math.abs(heading - (Math.PI + 0.04))).toBeLessThan(0.02);
  });

  it('视觉转向会先加速再减速，不会以固定角速度突然起停', () => {
    const first = stepInertialHeading({ heading: 0, angularVelocity: 0 }, Math.PI / 2, 0.05);
    const second = stepInertialHeading(first, Math.PI / 2, 0.05);

    expect(first.heading).toBeGreaterThan(0);
    expect(first.heading).toBeLessThan(0.08);
    expect(first.angularVelocity).toBeGreaterThan(0);
    expect(second.angularVelocity).toBeGreaterThan(first.angularVelocity);

    let state = second;
    for (let frame = 0; frame < 120; frame += 1) {
      state = stepInertialHeading(state, Math.PI / 2, 1 / 60);
    }
    expect(state.heading).toBeCloseTo(Math.PI / 2, 2);
    expect(Math.abs(state.angularVelocity)).toBeLessThan(0.03);
  });

  it('惯性转向跨越正负 PI 时仍走最短方向且不会绕场一周', () => {
    const current = Math.PI - 0.04;
    const turned = stepInertialHeading(
      { heading: current, angularVelocity: 0 },
      -Math.PI + 0.04,
      0.1,
    );

    expect(turned.heading).toBeGreaterThan(current);
    expect(turned.heading - current).toBeLessThan(0.12);
    expect(turned.angularVelocity).toBeGreaterThan(0);
  });

  it('步频随实际位移速度变化并保持可用范围', () => {
    expect(getMotionPlaybackRate(0)).toBe(0.55);
    expect(getMotionPlaybackRate(1.4)).toBeGreaterThan(0.65);
    expect(getMotionPlaybackRate(5.4)).toBeLessThanOrEqual(1.28);
  });

  it('步行动画使用独立步频，低速时不会把奔跑循环拖成慢动作', () => {
    expect(getWalkPlaybackRate(0)).toBe(0.72);
    expect(getWalkPlaybackRate(1.4)).toBeGreaterThan(0.85);
    expect(getWalkPlaybackRate(3.05)).toBe(1.12);
  });

  it('骨骼动画启用时不再叠加程序化上下弹跳，避免跑步时重复颠簸', () => {
    expect(getCharacterRootBobScale(true, false)).toBe(0);
    expect(getCharacterRootBobScale(false, false)).toBe(1);
    expect(getCharacterRootBobScale(false, true)).toBe(0.12);
  });

  it('奔跑会比步行产生更明显的前倾，但站立不会残留姿态', () => {
    const idle = getLocomotionLeanTarget('idle', 0, 0);
    const walk = getLocomotionLeanTarget('walk', 2.2, 0);
    const run = getLocomotionLeanTarget('run', 5.1, 0);

    expect(idle).toEqual([0, 0]);
    expect(walk[0]).toBeGreaterThan(0);
    expect(run[0]).toBeGreaterThan(walk[0] * 2);
    expect(run[0]).toBeLessThan(0.1);
  });

  it('急转时身体向左右两侧反向倾斜，并限制最大幅度', () => {
    const left = getLocomotionLeanTarget('run', 5.1, -Math.PI / 2);
    const right = getLocomotionLeanTarget('run', 5.1, Math.PI / 2);

    expect(left[1]).toBeLessThan(0);
    expect(right[1]).toBeGreaterThan(0);
    expect(Math.abs(left[1])).toBeLessThanOrEqual(0.07);
    expect(Math.abs(right[1])).toBeLessThanOrEqual(0.07);
  });

  it('转弯侧倾和停步回正都有惯性，不会在单帧内跳变', () => {
    const entering = stepLocomotionLean([0, 0], [0.08, 0.06], 0.05);
    const recovering = stepLocomotionLean(entering, [0, 0], 0.05);

    expect(entering[0]).toBeGreaterThan(0);
    expect(entering[0]).toBeLessThan(0.08);
    expect(entering[1]).toBeGreaterThan(0);
    expect(entering[1]).toBeLessThan(0.06);
    expect(recovering[0]).toBeGreaterThan(0);
    expect(recovering[0]).toBeLessThan(entering[0]);
    expect(recovering[1]).toBeGreaterThan(0);
    expect(recovering[1]).toBeLessThan(entering[1]);
  });

  it('步行与奔跑互相切换时继承脚步相位，避免每次切换都从同一只脚重启', () => {
    expect(getLocomotionTransitionEntryTime('walk', 'run', 0.45, 0.9, 0.66)).toBeCloseTo(0.33, 2);
    expect(getLocomotionTransitionEntryTime('run', 'walk', 0.33, 0.66, 0.9)).toBeCloseTo(0.45, 2);
    expect(getLocomotionTransitionEntryTime('idle', 'walk', 0.8, 1.1, 0.9)).toBe(0.16);
    expect(getLocomotionTransitionEntryTime('idle', 'walk', 0.8, 1.1, 0.9, Math.PI)).toBeCloseTo(
      0.45,
      3,
    );
    expect(
      getLocomotionTransitionEntryTime('idle', 'run', 0.8, 1.1, 0.66, Math.PI * 3),
    ).toBeCloseTo(0.33, 3);
  });

  it('按实际速度区分站立、步行、奔跑和腾空动作', () => {
    expect(getLocomotionAnimationAction('idle', 0.03)).toBe('idle');
    expect(getLocomotionAnimationAction('walk', 1.4)).toBe('walk');
    expect(getLocomotionAnimationAction('walk', 4.8)).toBe('walk');
    expect(getLocomotionAnimationAction('run', 4.2)).toBe('run');
    expect(getLocomotionAnimationAction('jump', 2.2)).toBe('jump');
    expect(getLocomotionAnimationAction('entering', 0.8)).toBe('walk');
  });

  it('松开加速键后保持奔跑到速度真正降下来，避免高速瞬切步行', () => {
    expect(getControlledLocomotionMotion('run', true, false, 4.6)).toBe('run');
    expect(getControlledLocomotionMotion('run', true, false, 2.8)).toBe('walk');
    expect(getControlledLocomotionMotion('walk', true, true, 3.2)).toBe('walk');
    expect(getControlledLocomotionMotion('walk', true, true, 3.5)).toBe('run');
    expect(getControlledLocomotionMotion('run', false, false, 0)).toBe('idle');
  });

  it('按动作名选择动画，不把资源中的瞄准姿势误当成跑步', () => {
    const clips = [
      { name: 'Root|0.Targeting Pose', duration: 0.04 },
      { name: 'Root|Run', duration: 0.67 },
    ];

    expect(selectNamedAnimationClip(clips, 'run')).toBe(clips[1]);
  });

  it('上车时先走到驾驶门再原地俯身，不在座位内继续平移', () => {
    const approach = getVehicleTransitionPose('entering', 0.45);
    const seated = getVehicleTransitionPose('entering', 0.82);
    const exiting = getVehicleTransitionPose('exiting', 0.1);

    expect(approach.travelProgress).toBeGreaterThan(0);
    expect(approach.travelProgress).toBeLessThan(1);
    expect(seated.travelProgress).toBe(1);
    expect(seated.crouch).toBeGreaterThan(0.35);
    expect(exiting.crouch).toBeGreaterThan(0.5);
    expect(exiting.travelProgress).toBe(0);
  });
});
