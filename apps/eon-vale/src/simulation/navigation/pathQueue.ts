import { createPathSearchWorkspace, findPath, type PathSearchWorkspace } from './astar';
import type { NavigationGrid } from './grid';
import { simplifyPath } from './simplifyPath';

export interface PathRequest {
  requestId: number;
  agentId: number;
  startCell: number;
  destinationCell: number;
  priority: number;
  mapVersion: number;
  requestedAtTick: number;
}

export interface PathResult extends PathRequest {
  path: number[];
}

export class PathQueue {
  private readonly requests: PathRequest[] = [];
  private workspace: PathSearchWorkspace | null = null;

  get size(): number {
    return this.requests.length;
  }

  enqueue(request: PathRequest): void {
    const previous = this.requests.findIndex((candidate) => candidate.agentId === request.agentId);
    if (previous >= 0) this.requests.splice(previous, 1);
    this.requests.push(request);
  }

  cancelForAgent(agentId: number): void {
    const index = this.requests.findIndex((request) => request.agentId === agentId);
    if (index >= 0) this.requests.splice(index, 1);
  }

  process(grid: NavigationGrid, searchBudget: number): PathResult[] {
    const cellCount = grid.width * grid.height;
    if (this.workspace?.cellCount !== cellCount) {
      this.workspace = createPathSearchWorkspace(cellCount);
    }
    this.requests.sort(
      (left, right) =>
        right.priority - left.priority || left.requestedAtTick - right.requestedAtTick,
    );
    const count = Math.min(Math.max(0, Math.floor(searchBudget)), this.requests.length);
    const selected = this.requests.splice(0, count);
    const completed: PathResult[] = [];
    for (const request of selected) {
      if (request.mapVersion > grid.mapVersion) continue;
      const path = simplifyPath(
        grid,
        findPath(grid, request.startCell, request.destinationCell, 12_000, this.workspace),
      );
      completed.push({ ...request, path });
    }
    return completed;
  }
}
