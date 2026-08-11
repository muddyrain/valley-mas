import { describe, expect, it } from 'vitest';
import type { ProcessSnapshot } from '../shared/domain';
import { buildProcessTree, collectDescendantPids } from './process-tree';

const process = (pid: number, ppid: number, name: string): ProcessSnapshot => ({
  pid,
  ppid,
  name,
  commandLine: name,
  executablePath: `/bin/${name}`,
  startedAt: `2026-08-11T01:00:0${pid}.000Z`,
  readOnly: false,
});

describe('process tree', () => {
  const processes = new Map([
    [1, process(1, 0, 'root')],
    [2, process(2, 1, 'runner')],
    [3, process(3, 2, 'worker-a')],
    [4, process(4, 2, 'worker-b')],
  ]);

  it('builds a focused parent/child tree', () => {
    expect(buildProcessTree(2, processes)).toMatchObject({
      process: { pid: 2 },
      children: [{ process: { pid: 3 } }, { process: { pid: 4 } }],
    });
  });

  it('collects descendants deepest-first for precise tree termination', () => {
    expect(collectDescendantPids(1, processes)).toEqual([3, 4, 2]);
  });
});
