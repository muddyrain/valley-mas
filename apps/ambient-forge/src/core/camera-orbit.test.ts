import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA_ORBIT,
  MAX_CAMERA_DISTANCE,
  MAX_CAMERA_POLAR,
  MIN_CAMERA_DISTANCE,
  MIN_CAMERA_POLAR,
  orbitCameraPosition,
  rotateCameraOrbit,
  stepAnchoredChasePose,
  stepChaseOrbitAngle,
  zoomCameraOrbit,
} from './camera-orbit';

describe('camera orbit', () => {
  it('按常规轨道方向水平环绕、垂直跟手并限制俯仰边界', () => {
    const movedRight = rotateCameraOrbit(DEFAULT_CAMERA_ORBIT, 180, 0);
    const movedUp = rotateCameraOrbit(DEFAULT_CAMERA_ORBIT, 0, -90);
    const highView = rotateCameraOrbit(DEFAULT_CAMERA_ORBIT, 0, 100_000);
    const lowView = rotateCameraOrbit(DEFAULT_CAMERA_ORBIT, 0, -100_000);

    expect(movedRight.azimuth).toBeLessThan(DEFAULT_CAMERA_ORBIT.azimuth);
    expect(movedUp.polar).toBeGreaterThan(DEFAULT_CAMERA_ORBIT.polar);
    expect(highView.polar).toBe(MIN_CAMERA_POLAR);
    expect(lowView.polar).toBe(MAX_CAMERA_POLAR);
  });

  it('滚轮缩放不会穿进场景或无限拉远', () => {
    const nearest = zoomCameraOrbit(DEFAULT_CAMERA_ORBIT, -100_000);
    const farthest = zoomCameraOrbit(DEFAULT_CAMERA_ORBIT, 100_000);

    expect(nearest.distance).toBe(MIN_CAMERA_DISTANCE);
    expect(farthest.distance).toBe(MAX_CAMERA_DISTANCE);
  });

  it('默认距离和最远缩放能容纳扩展后的浮空群岛', () => {
    expect(DEFAULT_CAMERA_ORBIT.distance).toBeGreaterThan(65);
    expect(MAX_CAMERA_DISTANCE).toBe(84);
  });

  it('根据轨道状态生成与目标点保持指定距离的相机坐标', () => {
    const position = orbitCameraPosition(DEFAULT_CAMERA_ORBIT, [0, -0.7, 0]);
    const distance = Math.hypot(position[0], position[1] + 0.7, position[2]);

    expect(distance).toBeCloseTo(DEFAULT_CAMERA_ORBIT.distance, 5);
    expect(position[0]).toBeGreaterThan(0);
    expect(position[2]).toBeGreaterThan(0);
  });

  it('跟随角色平移时立即同步目标锚点，不在角色停步后继续向前追赶', () => {
    const next = stepAnchoredChasePose(
      { position: [0, 3, -6], target: [0, 1, 0] },
      { position: [4, 3, -6], target: [4, 1, 0] },
      0.2,
    );

    expect(next.target).toEqual([4, 1, 0]);
    expect(next.position).toEqual([4, 3, -6]);
  });

  it('角色只改变视角时保留相机旋转缓冲，不把朝向变化误当成位置跳转', () => {
    const next = stepAnchoredChasePose(
      { position: [0, 3, -6], target: [0, 1, 0] },
      { position: [-6, 3, 0], target: [2, 1, 0] },
      0.2,
      [0, 0, 0],
    );

    expect(next.target[0]).toBeGreaterThan(0);
    expect(next.target[0]).toBeLessThan(1);
    expect(next.position[0]).toBeGreaterThan(-2);
  });

  it('左右拖动先缓冲到目标偏航角，不会一帧跳转或越过目标', () => {
    const first = stepChaseOrbitAngle(0, 1, 1 / 60, 11);
    let settled = first;
    for (let frame = 0; frame < 90; frame += 1) {
      settled = stepChaseOrbitAngle(settled, 1, 1 / 60, 11);
    }

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.25);
    expect(settled).toBeCloseTo(1, 3);
    expect(settled).toBeLessThanOrEqual(1);
  });
});
