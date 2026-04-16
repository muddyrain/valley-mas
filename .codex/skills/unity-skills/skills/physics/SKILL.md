---
name: unity-physics
description: "Unity physics operations. Use when users want to perform raycasts, overlap checks, or configure gravity. Triggers: physics, raycast, overlap, gravity, collision, layer mask, 物理, 射线检测, 重力, 碰撞."
---

# Physics Skills

Raycasts, overlap checks, and gravity settings.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- `physics_add_rigidbody` / `physics_add_collider` do not exist → use `component_add` with componentType "Rigidbody"/"BoxCollider"/etc.
- `physics_set_gravity` does not exist → use `project` module's `project_set_physics` or `component_set_property` on Rigidbody
- `physics_simulate` does not exist → physics simulation runs during Play mode
- Raycast results use world-space coordinates

**Routing**:
- For adding physics components → use `component` module
- For physics material → use `physics_create_material` (this module)
- For layer collision matrix → `physics_set_layer_collision` (this module)

## Skills

### `physics_raycast`
Cast a ray and get hit info.
**Parameters:**
- `originX`, `originY`, `originZ` (float): Origin point.
- `dirX`, `dirY`, `dirZ` (float): Direction vector.
- `maxDistance` (float, optional): Max distance (default 1000).
- `layerMask` (int, optional): Layer mask (default -1).

**Returns:** `{ hit: true, collider: "Cube", distance: 5.2, ... }`

### `physics_check_overlap`
Check for colliders in a sphere.
**Parameters:**
- `x`, `y`, `z` (float): Center point.
- `radius` (float): Sphere radius.
- `layerMask` (int, optional): Layer mask.

### `physics_get_gravity`
Get global gravity setting.
**Parameters:** None.

### `physics_set_gravity`
Set global gravity setting.
**Parameters:**
- `x`, `y`, `z` (float): Gravity vector (e.g. 0, -9.81, 0).

### `physics_raycast_all`
Cast a ray and return ALL hits (penetrating).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| originX | float | Yes | - | Ray origin X |
| originY | float | Yes | - | Ray origin Y |
| originZ | float | Yes | - | Ray origin Z |
| dirX | float | Yes | - | Direction X |
| dirY | float | Yes | - | Direction Y |
| dirZ | float | Yes | - | Direction Z |
| maxDistance | float | No | 1000 | Max ray distance |
| layerMask | int | No | -1 | Layer mask filter |

**Returns:** `{ count, hits: [{ objectName, instanceId, path, point, normal, distance }] }`

### `physics_spherecast`
Cast a sphere along a direction and get hit info.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| originX | float | Yes | - | Origin X |
| originY | float | Yes | - | Origin Y |
| originZ | float | Yes | - | Origin Z |
| dirX | float | Yes | - | Direction X |
| dirY | float | Yes | - | Direction Y |
| dirZ | float | Yes | - | Direction Z |
| radius | float | Yes | - | Sphere radius |
| maxDistance | float | No | 1000 | Max cast distance |
| layerMask | int | No | -1 | Layer mask filter |

**Returns:** `{ hit, objectName, instanceId, point, distance }`

### `physics_boxcast`
Cast a box along a direction and get hit info.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| originX | float | Yes | - | Origin X |
| originY | float | Yes | - | Origin Y |
| originZ | float | Yes | - | Origin Z |
| dirX | float | Yes | - | Direction X |
| dirY | float | Yes | - | Direction Y |
| dirZ | float | Yes | - | Direction Z |
| halfExtentX | float | No | 0.5 | Box half extent X |
| halfExtentY | float | No | 0.5 | Box half extent Y |
| halfExtentZ | float | No | 0.5 | Box half extent Z |
| maxDistance | float | No | 1000 | Max cast distance |
| layerMask | int | No | -1 | Layer mask filter |

**Returns:** `{ hit, objectName, instanceId, point, distance }`

### `physics_overlap_box`
Check for colliders overlapping a box volume.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | float | Yes | - | Box center X |
| y | float | Yes | - | Box center Y |
| z | float | Yes | - | Box center Z |
| halfExtentX | float | No | 0.5 | Box half extent X |
| halfExtentY | float | No | 0.5 | Box half extent Y |
| halfExtentZ | float | No | 0.5 | Box half extent Z |
| layerMask | int | No | -1 | Layer mask filter |

**Returns:** `{ count, colliders: [{ objectName, path, isTrigger }] }`

