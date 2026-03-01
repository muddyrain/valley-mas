#!/usr/bin/env node
/**
 * 测试 Snowflake ID 唯一性
 * 快速调用 init-data API，验证生成的 ID 是否唯一
 */

const http = require('node:http');

const API_URL = 'http://localhost:8080/init-data?force=true';
const TEST_COUNT = 10; // 测试次数

const allIds = new Set();
let successCount = 0;
let failCount = 0;

// HTTP GET 请求
function request(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error(`解析 JSON 失败: ${err.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      })
      .on('error', reject);
  });
}

// 主测试函数
async function testIDUniqueness() {
  console.log('🧪 开始测试 Snowflake ID 唯一性...\n');
  console.log(`📋 测试计划: 调用 ${TEST_COUNT} 次 init-data API\n`);

  for (let i = 1; i <= TEST_COUNT; i++) {
    try {
      console.log(`[${i}/${TEST_COUNT}] 调用 API...`);

      const result = await request(API_URL);

      if (result.code === 200 && result.data.users) {
        const users = result.data.users;
        console.log(`  ✅ 成功创建 ${users.length} 个用户`);

        // 收集所有 ID
        for (const user of users) {
          if (allIds.has(user.id)) {
            console.error(`  ❌ 发现重复 ID: ${user.id} (${user.username})`);
            failCount++;
          } else {
            allIds.add(user.id);
            console.log(`    - ${user.username}: ${user.id}`);
          }
        }

        successCount++;
      } else {
        console.error(`  ❌ API 返回错误:`, result.msg || result);
        failCount++;
      }

      console.log('');

      // 延迟 100ms 避免过快
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`  ❌ 请求失败: ${err.message}`);
      failCount++;
      console.log('');
    }
  }

  // 输出结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果');
  console.log('='.repeat(60));
  console.log(`✅ 成功请求: ${successCount}/${TEST_COUNT}`);
  console.log(`❌ 失败请求: ${failCount}/${TEST_COUNT}`);
  console.log(`🆔 总生成 ID 数: ${allIds.size}`);
  console.log(`🔍 唯一 ID 数: ${allIds.size}`);

  if (allIds.size > 0) {
    const ids = Array.from(allIds).sort((a, b) => a - b);
    console.log(`\n📈 ID 范围:`);
    console.log(`  最小值: ${ids[0]}`);
    console.log(`  最大值: ${ids[ids.length - 1]}`);
    console.log(`  差值: ${ids[ids.length - 1] - ids[0]}`);

    // 检查是否有重复
    const hasDuplicates = allIds.size !== ids.length;
    if (hasDuplicates) {
      console.log('\n❌ 警告：检测到重复 ID！');
    } else {
      console.log('\n✅ 所有 ID 都是唯一的！');
    }
  }

  console.log('='.repeat(60));
}

// 运行测试
testIDUniqueness().catch((err) => {
  console.error('\n💥 测试失败:', err);
  process.exit(1);
});
