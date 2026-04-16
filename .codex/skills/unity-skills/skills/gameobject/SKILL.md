---
name: unity-gameobject
description: "GameObject creation and manipulation. Use when users want to create, delete, move, rotate, scale, or parent GameObjects. Triggers: gameobject, create, delete, transform, position, rotation, scale, parent, hierarchy, 游戏对象, Unity创建, Unity删除, Unity移动, Unity旋转, Unity缩放."
---

# Unity GameObject Skills

> **BATCH-FIRST**: Use `*_batch` skills when operating on 2+ objects to reduce API calls from N to 1.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- `gameobject_move` / `gameobject_rotate` / `gameobject_set_scale` do not exist → use `gameobject_set_transform` (handles position, rotation, and scale together)
- `gameobject_set_position` does not exist → use `gameobject_set_transform` with `posX/posY/posZ`
- `gameobject_add_component` does not exist → use `component_add` (component module)
- `gameobject_get_transform` does not exist → use `gameobject_get_info` (returns position/rotation/scale)

**Routing**:
- To add/remove components → use `component` module
- To set material/color → use `material` module
- To search objects by name/tag/component → `gameobject_find` (this module) or `scene_find_objects` (scene module, Semi-Auto)

> **Object Targeting**: All single-object skills accept three identifiers: `name` (string), `instanceId` (int, preferred for precision), `path` (string, hierarchy path like "Parent/Child"). Provide at least one. When only `name` is shown in a parameter table, `instanceId` and `path` are also accepted.

## Skills Overview

| Single Object | Batch Version | Use Batch When |
|---------------|---------------|----------------|
| `gameobject_create` | `gameobject_create_batch` | Creating 2+ objects |
| `gameobject_delete` | `gameobject_delete_batch` | Deleting 2+ objects |
| `gameobject_duplicate` | `gameobject_duplicate_batch` | Duplicating 2+ objects |
| `gameobject_rename` | `gameobject_rename_batch` | Renaming 2+ objects |
| `gameobject_set_transform` | `gameobject_set_transform_batch` | Moving 2+ objects |
| `gameobject_set_active` | `gameobject_set_active_batch` | Toggling 2+ objects |
| `gameobject_set_parent` | `gameobject_set_parent_batch` | Parenting 2+ objects |
| - | `gameobject_set_layer_batch` | Setting layer on 2+ objects |
| - | `gameobject_set_tag_batch` | Setting tag on 2+ objects |

**Query Skills** (no batch needed):
- `gameobject_find` - Find objects by name/tag/layer/component
- `gameobject_get_info` - Get detailed object information

---

## Single-Object Skills

### gameobject_create
Create a new GameObject (primitive or empty).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | "GameObject" | Object name |
| `primitiveType` | string | No | null | Cube/Sphere/Capsule/Cylinder/Plane/Quad (null=Empty) |
| `x`, `y`, `z` | float | No | 0 | Local position (relative to parent if set) |
| `parentName` | string | No | null | Parent object name |
| `parentInstanceId` | int | No | 0 | Parent instance ID |
| `parentPath` | string | No | null | Parent hierarchy path |

**Returns**: `{success, name, instanceId, path, parent, position}`

### gameobject_delete
Delete a GameObject.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Object name |
| `instanceId` | int | No* | Instance ID (preferred) |
| `path` | string | No* | Hierarchy path |

*At least one identifier required

### gameobject_duplicate
Duplicate a GameObject.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Object name |
| `instanceId` | int | No* | Instance ID |
| `path` | string | No* | Hierarchy path |

**Returns**: `{originalName, copyName, copyInstanceId, copyPath}`

### gameobject_rename
Rename a GameObject.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Current object name |
| `instanceId` | int | No* | Instance ID (preferred) |
| `newName` | string | Yes | New name |

**Returns**: `{success, oldName, newName, instanceId}`

### gameobject_find
Find GameObjects matching criteria.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Name filter |
| `tag` | string | No | null | Tag filter |
| `layer` | int | No | -1 | Layer filter |
| `component` | string | No | null | Component type filter |
| `useRegex` | bool | No | false | Use regex for name |
| `limit` | int | No | 100 | Max results |

**Returns**: `{count, objects: [{name, instanceId, path, tag, layer}]}`

### gameobject_get_info
Get detailed GameObject information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Object name |
| `instanceId` | int | No* | Instance ID |
| `path` | string | No* | Hierarchy path |

**Returns**: `{name, instanceId, path, tag, layer, active, position, rotation, scale, components, children}`

### gameobject_set_transform
Set position, rotation, and/or scale.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Object name |
| `instanceId` | int | No* | Instance ID (preferred) |
| `path` | string | No* | Hierarchy path |
| `posX/posY/posZ` | float | No | Position |
| `rotX/rotY/rotZ` | float | No | Rotation (euler) |
| `scaleX/scaleY/scaleZ` | float | No | Scale |

*At least one identifier required

### gameobject_set_parent
Set parent-child relationship.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `childName` | string | No* | Child object name |
| `childInstanceId` | int | No* | Child Instance ID (preferred) |
| `childPath` | string | No* | Child hierarchy path |
| `parentName` | string | No* | Parent object name (empty string = unparent) |
| `parentInstanceId` | int | No* | Parent Instance ID |
| `parentPath` | string | No* | Parent hierarchy path |

*At least one child identifier and one parent identifier required

### gameobject_set_active
Enable or disable a GameObject.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | No* | Object name |
| `instanceId` | int | No* | Instance ID (preferred) |
| `path` | string | No* | Hierarchy path |
| `active` | bool | Yes | Enable state |

*At least one identifier required

---

## Batch Skills

### gameobject_create_batch
Create multiple GameObjects in one call.

**Item properties**: `name`, `primitiveType`, `x`, `y`, `z`, `rotX`, `rotY`, `rotZ`, `scaleX`, `scaleY`, `scaleZ`, `parentName`, `parentInstanceId`, `parentPath`

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name, instanceId, path, position}]}`

```python
unity_skills.call_skill("gameobject_create_batch", items=[
    {"name": "Parent", "primitiveType": "Empty"},
    {"name": "Child1", "primitiveType": "Cube", "x": 0, "parentName": "Parent"},
    {"name": "Child2", "primitiveType": "Sphere", "x": 2, "parentName": "Parent"}
])
```

### gameobject_delete_batch
Delete multiple GameObjects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name}]}`

```python
# By names
unity_skills.call_skill("gameobject_delete_batch", items=["Cube1", "Cube2", "Cube3"])

# By instanceId (preferred for precision)
unity_skills.call_skill("gameobject_delete_batch", items=[
    {"instanceId": 12345},
    {"instanceId": 12346}
])

# By path
unity_skills.call_skill("gameobject_delete_batch", items=[
    {"path": "Environment/Cube1"},
    {"path": "Environment/Cube2"}
])
```

### gameobject_duplicate_batch
Duplicate multiple GameObjects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, originalName, copyName, copyInstanceId, copyPath}]}`

```python
unity_skills.call_skill("gameobject_duplicate_batch", items=[
    {"instanceId": 12345},
    {"instanceId": 12346}
])
```

### gameobject_rename_batch
Rename multiple GameObjects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, oldName, newName, instanceId}]}`

```python
unity_skills.call_skill("gameobject_rename_batch", items=[
    {"instanceId": 12345, "newName": "Enemy_01"},
    {"instanceId": 12346, "newName": "Enemy_02"}
])
```

### gameobject_set_transform_batch
Set transforms for multiple objects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name, position, rotation, scale}]}`

```python
unity_skills.call_skill("gameobject_set_transform_batch", items=[
    {"name": "Cube1", "posX": 0, "posY": 1},
    {"instanceId": 12345, "posX": 2, "posY": 1},
    {"path": "Env/Cube3", "posX": 4, "posY": 1}
])
```

### gameobject_set_active_batch
Toggle multiple objects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name, active}]}`

