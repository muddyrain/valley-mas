---
name: unity-test
description: "Unity Test Runner operations. Use when users want to run, list, or check test results. Triggers: test, unit test, test runner, EditMode, PlayMode, Unity测试, Unity单元测试, Unity测试运行."
---

# Test Skills

Run and manage Unity tests.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- `test_run` does not exist → use `test_run_all` or `test_run_by_name`
- `test_create` does not exist → use `test_create_template` to generate test script templates
- `test_get_status` does not exist → use `test_get_result` with `jobId` from test run
- Test skills are async — they return a `jobId`, poll with `test_get_result(jobId)`

**Routing**:
- For compile error checking → use `debug` module's `debug_check_compilation`
- For test script creation → `test_create_template` (this module), then modify via `script` module

## Skills

### `test_list`
List available tests.
**Parameters:**
- `testMode` (string, optional): EditMode or PlayMode. Default: EditMode.
- `limit` (int, optional): Max tests to list. Default: 100.

### `test_run`
Run Unity tests (returns job ID for polling).
**Parameters:**
- `testMode` (string, optional): EditMode or PlayMode. Default: EditMode.
- `filter` (string, optional): Test name filter.

### `test_get_result`
Get the result of a test run.
**Parameters:**
- `jobId` (string): Job ID from test_run.

### `test_cancel`
Cancel a running test.
**Parameters:**
- `jobId` (string, optional): Job ID to cancel.

### `test_run_by_name`
Run specific tests by class or method name.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| testName | string | Yes | - | Test class or method name to run |
| testMode | string | No | EditMode | EditMode or PlayMode |

**Returns:** `{ success, jobId, testName, testMode }`

### `test_get_last_result`
Get the most recent test run result.

No parameters.

**Returns:** `{ jobId, status, total, passed, failed, failedNames }`

### `test_list_categories`
List test categories.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| testMode | string | No | EditMode | EditMode or PlayMode |

**Returns:** `{ success, count, categories }`

### `test_smoke_skills`
Run a reusable smoke test across registered skills.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| category | string | No | - | Only test one skill category |
| nameContains | string | No | - | Filter skills by partial name |
| excludeNamesCsv | string | No | - | Comma-separated skill names to exclude |
| executeReadOnly | bool | No | true | Execute safe read-only skills directly |
| includeMutating | bool | No | true | Include mutating skills via dryRun smoke testing |
| limit | int | No | 0 | Max skills to inspect; 0 means all |

**Returns:** `{ success, totalSkills, executedCount, dryRunCount, failureCount, results }`

### `test_create_editmode`
Create an EditMode test script template.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| testName | string | Yes | - | Name of the test class to create |
| folder | string | No | Assets/Tests/Editor | Folder path for the test script |

**Returns:** `{ success, path, testName, serverAvailability }`

### `test_create_playmode`
Create a PlayMode test script template.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| testName | string | Yes | - | Name of the test class to create |
| folder | string | No | Assets/Tests/Runtime | Folder path for the test script |

**Returns:** `{ success, path, testName, serverAvailability }`

### `test_get_summary`
Get aggregated test summary across all runs.

No parameters.

**Returns:** `{ success, totalRuns, completedRuns, totalPassed, totalFailed, allFailedTests }`

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### test_run
Run Unity tests asynchronously. Returns a platform jobId immediately. Poll with job_status/job_wait or test_get_result(jobId).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testMode` | string | No | "EditMode" | Canonical signature parameter |
| `filter` | string | No | null | Canonical signature parameter |

### test_get_result
Get the result of a test run. Compatible wrapper over the unified job model.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | Canonical signature parameter |

### test_list
List available tests

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testMode` | string | No | "EditMode" | Canonical signature parameter |
| `limit` | int | No | 100 | Canonical signature parameter |

### test_cancel
Cancel a running test job if supported. Unity TestRunner itself does not provide a hard cancel.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | No | null | Canonical signature parameter |

### test_run_by_name
Run specific tests by class or method name. Returns a unified jobId.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testName` | string | Yes | - | Canonical signature parameter |
| `testMode` | string | No | "EditMode" | Canonical signature parameter |

### test_get_last_result
Get the most recent test run result

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### test_list_categories
List test categories

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testMode` | string | No | "EditMode" | Canonical signature parameter |

### test_smoke_skills
Run a reusable smoke test across registered skills. Executes safe read-only skills and dry-runs the rest for broad regression coverage.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | No | null | Canonical signature parameter |
| `nameContains` | string | No | null | Canonical signature parameter |
| `excludeNamesCsv` | string | No | null | Canonical signature parameter |
| `executeReadOnly` | bool | No | True | Canonical signature parameter |
| `includeMutating` | bool | No | True | Canonical signature parameter |
| `limit` | int | No | 0 | Canonical signature parameter |

### test_create_editmode
Create an EditMode test script template and return a compile-monitor job.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testName` | string | Yes | - | Canonical signature parameter |
| `folder` | string | No | "Assets/Tests/Editor" | Canonical signature parameter |

### test_create_playmode
Create a PlayMode test script template and return a compile-monitor job.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `testName` | string | Yes | - | Canonical signature parameter |
| `folder` | string | No | "Assets/Tests/Runtime" | Canonical signature parameter |

### test_get_summary
Get aggregated test summary across all runs

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |
