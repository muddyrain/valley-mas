@tool
extends EditorScenePostImport
## The supplied external PNG is authoritative; FBX embeds a mislabeled JPEG.

const ALBEDO_PATH: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template_albedo.png"

func _post_import(scene: Node) -> Object:
	# This callback still receives source clips before the importer filters animations.
	for node: Node in scene.find_children("*", "AnimationPlayer", true, false):
		var player: AnimationPlayer = node as AnimationPlayer
		print("STANDARD_TEMPLATE excluded source clips: ", player.get_animation_list())
		player.free()
	var texture: Texture2D = load(ALBEDO_PATH) as Texture2D
	assert(texture != null)
	for node: Node in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh: MeshInstance3D = node as MeshInstance3D
		for surface: int in mesh.mesh.get_surface_count():
			var material: StandardMaterial3D = mesh.mesh.surface_get_material(surface) as StandardMaterial3D
			assert(material != null)
			material.albedo_texture = texture
	return scene