```python
unity_skills.call_skill("gameobject_set_active_batch", items=[
    {"name": "Enemy1", "active": False},
    {"name": "Enemy2", "active": False}
])
```

### gameobject_set_parent_batch
Parent multiple objects. Each item supports `childName`/`childInstanceId`/`childPath` and `parentName`/`parentInstanceId`/`parentPath`.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, child, parent}]}`

```python
unity_skills.call_skill("gameobject_set_parent_batch", items=[
    {"childName": "Wheel1", "parentName": "Car"},
    {"childInstanceId": 12345, "parentName": "Car"},
    {"childPath": "Wheels/Wheel3", "parentPath": "Vehicles/Car"}
])
```

### gameobject_set_layer_batch
Set layer for multiple objects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name, layer}]}`

```python
unity_skills.call_skill("gameobject_set_layer_batch", items=[
    {"name": "Enemy1", "layer": 8},
    {"name": "Enemy2", "layer": 8}
])
```

### gameobject_set_tag_batch
Set tag for multiple objects.

**Returns**: `{success, totalItems, successCount, failCount, results: [{success, name, tag}]}`

```python
unity_skills.call_skill("gameobject_set_tag_batch", items=[
    {"name": "Enemy1", "tag": "Enemy"},
    {"name": "Enemy2", "tag": "Enemy"}
])
```

---

## Example: Efficient Scene Setup

```python
import unity_skills

# BAD: 6 API calls
unity_skills.call_skill("gameobject_create", name="Floor", primitiveType="Plane")
unity_skills.call_skill("gameobject_create", name="Wall1", primitiveType="Cube")
unity_skills.call_skill("gameobject_create", name="Wall2", primitiveType="Cube")
unity_skills.call_skill("gameobject_set_transform", name="Wall1", posX=-5, scaleY=3)
unity_skills.call_skill("gameobject_set_transform", name="Wall2", posX=5, scaleY=3)
unity_skills.call_skill("gameobject_set_tag_batch", items=[{"name": "Wall1", "tag": "Wall"}, {"name": "Wall2", "tag": "Wall"}])

# GOOD: 3 API calls
unity_skills.call_skill("gameobject_create_batch", items=[
    {"name": "Floor", "primitiveType": "Plane"},
    {"name": "Wall1", "primitiveType": "Cube"},
    {"name": "Wall2", "primitiveType": "Cube"}
])
unity_skills.call_skill("gameobject_set_transform_batch", items=[
    {"name": "Wall1", "posX": -5, "scaleY": 3},
    {"name": "Wall2", "posX": 5, "scaleY": 3}
])
unity_skills.call_skill("gameobject_set_tag_batch", items=[
    {"name": "Wall1", "tag": "Wall"},
    {"name": "Wall2", "tag": "Wall"}
])
```

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### gameobject_create_batch
Create multiple GameObjects in one call (Efficient). items: JSON array of {name, primitiveType, x, y, z, parentName, parentInstanceId, parentPath}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_create
Create a new GameObject. primitiveType: Cube, Sphere, Capsule, Cylinder, Plane, Quad, or Empty/null for empty object

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Canonical signature parameter |
| `primitiveType` | string | No | null | Canonical signature parameter |
| `x` | float | No | 0 | Canonical signature parameter |
| `y` | float | No | 0 | Canonical signature parameter |
| `z` | float | No | 0 | Canonical signature parameter |
| `parentName` | string | No | null | Canonical signature parameter |
| `parentInstanceId` | int | No | 0 | Canonical signature parameter |
| `parentPath` | string | No | null | Canonical signature parameter |

### gameobject_rename
Rename a GameObject (supports name/instanceId/path). Returns: {success, oldName, newName, instanceId}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `newName` | string | No | null | Canonical signature parameter |

### gameobject_rename_batch
Rename multiple GameObjects in one call (Efficient). items: JSON array of {name, instanceId, path, newName}. Returns array with oldName, newName for each.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_delete
Delete a GameObject (supports name/instanceId/path)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |

