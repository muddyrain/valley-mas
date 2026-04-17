#!/usr/bin/env node
/**
 * Commit Message 格式检查脚本
 * 遵循 Conventional Commits 规范
 */

const fs = require('node:fs');

// 获取 commit message 文件路径
const msgPath = process.argv[2];

if (!msgPath) {
  console.error('❌ 错误：未提供 commit message 文件路径');
  process.exit(1);
}

// 读取 commit message
let msg;
try {
  msg = fs.readFileSync(msgPath, 'utf8').trim();
} catch (err) {
  console.error(`❌ 错误：无法读取文件 ${msgPath}`);
  console.error(err.message);
  process.exit(1);
}

// Conventional Commits 格式检查
const pattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,}/;
// 允许 Git 自动生成的 merge commit message（如：Merge branch 'master' of ...）
const mergePattern = /^Merge (branch|remote-tracking branch) '.+'(?: of .+)?$/;

if (!pattern.test(msg) && !mergePattern.test(msg)) {
  console.log('');
  console.log('❌ Commit message 格式错误！');
  console.log('');
  console.log('📝 正确格式：');
  console.log('   <type>(<scope>): <subject>');
  console.log('');
  console.log('📋 允许的 type：');
  console.log('   feat:     新功能');
  console.log('   fix:      Bug 修复');
  console.log('   docs:     文档修改');
  console.log('   style:    代码格式（不影响功能）');
  console.log('   refactor: 重构');
  console.log('   perf:     性能优化');
  console.log('   test:     测试相关');
  console.log('   chore:    构建/工具相关');
  console.log('   ci:       CI/CD 相关');
  console.log('   build:    构建相关');
  console.log('   revert:   回退');
  console.log('');
  console.log('✅ 示例：');
  console.log('   feat(auth): add cookie support');
  console.log('   fix(api): resolve login timeout');
  console.log('   docs: update README');
  console.log('');
  console.log(`❌ 你的 message: ${msg}`);
  console.log('');
  process.exit(1);
}

// 检查通过
console.log('✅ Commit message 格式正确');
process.exit(0);
