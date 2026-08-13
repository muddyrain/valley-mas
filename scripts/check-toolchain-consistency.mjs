import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageManagerPattern = /^pnpm@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

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

function actionSetupPinsVersion(workflow) {
  const lines = workflow.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const actionLine = lines[index];
    if (
      !/^(\s*)(?:-\s*)?uses:\s*["']?pnpm\/action-setup@[^\s"']+["']?\s*(?:#.*)?$/.test(actionLine)
    ) {
      continue;
    }

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

    if (stepPinsVersion(lines, stepStart, stepEnd)) return true;
  }

  return false;
}

export function checkToolchainConsistency(rootDirectory) {
  const errors = [];
  let packageManager;

  try {
    const packageJson = JSON.parse(readFileSync(resolve(rootDirectory, 'package.json'), 'utf8'));
    packageManager = packageJson.packageManager;
  } catch (error) {
    errors.push(`package.json: cannot be read or parsed (${error.message})`);
  }

  if (!packageManagerPattern.test(packageManager || '')) {
    errors.push(
      'package.json: packageManager must declare an exact pnpm version (for example pnpm@11.21.0)',
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
