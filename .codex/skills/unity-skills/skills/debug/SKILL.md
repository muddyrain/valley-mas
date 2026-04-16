---
name: unity-debug
description: "Debug and diagnostics. Use when users want to check compilation errors, get system info, or debug issues. Triggers: debug, error, compilation, recompile, system info, diagnostics, Unity调试, Unity编译错误, Unity诊断."
---

# Debug Skills

Debug utilities for error checking and diagnostics.

## Guardrails

**Mode**: Semi-Auto (available by default)

**DO NOT** (common hallucinations):
- `debug_compile` / `debug_recompile` do not exist → use `debug_force_recompile`
- `debug_run` does not exist → use `editor_play` (editor module)
- `debug_clear` does not exist → use `console_clear` (console module)
- `debug_set_defines` triggers Domain Reload — server will be temporarily unavailable

**Routing**:
- For runtime console logs → use `console` module's `console_get_logs` / `console_start_capture`
- For play mode control → use `editor` module
- For script compile feedback → use `script` module's `script_get_compile_feedback`

## Skills

### `debug_get_logs`
Get console logs filtered by type and content.
**Parameters:**
- `type` (string, optional): Filter by type (Error/Warning/Log). Default: Error.
- `filter` (string, optional): Filter by content.
- `limit` (int, optional): Max entries. Default: 50.

### `debug_get_errors`
Get only active errors and exceptions from console.
**Parameters:**
- `limit` (int, optional): Max entries. Default: 50.

### `debug_check_compilation`
Check if there are any compilation errors.
**Parameters:** None.

### `debug_force_recompile`
Force Unity to recompile all scripts.
**Parameters:** None.

### `debug_get_system_info`
Get system and Unity environment information.
**Parameters:** None.

### `debug_get_stack_trace`
Get stack trace for a log entry by index.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| entryIndex | int | Yes | - | Index of the log entry to retrieve stack trace for |

**Returns:** `{ index, message, stackTrace }`

### `debug_get_assembly_info`
Get project assembly information.

**Parameters:** None.

**Returns:** `{ success, count, assemblies }`

### `debug_get_defines`
Get scripting define symbols for current platform.

**Parameters:** None.

**Returns:** `{ success, buildTargetGroup, defines }`

### `debug_set_defines`
Set scripting define symbols for current platform.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| defines | string | Yes | - | Scripting define symbols to set |

**Returns:** `{ success, buildTargetGroup, defines, serverAvailability }`

### `debug_get_memory_info`
Get memory usage information.

**Parameters:** None.

**Returns:** `{ success, totalAllocatedMB, totalReservedMB, totalUnusedReservedMB, monoUsedSizeMB, monoHeapSizeMB }`

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### debug_get_errors
Get only errors and exceptions from Unity Console logs. Reads existing console history directly (no setup needed). For all log types use console_get_logs.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | int | No | 50 | Canonical signature parameter |

### debug_get_logs
Get console logs filtered by type (Error/Warning/Log) and content. Reads existing console history directly (no setup needed). Prefer console_get_logs for all-type queries with timestamp support.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | "Error" | Canonical signature parameter |
| `filter` | string | No | null | Canonical signature parameter |
| `limit` | int | No | 50 | Canonical signature parameter |

### debug_check_compilation
Check if Unity is currently compiling scripts.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### debug_force_recompile
Force script recompilation.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### debug_get_system_info
Get Editor and System capabilities.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### debug_get_stack_trace
Get stack trace for a log entry by index

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `entryIndex` | int | Yes | - | Canonical signature parameter |

### debug_get_assembly_info
Get project assembly information

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### debug_get_defines
Get scripting define symbols for current platform

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### debug_set_defines
Set scripting define symbols for current platform

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `defines` | string | Yes | - | Canonical signature parameter |

### debug_get_memory_info
Get memory usage information

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |
