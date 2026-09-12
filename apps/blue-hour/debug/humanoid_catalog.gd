extends RefCounted
## One roster for the permanent rig/animation inspector.

const CHARACTERS: Array[Dictionary] = [
	{
		"id": "xia_zhiyao", "name": "夏知遥",
		"source": preload("res://assets/characters/xia_zhiyao/source/xia_zhiyao.glb"),
		"rigged": preload("res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"),
	},
	{
		"id": "su_wanxing", "name": "苏晚星",
		"source": preload("res://assets/characters/su_wanxing/source/su_wanxing.glb"),
		"rigged": preload("res://assets/characters/su_wanxing/runtime/su_wanxing.glb"),
	},
]
