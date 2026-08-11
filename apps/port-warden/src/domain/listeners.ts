import type { ProcessSnapshot, RawListener } from '../shared/domain';

export type MergedListener = {
  key: string;
  pid: number;
  port: number;
  addresses: Array<Pick<RawListener, 'address' | 'family'>>;
  process: ProcessSnapshot;
};

export function mergeListeners(
  listeners: RawListener[],
  processes: Map<number, ProcessSnapshot>,
): MergedListener[] {
  const merged = new Map<string, MergedListener>();

  for (const listener of listeners) {
    const process = processes.get(listener.pid);
    if (!process) continue;

    const key = `${listener.pid}:${listener.port}`;
    const existing = merged.get(key);
    const address = { address: listener.address, family: listener.family };

    if (existing) {
      const duplicate = existing.addresses.some(
        (candidate) => candidate.address === address.address && candidate.family === address.family,
      );
      if (!duplicate) existing.addresses.push(address);
      continue;
    }

    merged.set(key, {
      key,
      pid: listener.pid,
      port: listener.port,
      addresses: [address],
      process,
    });
  }

  return [...merged.values()].sort((left, right) => left.port - right.port || left.pid - right.pid);
}
