@tool
extends EditorScenePostImport
## Preserve the source PBR channels and mipmaps; oblique rooftops need anisotropic sampling.

func _post_import(scene: Node) -> Object:
	for node: Node in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh := node as MeshInstance3D
		for surface: int in range(mesh.mesh.get_surface_count()):
			var material := mesh.mesh.surface_get_material(surface) as BaseMaterial3D
			if material != null:
				material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return scene