### `physics_create_material`
Create a PhysicMaterial asset.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | "New PhysicMaterial" | Material name |
| savePath | string | No | "Assets" | Save directory path |
| dynamicFriction | float | No | 0.6 | Dynamic friction value |
| staticFriction | float | No | 0.6 | Static friction value |
| bounciness | float | No | 0 | Bounciness value |

**Returns:** `{ success, path }`

### `physics_set_material`
Set PhysicMaterial on a collider (supports name/instanceId/path).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| materialPath | string | Yes | - | Asset path of the PhysicMaterial |
| name | string | No | null | GameObject name |
| instanceId | int | No | 0 | GameObject instance ID |
| path | string | No | null | GameObject hierarchy path |

**Returns:** `{ success, gameObject, material }`

### `physics_get_layer_collision`
Get whether two layers collide.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| layer1 | int | Yes | - | First layer index |
| layer2 | int | Yes | - | Second layer index |

**Returns:** `{ layer1, layer2, collisionEnabled }`

### `physics_set_layer_collision`
Set whether two layers collide.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| layer1 | int | Yes | - | First layer index |
| layer2 | int | Yes | - | Second layer index |
| enableCollision | bool | No | true | Whether to enable collision |

**Returns:** `{ success, layer1, layer2, collisionEnabled }`

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### physics_raycast
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `originX` | float | Yes | - | Canonical signature parameter |
| `originY` | float | Yes | - | Canonical signature parameter |
| `originZ` | float | Yes | - | Canonical signature parameter |
| `dirX` | float | Yes | - | Canonical signature parameter |
| `dirY` | float | Yes | - | Canonical signature parameter |
| `dirZ` | float | Yes | - | Canonical signature parameter |
| `maxDistance` | float | No | 1000f | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_check_overlap
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |
| `radius` | float | Yes | - | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_get_gravity
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### physics_set_gravity
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |

### physics_raycast_all
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `originX` | float | Yes | - | Canonical signature parameter |
| `originY` | float | Yes | - | Canonical signature parameter |
| `originZ` | float | Yes | - | Canonical signature parameter |
| `dirX` | float | Yes | - | Canonical signature parameter |
| `dirY` | float | Yes | - | Canonical signature parameter |
| `dirZ` | float | Yes | - | Canonical signature parameter |
| `maxDistance` | float | No | 1000f | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_spherecast
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `originX` | float | Yes | - | Canonical signature parameter |
| `originY` | float | Yes | - | Canonical signature parameter |
| `originZ` | float | Yes | - | Canonical signature parameter |
| `dirX` | float | Yes | - | Canonical signature parameter |
| `dirY` | float | Yes | - | Canonical signature parameter |
| `dirZ` | float | Yes | - | Canonical signature parameter |
| `radius` | float | Yes | - | Canonical signature parameter |
| `maxDistance` | float | No | 1000f | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_boxcast
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `originX` | float | Yes | - | Canonical signature parameter |
| `originY` | float | Yes | - | Canonical signature parameter |
| `originZ` | float | Yes | - | Canonical signature parameter |
| `dirX` | float | Yes | - | Canonical signature parameter |
| `dirY` | float | Yes | - | Canonical signature parameter |
| `dirZ` | float | Yes | - | Canonical signature parameter |
| `halfExtentX` | float | No | 0.5f | Canonical signature parameter |
| `halfExtentY` | float | No | 0.5f | Canonical signature parameter |
| `halfExtentZ` | float | No | 0.5f | Canonical signature parameter |
| `maxDistance` | float | No | 1000f | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_overlap_box
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |
| `halfExtentX` | float | No | 0.5f | Canonical signature parameter |
| `halfExtentY` | float | No | 0.5f | Canonical signature parameter |
| `halfExtentZ` | float | No | 0.5f | Canonical signature parameter |
| `layerMask` | int | No | -1 | Canonical signature parameter |

### physics_create_material
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | "New PhysicMaterial" | Canonical signature parameter |
| `savePath` | string | No | "Assets" | Canonical signature parameter |
| `dynamicFriction` | float | No | 0.6f | Canonical signature parameter |
| `staticFriction` | float | No | 0.6f | Canonical signature parameter |
| `bounciness` | float | No | 0f | Canonical signature parameter |

### physics_set_material
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `materialPath` | string | Yes | - | Canonical signature parameter |
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |

### physics_get_layer_collision
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layer1` | int | Yes | - | Canonical signature parameter |
| `layer2` | int | Yes | - | Canonical signature parameter |

### physics_set_layer_collision
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layer1` | int | Yes | - | Canonical signature parameter |
| `layer2` | int | Yes | - | Canonical signature parameter |
| `enableCollision` | bool | No | true | Canonical signature parameter |
