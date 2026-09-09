"""Verify the installed Blender runtime without modifying user preferences."""
import bpy

assert bpy.app.version[:2] == (5, 2), bpy.app.version_string
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1)
assert tuple(bpy.context.object.dimensions) == (1.0, 1.0, 1.0)
assert hasattr(bpy.ops.export_scene, "gltf")
print("BLUE_HOUR_BLENDER_PROBE_PASS", bpy.app.version_string, bpy.app.binary_path)
