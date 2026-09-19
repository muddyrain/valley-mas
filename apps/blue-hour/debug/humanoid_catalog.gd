extends RefCounted
## One roster for the permanent rig/animation inspector.

const CHARACTERS: Array[Dictionary] = [
	{
		"id": "xia_zhiyao", "name": "夏知遥",
		"source": preload("res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"),
		"rigged": preload("res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"),
	},
	{
		"id": "su_wanxing", "name": "苏晚星",
		"source": preload("res://assets/characters/su_wanxing/runtime/su_wanxing.glb"),
		"rigged": preload("res://assets/characters/su_wanxing/runtime/su_wanxing.glb"),
	},
	{
		"id": "infected_basic_a", "name": "ENM_001 普通感染者",
		"source": preload("res://assets/characters/infected_basic_a/model/source/ENM_001_infected_basic_a.glb"),
		"rigged": preload("res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged.glb"),
	},
]
