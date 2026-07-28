import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const rawScopes = process.argv.slice(2).filter((argument) => argument !== '--');

function printUsage() {
  console.log('Usage: pnpm context:recent -- [path ...]');
  console.log('Example: pnpm context:recent -- apps/web server');
}

if (rawScopes.includes('--help') || rawScopes.includes('-h')) {
  printUsage();
  process.exit(0);
}

function normalizeScope(scope) {
  const absolutePath = resolve(root, scope);
  const relativePath = relative(root, absolutePath);
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    isAbsolute(relativePath) ||
    !existsSync(absolutePath)
  ) {
    throw new Error(`Scope must be an existing path inside the repository: ${scope}`);
  }
  return relativePath.replaceAll('\\', '/');
}

function git(args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function gitArgs(command) {
  return scopes.length > 0 ? [...command, '--', ...scopes] : command;
}

function section(title, content) {
  console.log(`\n## ${title}`);
  console.log(content || '（无）');
}

let scopes;
try {
  scopes = rawScopes.map(normalizeScope);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  printUsage();
  process.exit(1);
}

const branch = git(['branch', '--show-current']) || '(detached HEAD)';
const statusLines = git(['status', '--short']).split('\n').filter(Boolean);
const scopeLabel = scopes.length > 0 ? scopes.join(', ') : '整个仓库';

console.log(`# 最近上下文：${scopeLabel}`);
section(
  '工作区',
  [
    `分支：${branch}`,
    statusLines.length > 0
      ? `未提交改动：${statusLines.length} 项（仅展示前 20 项）\n${statusLines.slice(0, 20).join('\n')}`
      : '工作区干净',
  ].join('\n'),
);

section('最近提交', git(gitArgs(['log', '-n', '15', '--date=short', '--format=%h %ad %s'])));

const plansDirectory = resolve(root, 'docs/plans');
const activePlans = readdirSync(plansDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
  .map((entry) => {
    const path = resolve(plansDirectory, entry.name);
    const text = readFileSync(path, 'utf8');
    const title = text.match(/^#\s+(.+)$/m)?.[1] ?? entry.name;
    return { name: entry.name, title, text };
  });
section(
  '活跃计划',
  activePlans.length > 0
    ? activePlans.map(({ name, title }) => `- ${name}：${title}`).join('\n')
    : '未发现活跃计划。',
);

const changedMarkdown = git(gitArgs(['log', '-n', '15', '--format=', '--name-only']))
  .split('\n')
  .filter((file) => file.endsWith('.md'));
const recentMarkdown = [...new Set(changedMarkdown)].slice(0, 12);
section(
  '近期改动的 Markdown',
  recentMarkdown.length > 0
    ? recentMarkdown.map((file) => `- ${file}`).join('\n')
    : '该范围最近 15 条提交未直接修改 Markdown；请按任务需要读取关联的 AGENTS、README 或计划文档。',
);
