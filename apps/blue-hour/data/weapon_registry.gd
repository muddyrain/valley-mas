class_name WeaponRegistry
extends RefCounted

const KNIFE := "WPN_001_SURVIVAL_KNIFE"
const P9 := "WPN_002_P9_PISTOL"
const R6 := "WPN_003_R6_REVOLVER"
const K9 := "WPN_004_K9_SMG"
const S12 := "WPN_005_S12_SHOTGUN"
const A21 := "WPN_006_A21_ASSAULT_RIFLE"
const H7 := "WPN_007_H7_HUNTER_RIFLE"
const L56 := "WPN_008_L56_LMG"
const LEGACY_IDS := {"crowbar": KNIFE, "pistol": P9, "smg": K9, "shotgun": S12}

static func canonical_id(id: String) -> String:
	return LEGACY_IDS.get(id, id)

static func definitions() -> Array[Resource]:
	return [
		preload("res://data/weapons/wpn_001_survival_knife.tres"),
		preload("res://data/weapons/wpn_002_p9_pistol.tres"),
		preload("res://data/weapons/wpn_003_r6_revolver.tres"),
		preload("res://data/weapons/wpn_004_k9_smg.tres"),
		preload("res://data/weapons/wpn_005_s12_shotgun.tres"),
		preload("res://data/weapons/wpn_006_a21_assault_rifle.tres"),
		preload("res://data/weapons/wpn_007_h7_hunter_rifle.tres"),
		preload("res://data/weapons/wpn_008_l56_lmg.tres")
	]
