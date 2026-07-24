import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(
  process.env.PLAN_INDEX_ROOT || resolve(fileURLToPath(new URL('..', import.meta.url))),
);
const plansDirectory = resolve(root, 'docs/plans');
const indexPath = resolve(plansDirectory, 'README.md');
const activeHeading = '\u5f53\u524d\u6d3b\u8dc3\u8ba1\u5212';
const archiveHeadingPrefix = '\u5df2\u5f52\u6863';

function normalizeLinkTarget(target) {
  return target.trim().replace(/^\.\//, '').replaceAll('\\', '/');
}

function linksInSection(indexText, heading) {
  let collecting = false;
  const links = [];
  for (const line of indexText.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      collecting = line.slice(3).trim() === heading;
      continue;
    }
    if (!collecting) continue;
    const match = line.match(/^- \[[^\]]+\]\(([^)]+)\)/);
    if (match) links.push(normalizeLinkTarget(match[1]));
  }
  return links;
}

function archivedLinks(indexText) {
  let section = '';
  const links = [];
  for (const line of indexText.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      continue;
    }
    if (!section.startsWith(archiveHeadingPrefix)) continue;
    const match = line.match(/^- \[[^\]]+\]\(([^)]+)\)/);
    if (match) links.push(normalizeLinkTarget(match[1]));
  }
  return links;
}

const indexText = readFileSync(indexPath, 'utf8');
const activeExpected = new Set(
  readdirSync(plansDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name),
);
const archiveExpected = new Set(
  readdirSync(resolve(plansDirectory, 'archive'), { withFileTypes: true }).flatMap((directory) =>
    directory.isDirectory()
      ? readdirSync(resolve(plansDirectory, 'archive', directory.name), { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
          .map((entry) => `archive/${directory.name}/${entry.name}`)
      : [],
  ),
);
const activeListed = new Set(
  linksInSection(indexText, activeHeading).map((link) => link.split('/').pop()),
);
const archivedListed = new Set(archivedLinks(indexText));
const missing = (expected, listed) => [...expected].filter((item) => !listed.has(item)).sort();
const extra = (expected, listed) => [...listed].filter((item) => !expected.has(item)).sort();

const errors = [
  ...missing(activeExpected, activeListed).map(
    (item) => `Active plan missing from README: ${item}`,
  ),
  ...extra(activeExpected, activeListed).map((item) => `README has non-active plan entry: ${item}`),
  ...missing(archiveExpected, archivedListed).map(
    (item) => `Archived plan missing from README: ${item}`,
  ),
  ...extra(archiveExpected, archivedListed).map((item) => `README has non-archived entry: ${item}`),
];

if (errors.length) {
  console.error('FAIL: docs/plans/README index inconsistent');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS: plans index consistent (active=${activeExpected.size}, archived=${archiveExpected.size})`,
  );
}
