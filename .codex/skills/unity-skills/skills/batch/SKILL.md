---
name: unity-batch
description: "Batch query, preview, execute, and async job orchestration for UnitySkills. Use when users want batch previews, confirmation tokens, reports, or async job polling. Triggers: batch, preview, confirmToken, report, job_status, job_wait, bulk workflow, 批处理, 预览执行, 作业状态."
---

# Unity Batch Skills

Batch workflow orchestration for query, preview, execution, reports, and async jobs.

## Skills

### batch_query_gameobjects
Query GameObjects with unified batch filters. `queryJson` supports `name/path/instanceId/tag/layer/active/componentType/sceneName/parentPath/prefabSource/includeInactive/limit`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `sampleLimit` | int | No | 20 | Max sample objects returned |

### batch_query_components
Query components with unified batch filters. Optional `componentType` narrows the result.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `componentType` | string | No | null | Optional component type constraint |
| `sampleLimit` | int | No | 20 | Max sample objects returned |

### batch_preview_rename
Preview batch renaming. `mode` supports `prefix` / `suffix` / `replace` / `regex_replace`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `mode` | string | No | "prefix" | Rename mode |
| `prefix` | string | No | null | Prefix to add |
| `suffix` | string | No | null | Suffix to add |
| `search` | string | No | null | Plain text search term |
| `replacement` | string | No | null | Plain text replacement |
| `regexPattern` | string | No | null | Regex search pattern |
| `regexReplacement` | string | No | null | Regex replacement text |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_preview_set_property
Preview setting a component property or field across queried targets.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `componentType` | string | No | null | Target component type |
| `propertyName` | string | No | null | Property or field name |
| `value` | string | No | null | Literal value |
| `referencePath` | string | No | null | Scene reference path |
| `referenceName` | string | No | null | Scene reference object name |
| `assetPath` | string | No | null | Asset reference path |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_preview_replace_material
Preview replacing Renderer materials across queried targets.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `materialPath` | string | No | null | Replacement material asset path |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_execute
Execute a previously previewed batch operation by `confirmToken`. Large operations return a `jobId`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `confirmToken` | string | Yes | - | Preview confirmation token |
| `runAsync` | bool | No | true | Run as async job |
| `chunkSize` | int | No | 100 | Batch execution chunk size |

### batch_report_get
Get a batch execution report by `reportId`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `reportId` | string | Yes | - | Batch report identifier |

### batch_report_list
List recent batch reports.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | int | No | 20 | Max reports returned |

### job_status
Get status for an asynchronous UnitySkills job.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | Job identifier |

### job_logs
Get structured logs for a UnitySkills job.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | Job identifier |
| `limit` | int | No | 100 | Max log entries returned |

### job_list
List recent UnitySkills jobs.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | int | No | 20 | Max jobs returned |

### job_wait
Wait for a UnitySkills job to finish or until `timeoutMs` elapses.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | Job identifier |
| `timeoutMs` | int | No | 10000 | Wait timeout in milliseconds |

### job_cancel
Cancel a UnitySkills job if the job supports cancellation.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | Job identifier |

### batch_fix_missing_scripts
Preview batch removal of missing scripts. Execute with `batch_execute(confirmToken)`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_standardize_naming
Preview standardizing names by trimming whitespace and normalizing separators. Execute with `batch_execute(confirmToken)`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `separator` | string | No | "_" | Replacement separator |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_set_render_layer
Preview setting GameObject layers in batch. Execute with `batch_execute(confirmToken)`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `layer` | string | No | null | Target layer name |
| `recursive` | bool | No | false | Apply recursively to children |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_replace_material
Preview replacing materials in batch. Execute with `batch_execute(confirmToken)`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `materialPath` | string | No | null | Replacement material asset path |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |

### batch_validate_scene_objects
Analyze scene objects for missing scripts, missing references, duplicate names, and empty objects.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `issueLimit` | int | No | 100 | Max issues returned |

### batch_cleanup_temp_objects
Preview deleting temporary helper objects by common temp-name patterns. Execute with `batch_execute(confirmToken)`.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `queryJson` | string | No | null | JSON query filter envelope |
| `patternsCsv` | string | No | null | Comma-separated temp-name patterns |
| `sampleLimit` | int | No | DefaultSampleLimit | Max preview items |
