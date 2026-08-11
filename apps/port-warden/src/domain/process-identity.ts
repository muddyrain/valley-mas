import type { ProcessIdentity, ProcessSnapshot } from '../shared/domain';

export type IdentityField = 'pid' | 'startedAt' | 'commandLine' | 'executablePath' | 'name';

const normalize = (value: string | undefined) => value?.trim() || undefined;

export function verifyProcessIdentity(
  expected: ProcessIdentity,
  actual: ProcessSnapshot | undefined,
): { matches: boolean; mismatches: IdentityField[] } {
  if (!actual) return { matches: false, mismatches: ['pid'] };

  const mismatches: IdentityField[] = [];
  if (expected.pid !== actual.pid) mismatches.push('pid');

  if (!expected.startedAt || !actual.startedAt || expected.startedAt !== actual.startedAt) {
    mismatches.push('startedAt');
  }
  if (
    !normalize(expected.commandLine) ||
    !normalize(actual.commandLine) ||
    normalize(expected.commandLine) !== normalize(actual.commandLine)
  ) {
    mismatches.push('commandLine');
  }
  if (
    normalize(expected.executablePath) &&
    normalize(actual.executablePath) &&
    normalize(expected.executablePath) !== normalize(actual.executablePath)
  ) {
    mismatches.push('executablePath');
  }
  if (expected.name !== actual.name) mismatches.push('name');

  return { matches: mismatches.length === 0, mismatches };
}
