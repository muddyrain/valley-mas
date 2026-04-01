---
name: encoding-guard
description: 防止代码编辑过程中的文本编码损坏（乱码/mojibake）。当任务会修改包含中文或其他非 ASCII 文本的源码时，必须在开始前与结束后执行；当 diff 中出现类似“UTF-8 被按 GBK 解释”的异常文本时也必须触发。
---

# 编码防乱码流程

把这个技能当作编辑前后的保护网，确保可读文本不会被改成乱码。

## 1) 编辑前先扫描

在仓库根目录执行：

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py
```

如果检测到疑似乱码，先修复再继续改代码。

## 2) 编辑过程中保持编码稳定

每次写文件都遵循：
- 默认保持 UTF-8；只有项目明确要求时才用其他编码。
- 不要在无关改动里顺手“另存为新编码”。
- 尽量做精准行级修改，避免整文件重写导致字符串被批量污染。
- 一旦某行出现乱码，立即恢复原语义并重新检查 diff。

## 3) 编辑后再次扫描

结束前再执行一次：

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py
```

如果有命中，修复后重复执行，直到结果干净。

## 4) 按文件定向扫描（可选）

仅扫描指定文件：

```bash
python .codex/skills/encoding-guard/scripts/check_mojibake.py path\to\file1.ts path\to\file2.vue
```

## 5) 修复指引

发现可疑行时：
- 先看脚本给的“恢复建议”是否与业务语义一致。
- 如果建议正确，只替换该字符串，不做额外重写。
- 如果不确定，结合 UI 文案、测试、i18n 邻近内容还原真实文本。

更多细节见 `references/encoding-playbook.md`。
