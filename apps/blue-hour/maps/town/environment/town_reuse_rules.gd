extends RefCounted
## Approved selection is distinct from runtime readiness and from gameplay props.

const BENCH := "PRP_003_park_bench"
const PALLET := "PRP_004_pallet"
const WOOD := "PRP_005_wood_crate"
const METAL := "PRP_006_metal_crate"
const SIGN := "PRP_008_direction_sign"
const VENDING := "PRP_009_vending_machine"
const PLANTER := "PRP_011_planter"
const LOW_FENCE := "BAR_002_residential_low_fence"
const CONCRETE := "BAR_003_concrete_barrier"
const BARRICADE := "BAR_004_metal_barricade"
const DAMAGED := "BAR_005_chainlink_damaged"
const COUNTS := {BENCH: "benches", PALLET: "pallets", WOOD: "wood_crates", METAL: "metal_crates", SIGN: "direction_signs", VENDING: "vending_machines", PLANTER: "planters", LOW_FENCE: "low_fence_segments", CONCRETE: "concrete_barriers", BARRICADE: "metal_barricades", DAMAGED: "damaged_chainlink"}
const INDUSTRIAL: Array[String] = ["INDUSTRIAL_SERVICE", "MIXED_TRANSITION"]
const COMMERCIAL: Array[String] = ["COMMERCIAL_CORE", "MIXED_TRANSITION"]
const RESIDENTIAL: Array[String] = ["RESIDENTIAL_A", "RESIDENTIAL_B"]
const EXCLUDED: Array[String] = ["BH_Searchable_Crate", "BH_Searchable_VendingMachine", "CAMP_PROP_003_notice_board", "BH_Fence", "BH_Fence_Broken"]

static func permits(asset: String, slot: Dictionary) -> bool:
	match asset:
		BENCH:
			return slot.land_use == "OPEN_SPACE" and slot.type in ["PARK", "COMMUNITY_GREEN", "GREEN_BUFFER"]
		PALLET, WOOD, METAL:
			return slot.land_use in INDUSTRIAL and slot.type in ["LOADING_YARD", "SERVICE_YARD"]
		VENDING, PLANTER:
			return slot.land_use in COMMERCIAL and slot.type in ["COMMERCIAL_SIDE", "COMMERCIAL_FRONTAGE", "SERVICE_YARD", "PARKING"]
		SIGN:
			return slot.land_use in COMMERCIAL + INDUSTRIAL and slot.type in ["COMMERCIAL_FRONTAGE", "COMMERCIAL_SIDE", "INDUSTRIAL_EDGE", "SERVICE_YARD", "LOADING_YARD", "PARKING"]
		LOW_FENCE:
			return slot.land_use in RESIDENTIAL and slot.type in ["RESIDENTIAL_YARD", "RESIDENTIAL_BUFFER"]
		CONCRETE:
			return slot.land_use in INDUSTRIAL + COMMERCIAL and slot.type in ["PARKING", "SERVICE_YARD", "LOADING_YARD", "TOWN_EDGE"]
		BARRICADE, DAMAGED:
			return slot.land_use == "INDUSTRIAL_SERVICE" and slot.type in ["LOADING_YARD", "SERVICE_YARD", "INDUSTRIAL_EDGE"]
	return false
