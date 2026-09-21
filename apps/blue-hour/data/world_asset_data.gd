extends Resource

@export var id: String = ""
@export var scene: PackedScene
@export var category: String = ""
@export var footprint: Vector2 = Vector2.ONE
@export var bounding_size: Vector3 = Vector3.ONE
@export var poi_type: String = ""
@export var spawn_weight: float = 1.0
@export var allowed_district: PackedStringArray = ["east_quay"]
@export var parking_requirement: String = "none"
@export var loot_profile: String = "general"
@export var enemy_profile: String = "street"
@export var entrance_offset: Vector3 = Vector3.ZERO
@export var road_offset: Vector3 = Vector3.ZERO
@export var search_offset: Vector3 = Vector3.ZERO
@export var primary_entrance_local_anchor: Vector3 = Vector3.ZERO
@export var primary_entrance_local_forward: Vector3 = Vector3.FORWARD
@export var search_interaction_local_anchor: Vector3 = Vector3.ZERO


@export var building_id: String = ""
@export var display_name: String = ""
@export var subtype: String = ""
@export var searchable: bool = true
@export var loot_tags: PackedStringArray = []
@export var mission_tags: PackedStringArray = []
@export var interaction_tags: PackedStringArray = []
## Placement hints only; registration does not opt an asset into a generator.
@export var environment_tags: PackedStringArray = []
