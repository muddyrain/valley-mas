---
name: unity-navmesh
description: "Navigation mesh operations. Use when users want to bake NavMesh or calculate paths for AI navigation. Triggers: navmesh, navigation, pathfinding, bake, AI, agent, obstacle, 导航网格, 寻路, 烘焙."
---

# NavMesh Skills

Baking and pathfinding.

## Guardrails

**Mode**: Full-Auto required

**DO NOT** (common hallucinations):
- `navmesh_create` does not exist → use `navmesh_bake` to generate NavMesh
- `navmesh_set_agent` does not exist → use `component_add` with "NavMeshAgent", then `component_set_property`
- `navmesh_add_obstacle` does not exist → use `component_add` with "NavMeshObstacle"
- NavMesh must be re-baked after scene geometry changes

**Routing**:
- For NavMeshAgent/NavMeshObstacle components → use `component` module
- For path calculation → `navmesh_calculate_path` (this module)

## Skills

### `navmesh_bake`
Bake the NavMesh (Synchronous). **Warning: Can be slow.**
**Parameters:** None.

### `navmesh_clear`
Clear the NavMesh data.
**Parameters:** None.

### `navmesh_calculate_path`
Calculate a path between two points.
**Parameters:**
- `startX`, `startY`, `startZ` (float): Start position.
- `endX`, `endY`, `endZ` (float): End position.
- `areaMask` (int, optional): NavMesh area mask.

**Returns:** `{ status: "PathComplete", distance: 12.5, corners: [...] }`

### `navmesh_add_agent`
Add NavMeshAgent component to an object.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | null | GameObject name |
| instanceId | int | No | 0 | GameObject instance ID |
| path | string | No | null | GameObject hierarchy path |

**Returns:** `{ success, gameObject }`

### `navmesh_set_agent`
Set NavMeshAgent properties (speed, acceleration, radius, height, stoppingDistance).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | null | GameObject name |
| instanceId | int | No | 0 | GameObject instance ID |
| path | string | No | null | GameObject hierarchy path |
| speed | float | No | null | Agent movement speed |
| acceleration | float | No | null | Agent acceleration |
| angularSpeed | float | No | null | Agent angular speed |
| radius | float | No | null | Agent radius |
| height | float | No | null | Agent height |
| stoppingDistance | float | No | null | Distance to stop before target |

**Returns:** `{ success, gameObject, speed, radius }`

### `navmesh_add_obstacle`
Add NavMeshObstacle component to an object.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | null | GameObject name |
| instanceId | int | No | 0 | GameObject instance ID |
| path | string | No | null | GameObject hierarchy path |
| carve | bool | No | true | Enable carving |

**Returns:** `{ success, gameObject, carving }`

### `navmesh_set_obstacle`
Set NavMeshObstacle properties (shape, size, carving).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| name | string | No | null | GameObject name |
| instanceId | int | No | 0 | GameObject instance ID |
| path | string | No | null | GameObject hierarchy path |
| shape | string | No | null | Obstacle shape (e.g. Box, Capsule) |
| sizeX | float | No | null | Obstacle size X |
| sizeY | float | No | null | Obstacle size Y |
| sizeZ | float | No | null | Obstacle size Z |
| carving | bool | No | null | Enable carving |

**Returns:** `{ success, gameObject, shape, carving }`

### `navmesh_sample_position`
Find nearest point on NavMesh.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | float | Yes | - | Source position X |
| y | float | Yes | - | Source position Y |
| z | float | Yes | - | Source position Z |
| maxDistance | float | No | 10 | Maximum search distance |

**Returns:** `{ success, found, point: { x, y, z }, distance }`

### `navmesh_set_area_cost`
Set area traversal cost.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| areaIndex | int | Yes | - | NavMesh area index |
| cost | float | Yes | - | Traversal cost value |

**Returns:** `{ success, areaIndex, cost }`

### `navmesh_get_settings`
Get NavMesh build settings.

**Parameters:** None.

**Returns:** `{ success, agentRadius, agentHeight, agentSlope, agentClimb }`

---

## Canonical Signatures

以下附录以 `SkillsForUnity/Editor/Skills/*Skills.cs` 的真实 `[UnitySkill]` 签名为准，供审计和自动化解析使用。

### navmesh_bake
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### navmesh_clear
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |

### navmesh_calculate_path
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startX` | float | Yes | - | Canonical signature parameter |
| `startY` | float | Yes | - | Canonical signature parameter |
| `startZ` | float | Yes | - | Canonical signature parameter |
| `endX` | float | Yes | - | Canonical signature parameter |
| `endY` | float | Yes | - | Canonical signature parameter |
| `endZ` | float | Yes | - | Canonical signature parameter |
| `areaMask` | int | No | NavMesh.AllAreas | Canonical signature parameter |

### navmesh_add_agent
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |

### navmesh_set_agent
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `speed` | float? | No | null | Canonical signature parameter |
| `acceleration` | float? | No | null | Canonical signature parameter |
| `angularSpeed` | float? | No | null | Canonical signature parameter |
| `radius` | float? | No | null | Canonical signature parameter |
| `height` | float? | No | null | Canonical signature parameter |
| `stoppingDistance` | float? | No | null | Canonical signature parameter |

### navmesh_add_obstacle
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `carve` | bool | No | true | Canonical signature parameter |

### navmesh_set_obstacle
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | No | null | Canonical signature parameter |
| `instanceId` | int | No | 0 | Canonical signature parameter |
| `path` | string | No | null | Canonical signature parameter |
| `shape` | string | No | null | Canonical signature parameter |
| `sizeX` | float? | No | null | Canonical signature parameter |
| `sizeY` | float? | No | null | Canonical signature parameter |
| `sizeZ` | float? | No | null | Canonical signature parameter |
| `carving` | bool? | No | null | Canonical signature parameter |

### navmesh_sample_position
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `x` | float | Yes | - | Canonical signature parameter |
| `y` | float | Yes | - | Canonical signature parameter |
| `z` | float | Yes | - | Canonical signature parameter |
| `maxDistance` | float | No | 10f | Canonical signature parameter |

### navmesh_set_area_cost
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `areaIndex` | int | Yes | - | Canonical signature parameter |
| `cost` | float | Yes | - | Canonical signature parameter |

### navmesh_get_settings
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| - | - | - | - | No parameters |
