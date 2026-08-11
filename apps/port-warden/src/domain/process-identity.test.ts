import { describe, expect, it } from 'vitest';
import type { ProcessIdentity, ProcessSnapshot } from '../shared/domain';
import { verifyProcessIdentity } from './process-identity';

const expected: ProcessIdentity = {
  pid: 321,
  name: 'node',
  commandLine: 'node server.js --port 3000',
  executablePath: '/opt/homebrew/bin/node',
  startedAt: '2026-08-11T01:00:00.000Z',
};

const actual: ProcessSnapshot = {
  ...expected,
  ppid: 100,
  readOnly: false,
};

describe('verifyProcessIdentity', () => {
  it('accepts a fresh snapshot only when stable identity fields still match', () => {
    expect(verifyProcessIdentity(expected, actual)).toEqual({ matches: true, mismatches: [] });
  });

  it('rejects PID reuse when start time or command line changed', () => {
    const result = verifyProcessIdentity(expected, {
      ...actual,
      commandLine: 'node other.js',
      startedAt: '2026-08-11T02:00:00.000Z',
    });

    expect(result.matches).toBe(false);
    expect(result.mismatches).toEqual(['startedAt', 'commandLine']);
  });

  it('rejects uncertain identities', () => {
    expect(
      verifyProcessIdentity(expected, { ...actual, startedAt: undefined, commandLine: undefined }),
    ).toMatchObject({ matches: false });
  });
});
