import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkToolchainConsistency } from './check-toolchain-consistency.mjs';

function createFixture({ packageManager = 'pnpm@11.21.0', workflows = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'valley-toolchain-'));
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager }));

  for (const [filename, contents] of Object.entries(workflows)) {
    writeFileSync(join(root, '.github', 'workflows', filename), contents);
  }

  return root;
}

function withFixture(options, assertion) {
  const root = createFixture(options);
  try {
    assertion(checkToolchainConsistency(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('rejects a pnpm version duplicated in a named action step', () => {
  withFixture(
    {
      workflows: {
        'quality.yml': `steps:
  - name: Set up pnpm
    uses: pnpm/action-setup@v4
    with:
      version: 9.15.0
`,
      },
    },
    ({ errors }) => {
      assert.deepEqual(errors, [
        '.github/workflows/quality.yml: pnpm version must come only from package.json#packageManager; remove action-setup with.version',
      ]);
    },
  );
});

test('accepts packageManager as the only pnpm version source', () => {
  withFixture(
    {
      workflows: {
        'quality.yml': `steps:
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
`,
      },
    },
    ({ errors, packageManager, workflowsChecked }) => {
      assert.deepEqual(errors, []);
      assert.equal(packageManager, 'pnpm@11.21.0');
      assert.equal(workflowsChecked, 1);
    },
  );
});

test('checks direct action steps in .yaml workflows', () => {
  withFixture(
    {
      workflows: {
        'release.yaml': `steps:
  - uses: pnpm/action-setup@v4
    with:
      version: 11.21.0
  - run: pnpm build
`,
      },
    },
    ({ errors }) => {
      assert.equal(errors.length, 1);
      assert.match(errors[0], /\.github\/workflows\/release\.yaml/);
    },
  );
});

test('rejects a version declared before the action in the same step', () => {
  withFixture(
    {
      workflows: {
        'quality.yml': `steps:
  - name: Set up pnpm
    with:
      version: 9.15.0
    uses: pnpm/action-setup@v4
`,
      },
    },
    ({ errors }) => {
      assert.equal(errors.length, 1);
    },
  );
});

test('requires pnpm as the packageManager', () => {
  withFixture({ packageManager: 'npm@11.0.0' }, ({ errors }) => {
    assert.deepEqual(errors, [
      'package.json: packageManager must declare an exact pnpm version (for example pnpm@11.21.0)',
    ]);
  });
});

test('rejects a floating pnpm packageManager version', () => {
  withFixture({ packageManager: 'pnpm@latest' }, ({ errors }) => {
    assert.equal(errors.length, 1);
    assert.match(errors[0], /exact pnpm version/);
  });
});
