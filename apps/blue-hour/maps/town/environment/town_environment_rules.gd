extends RefCounted
## Catalog IDs express composition policy; asset paths remain owned by the Catalog.

const TREE := "VEG_001_tree_broadleaf_a"
const BUSH := "VEG_002_bush_a"
const LAMP := "PRP_001_street_lamp"
const BIN := "PRP_002_trash_bin"
const SEDAN := "VEH_001_sedan_a"
const SUV := "VEH_002_suv"
const VAN := "VEH_003_van"
const FENCE := "BAR_001_chainlink_fence"
const SLOT_TYPES: Array[String] = ["STREET_EDGE", "SIDEWALK_EDGE", "RESIDENTIAL_YARD", "RESIDENTIAL_BUFFER", "COMMERCIAL_FRONTAGE", "COMMERCIAL_SIDE", "PARK", "COMMUNITY_GREEN", "PARKING", "SERVICE_YARD", "LOADING_YARD", "INDUSTRIAL_EDGE", "GREEN_BUFFER", "TOWN_EDGE"]
const COUNTS := {TREE: "trees", BUSH: "bushes", LAMP: "street_lamps", BIN: "trash_bins", SEDAN: "sedans", SUV: "suvs", VAN: "vans", FENCE: "fence_segments"}

static func vegetation(use: String, slot_type: String) -> Dictionary:
	var policy := {"cluster_area": 240.0, "trees": 2, "bushes": 3}
	match use:
		"COMMERCIAL_CORE":
			policy = {"cluster_area": 600.0, "trees": 1, "bushes": 2}
		"RESIDENTIAL_A":
			policy = {"cluster_area": 190.0, "trees": 1, "bushes": 6}
		"RESIDENTIAL_B":
			policy = {"cluster_area": 240.0, "trees": 3, "bushes": 3}
		"OPEN_SPACE":
			policy = {"cluster_area": 210.0, "trees": 3, "bushes": 4}
		"INDUSTRIAL_SERVICE":
			policy = {"cluster_area": 800.0, "trees": 1, "bushes": 1}
	if slot_type == "TOWN_EDGE":
		policy.cluster_area *= 0.7
	return policy

static func ground_slot(kind: String, use: String) -> String:
	match kind:
		"parking": return "PARKING"
		"backyard": return "RESIDENTIAL_YARD"
		"small_park": return "PARK"
		"community_green": return "COMMUNITY_GREEN"
		"loading_yard": return "LOADING_YARD"
		"rear_access": return "COMMERCIAL_SIDE" if use == "COMMERCIAL_CORE" else "SERVICE_YARD"
	return "RESIDENTIAL_BUFFER" if use.begins_with("RESIDENTIAL") else "GREEN_BUFFER"
