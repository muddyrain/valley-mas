"""All authored hard-surface bevels go through this helper."""
import bpy


def bevel(obj, width=0.018, segments=1):
    if width <= 0:
        return
    bpy.context.view_layer.objects.active = obj
    actual = min(width, min(obj.dimensions) * 0.15)
    if actual <= 0:
        return
    modifier = obj.modifiers.new("BH_EdgeHighlight", "BEVEL")
    modifier.width = actual
    modifier.segments = segments
    modifier.affect = "EDGES"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
