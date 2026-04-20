#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) {
    return result;
  }

  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function runCommand(command, args, env, cwd) {
  const pretty = `${command} ${args.map((it) => JSON.stringify(it)).join(' ')}`;
  console.log(`\n$ ${pretty}`);
  const ret = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (ret.error) {
    console.error(`命令执行失败: ${ret.error.message}`);
    process.exit(1);
  }
  if (ret.status !== 0) {
    process.exit(ret.status || 1);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const serverDir = path.join(repoRoot, 'server');

  const envFromServer = parseEnvFile(path.join(repoRoot, 'server', '.env'));
  const envFromRoot = parseEnvFile(path.join(repoRoot, '.env'));
  const dbDsn = process.env.DB_DSN || envFromServer.DB_DSN || envFromRoot.DB_DSN;

  if (!dbDsn) {
    console.error('未找到 DB_DSN。请先在 server/.env 配置 DB_DSN，或临时传入环境变量 DB_DSN。');
    process.exit(1);
  }

  const env = { ...process.env, DB_DSN: dbDsn };

  console.log('🚀 开始导入完整正文数据（将覆盖每本书默认版本的章节内容）');
  runCommand('go', ['run', './scripts/import_classics_fulltext.go', dbDsn], env, serverDir);
  console.log('\n✅ 完整正文数据导入完成');
}

main();
