/**
 * PlayerController.ts
 * 玩家状态机 + 物理移动控制器。
 *
 * 职责边界：
 *  - 维护 position / velocity
 *  - 处理输入 → 目标速度 → 阻尼平滑
 *  - 重力积分
 *  - 跳跃（含防二段跳）
 *  - 状态机：idle / run / jump / fall / grounded
 *  - 坠落重生
 *  - 暴露 getDebugSnapshot() 供 Debug UI 使用
 *
 * 碰撞解算不在此模块内，由外部（createClimberPrototype.ts）提供 resolveCollisions 回调注入。
 */

import { MathUtils, Vector3 } from 'three';
import { PLAYER_PHYSICS } from './PlayerPhysics';

// ─── 公共类型 ────────────────────────────────────────────────────────────────

/** 玩家逻辑状态（状态机节点） */
export type PlayerState = 'idle' | 'run' | 'jump' | 'fall';

/**
 * 动画映射规则（与角色 rig 解耦）：
 *   idle  → 'idle'  动画
 *   run   → 'run'   动画
 *   jump  → 'jump'  动画
 *   fall  → 'jump'  动画（fallback，禁止使用 fall/ragdoll 动画）
 */
export const PLAYER_STATE_TO_ANIMATION: Record<PlayerState, 'idle' | 'run' | 'jump'> = {
  idle: 'idle',
  run: 'run',
  jump: 'jump',
  fall: 'jump', // 下落复用 jump 动画
};

/** 当前帧输入快照（由调用方逐帧提供） */
export interface PlayerInputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  /** 本帧是否触发跳跃意图（仅有效一帧，读后应清除） */
  jumpQueued: boolean;
}

/** createClimberPrototype 注入的碰撞解算函数签名 */
export type ResolveCollisionsFn = (
  playerPosition: Vector3,
  velocity: Vector3,
  wasGrounded: boolean,
) => boolean;

/** Debug 快照结构 */
export interface PlayerDebugSnapshot {
  height: number;
  grounded: boolean;
  speedXZ: number;
  velocityY: number;
  state: PlayerState;
  currentPlatformId: string | null;
}

// ─── 内部常量 ────────────────────────────────────────────────────────────────

const MIN_JUMP_INTERVAL_MS = 220;
const MIN_GROUNDED_BEFORE_JUMP_MS = 45;

// ─── PlayerController 类 ─────────────────────────────────────────────────────

export class PlayerController {
  /** 玩家球心世界坐标（直接供外部读取，不要直接写入） */
  readonly position: Vector3;
  /** 玩家速度向量 (m/s) */
  readonly velocity: Vector3;

  private _grounded = false;
  private _state: PlayerState = 'idle';
  private _elapsedMs = 0;
  private _lastJumpAtMs = -10_000;
  private _lastGroundedAtMs = -10_000;
  /** 冰面模式：制动力大幅降低 */
  private _icy = false;
  /** 粘性模式：移动和起跳被软垫拖慢 */
  private _sticky = false;

  /** 由外部（碰撞系统）写入当前站立平台 ID，供 Debug UI 读取 */
  currentPlatformId: string | null = null;

  private readonly _startPosition: Vector3;
  private readonly _respawnY: number;

  constructor(options: { startPosition: Vector3; respawnY?: number }) {
    this._startPosition = options.startPosition.clone();
    this._respawnY = options.respawnY ?? -20;
    this.position = options.startPosition.clone();
    this.velocity = new Vector3(0, 0, 0);
  }

  // ── 只读属性 ──────────────────────────────────────────────────────────────

  get grounded(): boolean {
    return this._grounded;
  }

  get state(): PlayerState {
    return this._state;
  }

