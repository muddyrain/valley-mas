import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectRegistrationStore } from './project-registration-store';

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe('ProjectRegistrationStore', () => {
  it('persists unique absolute project paths and reloads them', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'port-warden-'));
    const filePath = path.join(temporaryDirectory, 'registered-projects.json');
    const projectPath = path.join(path.parse(tmpdir()).root, 'work', 'acme');
    const store = new ProjectRegistrationStore(
      filePath,
      () => new Date('2026-08-11T03:00:00.000Z'),
    );

    await store.add(projectPath);
    await store.add(projectPath);

    expect(await store.load()).toEqual([projectPath]);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({
      version: 1,
      projects: [{ path: projectPath, registeredAt: '2026-08-11T03:00:00.000Z' }],
    });
  });

  it('ignores malformed entries and rejects relative paths', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'port-warden-'));
    const store = new ProjectRegistrationStore(
      path.join(temporaryDirectory, 'registered-projects.json'),
    );

    await expect(store.add('../relative')).rejects.toThrow('绝对路径');
    expect(await store.load()).toEqual([]);
  });
});
