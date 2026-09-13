extends Node3D
const Assets = preload("res://vfx/generated_assets.gd")
var environment: Environment
var sun: DirectionalLight3D
var transition: Tween
var lamps: Array[MeshInstance3D] = []
var accent_lights: Array[OmniLight3D] = []
var bus_light: OmniLight3D
var lamp_materials: Array[Material] = []

func setup(city: Node3D) -> void:
	lamps = city.lamps
	accent_lights = city.accent_lights
	bus_light = city.bus_light
	lamp_materials = city.lamp_materials
	var world := WorldEnvironment.new()
	environment = Environment.new()
	world.environment = environment
	environment.background_mode = Environment.BG_COLOR
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_energy = 0.7
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	add_child(world)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.shadow_enabled = true
	# One orthographic shadow region avoids cascade changes during this orthographic camera's pan.
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 85.0
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 2.0
	add_child(sun)
	set_phase(0, true)

func set_warning(enabled: bool) -> void:
	if not enabled:
		set_phase(0)
		return
	if transition:
		transition.kill()
	transition = create_tween().set_parallel()
	transition.tween_property(environment, "background_color", Color("#617885"), 8.0)
	transition.tween_property(environment, "ambient_light_color", Color("#94a7bd"), 8.0)
	transition.tween_property(sun, "light_color", Color("#cbd8e2"), 8.0)
	transition.tween_property(bus_light, "light_energy", 0.7, 8.0)

func set_phase(phase: int, immediate: bool = false) -> void:
	var sky: Color = [Color("#859d9f"), Color("#344D69"), Color("#243747").darkened(.65)][phase]
	var ambient: Color = [Color("#b6c4d6"), Color("#717fae"), Color("#506b8e")][phase]
	var sunlight: Color = [Color("#fff1d9"), Color("#91bdd5"), Color("#91a7bb")][phase]
	if transition:
		transition.kill()
	transition = create_tween().set_parallel()
	var seconds := 0.01 if immediate else 3.5
	transition.tween_property(environment, "background_color", sky, seconds)
	transition.tween_property(environment, "ambient_light_color", ambient, seconds)
	transition.tween_property(environment, "ambient_light_energy", [0.48, 0.62, 0.48][phase], seconds)
	transition.tween_property(sun, "light_color", sunlight, seconds)
	transition.tween_property(sun, "light_energy", [0.56, 0.52, 0.36][phase], seconds)
	transition.tween_property(bus_light, "light_energy", 0.0 if phase == 0 else 2.2, seconds)
	for light in accent_lights:
		transition.tween_property(light, "light_energy", [0.0,1.3,1.6][phase], seconds)
	# Compatibility cannot rely on HDR bloom or per-instance transparency for lamps.
	# Shared unshaded lamp faces provide the same palette in every quality tier.
	if Assets.materials.has("BH_Emission_Warm"):
		var warm: StandardMaterial3D = Assets.materials["BH_Emission_Warm"]
		warm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		warm.emission_enabled = false
		transition.tween_property(warm, "albedo_color", Color("#243747") if phase == 0 else Color("#E8B36A"), seconds)
	for lamp in lamps:
		lamp.transparency = 0.0
	var seen: Array[Material] = []
	for material: Material in lamp_materials:
		if material in seen:
			continue
		seen.append(material)
		transition.tween_property(material, "albedo_color", Color("#22282b") if phase == 0 else Color("#e8b36a"), seconds)
		transition.tween_property(material, "emission_energy_multiplier", 0.0 if phase == 0 else 1.2, seconds)
