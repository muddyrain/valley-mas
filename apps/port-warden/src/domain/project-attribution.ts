import path from 'node:path';
import type { ProjectAttribution, SupportedPlatform } from '../shared/domain';

const PROJECT_MARKERS = [
  '.git',
  'pnpm-workspace.yaml',
  'package.json',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
] as const;

type ProjectInput = {
  platform: SupportedPlatform;
  registeredPaths: string[];
  workingDirectory?: string;
  commandLine?: string;
  executablePath?: string;
};

type FileProbe = {
  exists(path: string): boolean;
};

function pathTools(platform: SupportedPlatform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function findRoot(
  initialPath: string,
  platform: SupportedPlatform,
  files: FileProbe,
): { path: string; marker?: string } | undefined {
  const tools = pathTools(platform);
  let current = tools.normalize(initialPath);

  for (;;) {
    for (const marker of PROJECT_MARKERS) {
      if (files.exists(tools.join(current, marker))) return { path: current, marker };
    }
    const parent = tools.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function containsPath(parent: string, child: string, platform: SupportedPlatform) {
  const tools = pathTools(platform);
  const relative = tools.relative(tools.resolve(parent), tools.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !tools.isAbsolute(relative));
}

function commandPathCandidates(commandLine: string, platform: SupportedPlatform) {
  const tools = pathTools(platform);
  const candidates: string[] = [];
  const tokenPattern = /"([^"]+)"|'([^']+)'|([^\s]+)/g;

  for (const match of commandLine.matchAll(tokenPattern)) {
    const token = match[1] ?? match[2] ?? match[3] ?? '';
    const cleaned = token.replace(/^file:\/\//, '').replace(/[),;]$/, '');
    if (tools.isAbsolute(cleaned)) candidates.push(tools.normalize(cleaned));
  }

  return candidates;
}

export function resolveProjectAttribution(
  input: ProjectInput,
  files: FileProbe,
): ProjectAttribution {
  for (const registeredPath of input.registeredPaths) {
    const matchesWorkingDirectory =
      input.workingDirectory &&
      containsPath(registeredPath, input.workingDirectory, input.platform);
    const matchesCommand = commandPathCandidates(input.commandLine ?? '', input.platform).some(
      (candidate) => containsPath(registeredPath, candidate, input.platform),
    );
    if (!matchesWorkingDirectory && !matchesCommand) continue;

    const root = findRoot(registeredPath, input.platform, files);
    return {
      path: root?.path ?? pathTools(input.platform).normalize(registeredPath),
      source: 'registered',
      confidence: 'exact',
      marker: root?.marker,
    };
  }

  if (input.workingDirectory) {
    const root = findRoot(input.workingDirectory, input.platform, files);
    return {
      path: root?.path ?? pathTools(input.platform).normalize(input.workingDirectory),
      source: 'working-directory',
      confidence: 'exact',
      marker: root?.marker,
    };
  }

  const executable = input.executablePath ? [input.executablePath] : [];
  const candidates = [
    ...commandPathCandidates(input.commandLine ?? '', input.platform),
    ...executable,
  ];
  for (const candidate of candidates) {
    if (!files.exists(candidate)) continue;
    const root = findRoot(pathTools(input.platform).dirname(candidate), input.platform, files);
    if (root) {
      return {
        path: root.path,
        source: 'command-line',
        confidence: 'inferred',
        marker: root.marker,
      };
    }
  }

  return { source: 'unknown', confidence: 'unknown' };
}

export { PROJECT_MARKERS };
