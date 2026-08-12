import type { RenderSnapshot } from './renderTypes';

export interface InterpolatedAgent {
  x: number;
  z: number;
  heading: number;
  state: number;
}

export class SnapshotInterpolator {
  private previous: RenderSnapshot | null = null;
  private current: RenderSnapshot | null = null;
  private currentReceivedAt = 0;
  private intervalMs = 100;

  get population(): number {
    return this.current?.population ?? 0;
  }

  get latest(): RenderSnapshot | null {
    return this.current;
  }

  push(snapshot: RenderSnapshot, receivedAt = performance.now()): void {
    if (!this.current || this.current.population !== snapshot.population) {
      this.previous = snapshot;
      this.current = snapshot;
      this.currentReceivedAt = receivedAt;
      this.intervalMs = 100;
      return;
    }
    this.previous = this.current;
    this.current = snapshot;
    this.intervalMs = Math.max(16, Math.min(250, receivedAt - this.currentReceivedAt));
    this.currentReceivedAt = receivedAt;
  }

  sample(agentId: number, now = performance.now()): InterpolatedAgent | null {
    const current = this.current;
    const previous = this.previous;
    if (!current || !previous || agentId >= current.population) return null;
    const samePopulation = current.population === previous.population;
    const alpha = samePopulation
      ? Math.max(0, Math.min(1, (now - this.currentReceivedAt) / this.intervalMs))
      : 1;
    const previousX = samePopulation
      ? (previous.positionsX[agentId] ?? current.positionsX[agentId] ?? 0)
      : (current.positionsX[agentId] ?? 0);
    const previousZ = samePopulation
      ? (previous.positionsZ[agentId] ?? current.positionsZ[agentId] ?? 0)
      : (current.positionsZ[agentId] ?? 0);
    const currentX = current.positionsX[agentId] ?? 0;
    const currentZ = current.positionsZ[agentId] ?? 0;
    return {
      x: previousX + (currentX - previousX) * alpha,
      z: previousZ + (currentZ - previousZ) * alpha,
      heading: current.headings[agentId] ?? 0,
      state: current.states[agentId] ?? 0,
    };
  }
}