### gameobject_delete_batch
Delete multiple GameObjects. items: JSON array of strings (names) or objects {name, instanceId, path}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_find
Find GameObjects by name/regex, tag, layer, or component

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `useRegex` | bool | No | false | Canonical signature parameter |
| `tag` | string | No | null | Canonical signature parameter |
| `layer` | string | No | null | Canonical signature parameter |
| `component` | string | No | null | Canonical signature parameter |
| `limit` | int | No | 50 | Canonical signature parameter |

### gameobject_set_transform
Set transform properties. For UI/RectTransform: use anchorX/Y, pivotX/Y, sizeDeltaX/Y. For 3D: use posX/Y/Z, rotX/Y/Z, scaleX/Y/Z

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `posX` | float? | No | null | Canonical signature parameter |
| `posY` | float? | No | null | Canonical signature parameter |
| `posZ` | float? | No | null | Canonical signature parameter |
| `rotX` | float? | No | null | Canonical signature parameter |
| `rotY` | float? | No | null | Canonical signature parameter |
| `rotZ` | float? | No | null | Canonical signature parameter |
| `scaleX` | float? | No | null | Canonical signature parameter |
| `scaleY` | float? | No | null | Canonical signature parameter |
| `scaleZ` | float? | No | null | Canonical signature parameter |
| `localPosX` | float? | No | null | Canonical signature parameter |
| `localPosY` | float? | No | null | Canonical signature parameter |
| `localPosZ` | float? | No | null | Canonical signature parameter |
| `anchoredPosX` | float? | No | null | Canonical signature parameter |
| `anchoredPosY` | float? | No | null | Canonical signature parameter |
| `anchorMinX` | float? | No | null | Canonical signature parameter |
| `anchorMinY` | float? | No | null | Canonical signature parameter |
| `anchorMaxX` | float? | No | null | Canonical signature parameter |
| `anchorMaxY` | float? | No | null | Canonical signature parameter |
| `pivotX` | float? | No | null | Canonical signature parameter |
| `pivotY` | float? | No | null | Canonical signature parameter |
| `sizeDeltaX` | float? | No | null | Canonical signature parameter |
| `sizeDeltaY` | float? | No | null | Canonical signature parameter |
| `width` | float? | No | null | Canonical signature parameter |
| `height` | float? | No | null | Canonical signature parameter |

### gameobject_set_transform_batch
Set transform properties for multiple objects (Efficient). items: JSON array of objects with optional fields (name, posX, rotX, scaleX, etc.)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_duplicate
Duplicate a GameObject (supports name/instanceId/path). Returns: originalName, copyName, copyInstanceId, copyPath

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |

### gameobject_duplicate_batch
Duplicate multiple GameObjects in one call (Efficient). items: JSON array of {name, instanceId, path}. Returns array with originalName, copyName, copyInstanceId for each.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_set_parent
Set the parent of a GameObject (supports name/instanceId/path)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `childName` | string | No | null | Canonical signature parameter |
| `childInstanceId` | int | No | 0 | Canonical signature parameter |
| `childPath` | string | No | null | Canonical signature parameter |
| `parentName` | string | No | null | Canonical signature parameter |
| `parentInstanceId` | int | No | 0 | Canonical signature parameter |
| `parentPath` | string | No | null | Canonical signature parameter |

### gameobject_get_info
Get detailed info about a GameObject (supports name/instanceId/path)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |

### gameobject_set_active
Enable or disable a GameObject (supports name/instanceId/path)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `active` | bool | No | true | Canonical signature parameter |

### gameobject_set_active_batch
Enable or disable multiple GameObjects. items: JSON array of {name, active}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_set_layer_batch
Set layer for multiple GameObjects. items: JSON array of {name, layer, recursive}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_set_tag_batch
Set tag for multiple GameObjects. items: JSON array of {name, tag}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |

### gameobject_set_parent_batch
Set parent for multiple GameObjects. items: JSON array of {childName, parentName, ...}

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `items` | string | Yes | - | Canonical signature parameter |
