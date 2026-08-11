import type { ProcessSnapshot, ProcessTreeNode } from '../shared/domain';

function directChildren(pid: number, processes: Map<number, ProcessSnapshot>) {
  return [...processes.values()]
    .filter((process) => process.ppid === pid && process.pid !== pid)
    .sort((left, right) => left.pid - right.pid);
}

export function buildProcessTree(
  rootPid: number,
  processes: Map<number, ProcessSnapshot>,
  visited = new Set<number>(),
): ProcessTreeNode | undefined {
  const process = processes.get(rootPid);
  if (!process || visited.has(rootPid)) return undefined;
  visited.add(rootPid);

  return {
    process,
    children: directChildren(rootPid, processes)
      .map(({ pid }) => buildProcessTree(pid, processes, visited))
      .filter((node): node is ProcessTreeNode => Boolean(node)),
  };
}

export function collectDescendantPids(
  rootPid: number,
  processes: Map<number, ProcessSnapshot>,
): number[] {
  const ordered: number[] = [];
  const visited = new Set<number>([rootPid]);

  const visit = (pid: number) => {
    for (const child of directChildren(pid, processes)) {
      if (visited.has(child.pid)) continue;
      visited.add(child.pid);
      visit(child.pid);
      ordered.push(child.pid);
    }
  };

  visit(rootPid);
  return ordered;
}
