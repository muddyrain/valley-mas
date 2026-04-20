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
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

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
  const pretty = `${command} ${args.map((item) => JSON.stringify(item)).join(' ')}`;
  console.log(`\n$ ${pretty}`);
  const ret = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

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

  const env = {
    ...process.env,
    DB_DSN: dbDsn,
  };

  console.log('🚀 开始执行名著数据一键入库（迁移 + seed）');
  runCommand('go', ['run', './scripts/migrate_classics.go', dbDsn], env, serverDir);
  runCommand('go', ['run', './scripts/seed_classics.go', dbDsn], env, serverDir);
  console.log('\n✅ 名著测试数据已入库完成');
}

main();
