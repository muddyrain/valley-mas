"""ART_BIBLE V1 palette. Convert sRGB to linear exactly once."""

PALETTE = {
    "BH_Concrete_Light": ("B7B8B3", 0.90, 0.0),
    "BH_Concrete_Dark": ("656B6D", 0.92, 0.0),
    "BH_Metal_Dark": ("343A3E", 0.48, 0.55),
    "BH_Metal_Mid": ("56666F", 0.52, 0.40),
    "BH_Muted_Green": ("687567", 0.65, 0.15),
    "BH_Glass": ("243747", 0.24, 0.20),
    "BH_Asphalt": ("45494B", 0.98, 0.0),
    "BH_Plastic_Dark": ("343A3E", 0.88, 0.0),
    "BH_Plastic_Light": ("D8D5C9", 0.70, 0.0),
    "BH_Safety_Yellow": ("D5A632", 0.62, 0.1),
    "BH_Warm_Orange": ("C66E37", 0.65, 0.1),
    "BH_Emergency_Red": ("A94A43", 0.58, 0.0),
    "BH_Emission_Warm": ("E8B36A", 0.60, 0.0),
    "BH_Emission_Blue": ("243747", 0.60, 0.0),
}


def linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def material(name):
    import bpy
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    code, roughness, metal = PALETTE[name]
    color = tuple(linear(int(code[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    if "Emission" in name:
        shader.inputs["Emission Color"].default_value = color
        shader.inputs["Emission Strength"].default_value = 0.65
    return result
