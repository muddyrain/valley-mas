import { describe, expect, it } from 'vitest';
import { resolveProjectAttribution } from './project-attribution';

const fakeFiles = (...paths: string[]) => ({
  exists: (path: string) => paths.includes(path),
});

describe('project attribution', () => {
  it('prefers a path registered by Port Warden', () => {
    expect(
      resolveProjectAttribution(
        {
          platform: 'darwin',
          registeredPaths: ['/Users/mei/work/demo'],
          workingDirectory: '/Users/mei/work/demo/apps/api',
          commandLine: 'node /tmp/other/server.js',
        },
        fakeFiles('/Users/mei/work/demo/.git'),
      ),
    ).toEqual({
      path: '/Users/mei/work/demo',
      source: 'registered',
      confidence: 'exact',
      marker: '.git',
    });
  });

  it('uses an OS-provided cwd with exact confidence and walks to its project root', () => {
    expect(
      resolveProjectAttribution(
        {
          platform: 'darwin',
          registeredPaths: [],
          workingDirectory: '/Users/mei/work/demo/apps/api',
          commandLine: 'node server.js',
        },
        fakeFiles('/Users/mei/work/demo/pnpm-workspace.yaml'),
      ),
    ).toMatchObject({
      path: '/Users/mei/work/demo',
      source: 'working-directory',
      confidence: 'exact',
      marker: 'pnpm-workspace.yaml',
    });
  });

  it('infers a Windows project from a command path and labels it inferred', () => {
    expect(
      resolveProjectAttribution(
        {
          platform: 'win32',
          registeredPaths: [],
          commandLine: '"C:\\Program Files\\nodejs\\node.exe" "C:\\work\\portal\\scripts\\dev.js"',
        },
        fakeFiles('C:\\work\\portal\\scripts\\dev.js', 'C:\\work\\portal\\package.json'),
      ),
    ).toMatchObject({
      path: 'C:\\work\\portal',
      source: 'command-line',
      confidence: 'inferred',
      marker: 'package.json',
    });
  });

  it('returns unknown rather than inventing a directory', () => {
    expect(
      resolveProjectAttribution(
        { platform: 'win32', registeredPaths: [], commandLine: 'node server.js' },
        fakeFiles(),
      ),
    ).toEqual({ source: 'unknown', confidence: 'unknown' });
  });
});
