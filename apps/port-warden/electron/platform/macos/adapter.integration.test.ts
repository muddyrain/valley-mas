import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { MacOsPortAdapter } from './adapter';

const describeOnMac = process.platform === 'darwin' ? describe : describe.skip;
let closeServer: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describeOnMac('MacOsPortAdapter runtime listener', () => {
  it('finds the current PID/command and observes the port release', async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    closeServer = () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address');

    const adapter = new MacOsPortAdapter();
    const visible = await adapter.scan();
    const listener = visible.listeners.find(
      ({ pid, port }) => pid === process.pid && port === address.port,
    );
    const current = visible.processes.get(process.pid);

    expect(listener).toMatchObject({ address: '127.0.0.1', family: 'ipv4' });
    expect(current?.commandLine).toContain('vitest');
    expect(current?.startedAt).toBeTruthy();

    await closeServer();
    closeServer = undefined;
    const released = await adapter.scan();
    expect(
      released.listeners.some(({ pid, port }) => pid === process.pid && port === address.port),
    ).toBe(false);
    process.stdout.write(
      `${JSON.stringify({
        evidence: 'port-warden-macos-listener',
        port: address.port,
        expectedPid: process.pid,
        observedPid: listener?.pid,
        commandMatched: current?.commandLine?.includes('vitest') === true,
        released: true,
      })}\n`,
    );
  });
});
