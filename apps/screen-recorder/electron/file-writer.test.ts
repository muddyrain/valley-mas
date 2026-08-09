import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { RecordingFileWriter } from './file-writer';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

it('writes MP4 media bytes to an MP4 path and only publishes a non-empty file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'valley-recorder-'));
  temporaryDirectories.push(directory);
  const writer = new RecordingFileWriter(directory);
  const output = await writer.begin('video/mp4;codecs=avc1.42001E');

  await writer.append(output.sessionId, new Uint8Array([1, 2, 3, 4]));
  const finalPath = await writer.finish(output.sessionId);

  expect(output.outputPath.endsWith('.mp4')).toBe(true);
  expect(finalPath).toBe(output.outputPath);
  expect([...(await readFile(finalPath))]).toEqual([1, 2, 3, 4]);
});

it('uses a newly authorized recording directory for the next session', async () => {
  const firstDirectory = await mkdtemp(path.join(os.tmpdir(), 'valley-recorder-first-'));
  const nextDirectory = await mkdtemp(path.join(os.tmpdir(), 'valley-recorder-next-'));
  temporaryDirectories.push(firstDirectory, nextDirectory);
  const writer = new RecordingFileWriter(firstDirectory);

  writer.setSaveDirectory(nextDirectory);
  const output = await writer.begin('video/webm;codecs=vp9');

  expect(path.dirname(output.outputPath)).toBe(nextDirectory);
});
