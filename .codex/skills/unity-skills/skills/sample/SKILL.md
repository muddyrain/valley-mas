---
name: unity-sample
description: "Sample scene generators and API test utilities. Use when users want to generate example scenes, test API connectivity, or create demo objects for learning. Triggers: test, sample, hello, ping, demo, example, 示例, Unity测试, Unity演示."
---

# Sample Skills

Basic examples for testing the API.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- Sample skills are basic test/demo skills — do not use them for production work
- `sample_create` is a simplified version of `gameobject_create` — prefer the full gameobject module
- `sample_hello` / `sample_ping` are connectivity test skills only

**Routing**:
- For actual GameObject operations → use `gameobject` module
- For server health check → use Python helper's `unity_skills.health()`

## Skills

### create_cube
Create a cube primitive.
**Parameters:** `x`, `y`, `z`, `name`

### create_sphere
Create a sphere primitive.
**Parameters:** `x`, `y`, `z`, `name`

### delete_object
Delete object by name.
**Parameters:** `objectName`

### `find_objects_by_name`
Find objects containing string.
**Parameters:** `nameContains`

### `set_object_position`
Set object position.
**Parameters:** `objectName`, `x`, `y`, `z`

### `set_object_rotation`
Set object rotation.
**Parameters:** `objectName`, `x`, `y`, `z`

### `set_object_scale`
Set object scale.
**Parameters:** `objectName`, `x`, `y`, `z`

### `get_scene_info`
Get current scene information.
**Parameters:** None.

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### create_cube
Create a cube at the specified position

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | No | 0 | Canonical signature parameter |
| `y` | float | No | 0 | Canonical signature parameter |
| `z` | float | No | 0 | Canonical signature parameter |
| `name` | string | No | "Cube" | Canonical signature parameter |

### create_sphere
Create a sphere at the specified position

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | No | 0 | Canonical signature parameter |
| `y` | float | No | 0 | Canonical signature parameter |
| `z` | float | No | 0 | Canonical signature parameter |
| `name` | string | No | "Sphere" | Canonical signature parameter |

### delete_object
Delete a GameObject by name

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `objectName` | string | Yes | - | Canonical signature parameter |

### get_scene_info
Get current scene information

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### set_object_position
Set position of a GameObject

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `objectName` | string | Yes | - | Canonical signature parameter |
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |

### set_object_rotation
Set rotation of a GameObject (Euler angles)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `objectName` | string | Yes | - | Canonical signature parameter |
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |

### set_object_scale
Set scale of a GameObject

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `objectName` | string | Yes | - | Canonical signature parameter |
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |

### find_objects_by_name
Find all GameObjects containing a name (param: nameContains)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `nameContains` | string | Yes | - | Canonical signature parameter |
