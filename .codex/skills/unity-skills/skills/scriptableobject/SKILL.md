---
name: unity-scriptableobject
description: "ScriptableObject management. Use when users want to create, read, or modify ScriptableObject assets. Triggers: scriptableobject, SO, data asset, config, settings asset, 数据资产, 配置文件."
---

# ScriptableObject Skills

Create and manage ScriptableObject assets.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- `scriptableobject_create_type` does not exist → create SO scripts via `script_create` with template "ScriptableObject"
- `scriptableobject_get_properties` does not exist → use `scriptableobject_read`
- `scriptableobject_set_property` does not exist → use `scriptableobject_set_field`
- `scriptableobject_save` does not exist → changes are auto-saved to the asset

**Routing**:
- For ScriptableObject script creation → use `script` module with template "ScriptableObject"
- For JSON import/export → `scriptableobject_import_json` / `scriptableobject_export_json` (this module)

## Skills

### `scriptableobject_create`
Create a new ScriptableObject asset.
**Parameters:**
- `typeName` (string): ScriptableObject type name.
- `savePath` (string): Asset save path.

### `scriptableobject_get`
Get properties of a ScriptableObject.
**Parameters:**
- `assetPath` (string): Asset path.

### `scriptableobject_set`
Set a field/property on a ScriptableObject.
**Parameters:**
- `assetPath` (string): Asset path.
- `fieldName` (string): Field or property name.
- `value` (string): Value to set.

### `scriptableobject_list_types`
List available ScriptableObject types in the project.
**Parameters:**
- `filter` (string, optional): Filter by name.

### `scriptableobject_duplicate`
Duplicate a ScriptableObject asset.
**Parameters:**
- `sourcePath` (string): Source asset path.
- `destPath` (string): Destination path.

### `scriptableobject_set_batch`
Set multiple fields on a ScriptableObject at once. fields: JSON object {fieldName: value, ...}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| assetPath | string | Yes | - | Asset path of the ScriptableObject |
| fields | string | Yes | - | JSON object with field-value pairs, e.g. `{"fieldName": "value", ...}` |

**Returns:** `{ success, fieldsSet }`

### `scriptableobject_delete`
Delete a ScriptableObject asset.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| assetPath | string | Yes | - | Asset path of the ScriptableObject to delete |

**Returns:** `{ success, deleted }`

### `scriptableobject_find`
Find ScriptableObject assets by type name.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| typeName | string | Yes | - | ScriptableObject type name to search for |
| searchPath | string | No | `"Assets"` | Folder path to search within |
| limit | int | No | `50` | Maximum number of results to return |

**Returns:** `{ success, count, assets }`

### `scriptableobject_export_json`
Export a ScriptableObject to JSON.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| assetPath | string | Yes | - | Asset path of the ScriptableObject to export |
| savePath | string | No | `null` | File path to save the JSON output; if omitted, JSON is returned inline |

**Returns:** `{ success, path }` or `{ success, json }`

### `scriptableobject_import_json`
Import JSON data into a ScriptableObject.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| assetPath | string | Yes | - | Asset path of the target ScriptableObject |
| json | string | No | `null` | JSON string to import |
| jsonFilePath | string | No | `null` | Path to a JSON file to read and import |

**Returns:** `{ success, assetPath }`

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### scriptableobject_create
Create a new ScriptableObject asset

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `typeName` | string | Yes | - | Canonical signature parameter |
| `savePath` | string | Yes | - | Canonical signature parameter |

### scriptableobject_get
Get properties of a ScriptableObject

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |

### scriptableobject_set
Set a field/property on a ScriptableObject

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |
| `fieldName` | string | Yes | - | Canonical signature parameter |
| `value` | string | Yes | - | Canonical signature parameter |

### scriptableobject_list_types
List available ScriptableObject types

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `filter` | string | No | null | Canonical signature parameter |
| `limit` | int | No | 50 | Canonical signature parameter |

### scriptableobject_duplicate
Duplicate a ScriptableObject asset

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |

### scriptableobject_set_batch
Set multiple fields on a ScriptableObject at once. fields: JSON object {fieldName: value, ...}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |
| `fields` | string | Yes | - | Canonical signature parameter |

### scriptableobject_delete
Delete a ScriptableObject asset

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |

### scriptableobject_find
Find ScriptableObject assets by type name

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `typeName` | string | Yes | - | Canonical signature parameter |
| `searchPath` | string | No | "Assets" | Canonical signature parameter |
| `limit` | int | No | 50 | Canonical signature parameter |

### scriptableobject_export_json
Export a ScriptableObject to JSON

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |
| `savePath` | string | No | null | Canonical signature parameter |

### scriptableobject_import_json
Import JSON data into a ScriptableObject

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetPath` | string | Yes | - | Canonical signature parameter |
| `json` | string | No | null | Canonical signature parameter |
| `jsonFilePath` | string | No | null | Canonical signature parameter |