  // ── 重置 ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.position.copy(this._startPosition);
    this.velocity.set(0, 0, 0);
    this._grounded = false;
    this._state = 'idle';
    this._elapsedMs = 0;
    this._lastJumpAtMs = -10_000;
    this._lastGroundedAtMs = -10_000;
    this.currentPlatformId = null;
    this._icy = false;
    this._sticky = false;
  }

  /** 由外部每帧调用，设置当前是否处于冰面（影响地面制动力） */
  setIcy(icy: boolean): void {
    this._icy = icy;
  }

  /** 由外部每帧调用，设置当前是否处于粘性平台（影响地面速度和跳跃力度） */
  setSticky(sticky: boolean): void {
    this._sticky = sticky;
  }

  // ── 主更新（每帧调用） ────────────────────────────────────────────────────

  /**
   * @param delta             帧时间 (s)
   * @param cameraYaw         相机偏航角 (rad)，决定 WASD 世界方向
   * @param input             当前帧输入快照
   * @param resolveCollisions 外部碰撞解算回调
   * @returns { jumped, landed } 本帧事件标志
   */
  update(
    delta: number,
    cameraYaw: number,
    input: PlayerInputSnapshot,
    resolveCollisions: ResolveCollisionsFn,
  ): { jumped: boolean; landed: boolean } {
    this._elapsedMs += delta * 1_000;

    const wasGrounded = this._grounded;

    // ── 1. 水平速度目标 ──────────────────────────────────────────────────────
    const speed =
      (input.sprint ? PLAYER_PHYSICS.sprintSpeed : PLAYER_PHYSICS.moveSpeed) *
      (this._sticky && this._grounded ? 0.58 : 1);
    const rawForward = Number(input.forward) - Number(input.backward);
    const rawStrafe = Number(input.right) - Number(input.left);
    const mag = Math.hypot(rawForward, rawStrafe);
    const nf = mag > 0 ? rawForward / mag : 0;
    const ns = mag > 0 ? rawStrafe / mag : 0;

    // 相机朝向 → 世界坐标移动方向
    const fwdX = -Math.sin(cameraYaw);
    const fwdZ = -Math.cos(cameraYaw);
    const rgtX = Math.cos(cameraYaw);
    const rgtZ = -Math.sin(cameraYaw);
    const targetVX = (fwdX * nf + rgtX * ns) * speed;
    const targetVZ = (fwdZ * nf + rgtZ * ns) * speed;

    // ── 2. 阻尼平滑（空中控制变弱；冰面制动力极低）──────────────────────
    const resp = this._grounded
      ? this._icy
        ? PLAYER_PHYSICS.groundControl * 0.08
        : PLAYER_PHYSICS.groundControl
      : PLAYER_PHYSICS.airControl;
    this.velocity.x = MathUtils.damp(this.velocity.x, mag === 0 ? 0 : targetVX, resp, delta);
    this.velocity.z = MathUtils.damp(this.velocity.z, mag === 0 ? 0 : targetVZ, resp, delta);

    // ── 3. 重力 ─────────────────────────────────────────────────────────────
    this.velocity.y -= PLAYER_PHYSICS.gravity * delta;

    // ── 4. 跳跃（防二段跳：必须已接地 + 最短间隔 + 接地最短时长）──────────
    let jumped = false;
    const canJumpInterval = this._elapsedMs - this._lastJumpAtMs >= MIN_JUMP_INTERVAL_MS;
    const groundedDuration = this._elapsedMs - this._lastGroundedAtMs;
    const canJumpAfterGrounded = groundedDuration >= MIN_GROUNDED_BEFORE_JUMP_MS;

    if (
      input.jumpQueued &&
      this._grounded &&
      canJumpInterval &&
      canJumpAfterGrounded &&
      this.velocity.y <= 0.18
    ) {
      this.velocity.y = PLAYER_PHYSICS.jumpVelocity * (this._sticky ? 0.82 : 1);
      this._grounded = false;
      this._lastJumpAtMs = this._elapsedMs;
      jumped = true;
    }

    // ── 5. 位移积分 ──────────────────────────────────────────────────────────
    this.position.addScaledVector(this.velocity, delta);

    // ── 6. 碰撞解算（外部注入） ──────────────────────────────────────────────
    this._grounded = resolveCollisions(this.position, this.velocity, wasGrounded);

    // ── 7. 落地事件 ──────────────────────────────────────────────────────────
    let landed = false;
    if (!wasGrounded && this._grounded) {
      this._lastGroundedAtMs = this._elapsedMs;
      landed = true;
    }

    // ── 8. 坠落重生 ──────────────────────────────────────────────────────────
    if (this.position.y < this._respawnY) {
      this.position.copy(this._startPosition);
      this.velocity.set(0, 0, 0);
      this._grounded = false;
      this.currentPlatformId = null;
    }

    // ── 9. 状态机更新 ────────────────────────────────────────────────────────
    this._updateState(mag);

    return { jumped, landed };
  }

  // ── 内部：状态机转换 ──────────────────────────────────────────────────────

  private _updateState(inputMag: number): void {
    if (!this._grounded) {
      this._state = this.velocity.y > 0.45 ? 'jump' : 'fall';
    } else if (inputMag > 0.1) {
      this._state = 'run';
    } else {
      this._state = 'idle';
    }
  }

  // ── Debug 快照 ────────────────────────────────────────────────────────────

  getDebugSnapshot(): PlayerDebugSnapshot {
    return {
      height: this.position.y,
      grounded: this._grounded,
      speedXZ: Math.hypot(this.velocity.x, this.velocity.z),
      velocityY: this.velocity.y,
      state: this._state,
      currentPlatformId: this.currentPlatformId,
    };
  }
}
