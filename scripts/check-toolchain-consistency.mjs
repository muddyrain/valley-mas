import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageManagerPattern = /^pnpm@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const setupNodePattern =
  /^(\s*)(?:-\s*)?uses:\s*["']?actions\/setup-node@[^\s"']+["']?\s*(?:#.*)?$/;

function indentation(line) {
  return (line.match(/^[\t ]*/) || [''])[0].replaceAll('\t', '  ').length;
}

function stepPinsVersion(lines, start, end) {
  for (let index = start; index < end; index += 1) {
    const candidate = lines[index];
    const withMatch = candidate.match(/^\s*with\s*:\s*(.*)$/);
    if (!withMatch) continue;
    if (/(?:^|[{,]\s*)version\s*:/.test(withMatch[1])) return true;

    const withIndent = indentation(candidate);
    for (let input = index + 1; input < end; input += 1) {
      const inputLine = lines[input];
      const inputTrimmed = inputLine.trim();
      if (!inputTrimmed || inputTrimmed.startsWith('#')) continue;
      if (indentation(inputLine) <= withIndent) break;
      if (/^version\s*:/.test(inputTrimmed)) return true;
    }
  }

  return false;
}

function actionStepRanges(workflow, actionPattern) {
  const lines = workflow.split(/\r?\n/);
  const ranges = [];

  for (let index = 0; index < lines.length; index += 1) {
    const actionLine = lines[index];
    if (!actionPattern.test(actionLine)) continue;

    let stepStart = index;
    let stepIndent = indentation(actionLine);
    if (!actionLine.trimStart().startsWith('-')) {
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const previousLine = lines[previous];
        if (previousLine.trimStart().startsWith('-') && indentation(previousLine) < stepIndent) {
          stepStart = previous;
          stepIndent = indentation(previousLine);
          break;
        }
      }
    }

    let stepEnd = lines.length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      const trimmed = nextLine.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const nextIndent = indentation(nextLine);
      if (nextIndent < stepIndent || (nextIndent === stepIndent && trimmed.startsWith('-'))) {
        stepEnd = next;
        break;
      }
    }

    ranges.push({ end: stepEnd, lines, start: stepStart });
  }

  return ranges;
}

function actionSetupPinsVersion(workflow) {
  const actionSetupPattern =
    /^(\s*)(?:-\s*)?uses:\s*["']?pnpm\/action-setup@[^\s"']+["']?\s*(?:#.*)?$/;
  return actionStepRanges(workflow, actionSetupPattern).some(({ end, lines, start }) =>
    stepPinsVersion(lines, start, end),
  );
}

function setupNodeUsesPackageJson(workflow) {
  return actionStepRanges(workflow, setupNodePattern).every(({ end, lines, start }) => {
    const step = lines.slice(start, end).join('\n');
    const hasVersionFile = /^\s*node-version-file\s*:\s*["']?package\.json["']?\s*(?:#.*)?$/m.test(
      step,
    );
    const hasInlineVersion = /^\s*node-version\s*:/m.test(step);
    return hasVersionFile && !hasInlineVersion;
  });
}

function nodeEngineSupportsPnpm11(nodeEngine) {
  if (typeof nodeEngine !== 'string') return false;
  const match = nodeEngine.match(/^(?:\^|>=)?22\.(\d+)\.(\d+)(?: <23)?$/);
  if (!match) return false;
  return Number(match[1]) >= 13;
}

export function checkToolchainConsistency(rootDirectory) {
  const errors = [];
  let nodeEngine;
  let packageManager;

  try {
    const packageJson = JSON.parse(readFileSync(resolve(rootDirectory, 'package.json'), 'utf8'));
    nodeEngine = packageJson.engines?.node;
    packageManager = packageJson.packageManager;
  } catch (error) {
    errors.push(`package.json: cannot be read or parsed (${error.message})`);
  }

  if (!packageManagerPattern.test(packageManager || '')) {
    errors.push(
      'package.json: packageManager must declare an exact pnpm version (for example pnpm@11.21.0)',
    );
  }

  if (packageManager?.startsWith('pnpm@11.') && !nodeEngineSupportsPnpm11(nodeEngine)) {
    errors.push(
      'package.json: engines.node must stay on Node.js 22 and allow at least 22.13.0 for pnpm 11',
    );
  }

  const workflowsDirectory = resolve(rootDirectory, '.github', 'workflows');
  let workflowFiles = [];
  try {
    workflowFiles = readdirSync(workflowsDirectory)
      .filter((filename) => /\.ya?ml$/i.test(filename))
      .sort();
  } catch (error) {
    errors.push(`.github/workflows: cannot be read (${error.message})`);
  }

  for (const filename of workflowFiles) {
    const relativePath = `.github/workflows/${filename}`;
    const workflow = readFileSync(resolve(workflowsDirectory, filename), 'utf8');
    if (actionSetupPinsVersion(workflow)) {
      errors.push(
        `${relativePath}: pnpm version must come only from package.json#packageManager; remove action-setup with.version`,
      );
    }
    if (!setupNodeUsesPackageJson(workflow)) {
      errors.push(
        `${relativePath}: Node.js version must come from package.json#engines.node; use setup-node with node-version-file: package.json`,
      );
    }
  }

  return {
    errors,
    packageManager,
    workflowsChecked: workflowFiles.length,
  };
}

function run() {
  const root = resolve(
    process.env.TOOLCHAIN_CHECK_ROOT || fileURLToPath(new URL('..', import.meta.url)),
  );
  const result = checkToolchainConsistency(root);

  if (result.errors.length) {
    console.error('FAIL: toolchain configuration is inconsistent');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PASS: pnpm uses one version source (${result.packageManager}, workflows=${result.workflowsChecked})`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
