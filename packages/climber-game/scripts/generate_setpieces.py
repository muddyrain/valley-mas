import math
import os

import bpy


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "assets", "models", "setpieces"))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def make_material(name: str, rgba: tuple[float, float, float, float]):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = 0.72
        bsdf.inputs["Metallic"].default_value = 0.06
    return material


def apply_material(obj, material):
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def bevel_object(obj, width: float = 0.03, segments: int = 2):
    modifier = obj.modifiers.new(name="bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "NONE"


def export_model(name: str):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    filepath = os.path.join(OUTPUT_DIR, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )


def build_plank_long():
    clear_scene()
    wood = make_material("mat_wood", (0.72, 0.47, 0.25, 1.0))
    dark = make_material("mat_dark", (0.25, 0.17, 0.11, 1.0))
    metal = make_material("mat_metal", (0.62, 0.62, 0.65, 1.0))

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0.2, 0))
    plank = bpy.context.active_object
    plank.scale = (2.7, 0.11, 0.56)
    apply_material(plank, wood)
    bevel_object(plank, 0.025, 2)

    for z in (-0.42, 0.42):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0.22, z))
        rail = bpy.context.active_object
        rail.scale = (2.62, 0.04, 0.05)
        apply_material(rail, dark)
        bevel_object(rail, 0.015, 2)

    for x in (-2.2, 2.2):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 0.14, 0))
        cap = bpy.context.active_object
        cap.scale = (0.14, 0.08, 0.6)
        apply_material(cap, dark)
        bevel_object(cap, 0.015, 2)

    for x in (-1.6, -0.6, 0.4, 1.4):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.035, depth=0.06, location=(x, 0.29, -0.18))
        bolt_l = bpy.context.active_object
        apply_material(bolt_l, metal)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.035, depth=0.06, location=(x, 0.29, 0.18))
        bolt_r = bpy.context.active_object
        apply_material(bolt_r, metal)

    export_model("plank_long")


def build_pipe_long():
    clear_scene()
    pipe = make_material("mat_pipe", (0.9, 0.9, 0.86, 1.0))
    rim = make_material("mat_rim", (0.52, 0.52, 0.52, 1.0))

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=28, radius=0.72, depth=4.8, location=(0, 0.72, 0), rotation=(0, math.pi / 2, 0)
    )
    body = bpy.context.active_object
    apply_material(body, pipe)

    for x in (-2.35, 2.35):
        bpy.ops.mesh.primitive_torus_add(
            location=(x, 0.72, 0), major_radius=0.72, minor_radius=0.08, rotation=(0, math.pi / 2, 0)
        )
        ring = bpy.context.active_object
        apply_material(ring, rim)

    export_model("pipe_long")


def build_container_short():
    clear_scene()
    shell = make_material("mat_container", (0.16, 0.44, 0.86, 1.0))
    beam = make_material("mat_beam", (0.12, 0.17, 0.28, 1.0))

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0.8, 0))
    box = bpy.context.active_object
    box.scale = (1.8, 0.8, 1.05)
    apply_material(box, shell)
    bevel_object(box, 0.03, 2)

    for x in (-1.55, 0, 1.55):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 1.65, 1.02))
        rib = bpy.context.active_object
        rib.scale = (0.08, 0.58, 0.05)
        apply_material(rib, beam)
        bevel_object(rib, 0.01, 2)

    for x in (-1.45, -1.05, -0.65, -0.25, 0.15, 0.55, 0.95, 1.35):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 0.82, -1.03))
        rib = bpy.context.active_object
        rib.scale = (0.05, 0.68, 0.04)
        apply_material(rib, beam)

    export_model("container_short")


def build_container_long():
    clear_scene()
    shell = make_material("mat_container_l", (0.83, 0.33, 0.17, 1.0))
    beam = make_material("mat_beam_l", (0.09, 0.14, 0.24, 1.0))

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0.9, 0))
    box = bpy.context.active_object
    box.scale = (2.9, 0.9, 1.12)
    apply_material(box, shell)
    bevel_object(box, 0.03, 2)

    for x in (-2.45, -1.25, 0, 1.25, 2.45):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 1.82, -1.08))
        rib = bpy.context.active_object
        rib.scale = (0.08, 0.64, 0.05)
        apply_material(rib, beam)
        bevel_object(rib, 0.01, 2)

    for x in (-2.35, -1.85, -1.35, -0.85, -0.35, 0.15, 0.65, 1.15, 1.65, 2.15):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 0.92, 1.1))
        rib = bpy.context.active_object
        rib.scale = (0.05, 0.78, 0.04)
        apply_material(rib, beam)

    export_model("container_long")


def build_ramp_wedge():
    clear_scene()
    ramp_mat = make_material("mat_ramp", (0.68, 0.58, 0.38, 1.0))
    edge_mat = make_material("mat_ramp_edge", (0.46, 0.39, 0.24, 1.0))

    mesh = bpy.data.meshes.new("ramp_mesh")
    obj = bpy.data.objects.new("ramp", mesh)
    bpy.context.collection.objects.link(obj)
    top_flat_end_z = -0.2
    verts = [
        (-1.5, 0.0, -0.7),
        (1.5, 0.0, -0.7),
        (1.5, 0.0, 0.7),
        (-1.5, 0.0, 0.7),
        (-1.5, 1.0, -0.7),
        (1.5, 1.0, -0.7),
        (-1.5, 1.0, top_flat_end_z),
        (1.5, 1.0, top_flat_end_z),
    ]
    faces = [
        (0, 1, 2, 3),
        (0, 4, 5, 1),
        (4, 5, 7, 6),
        (6, 7, 2, 3),
        (0, 3, 6, 4),
        (1, 5, 7, 2),
    ]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj.location = (0, 0, 0)
    apply_material(obj, ramp_mat)
    bevel_object(obj, 0.02, 2)

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0.0, 0.03, -0.75))
    lip = bpy.context.active_object
    lip.scale = (1.58, 0.03, 0.06)
    apply_material(lip, edge_mat)

    export_model("ramp_wedge_v2")


def build_beam_hazard():
    clear_scene()
    yellow = make_material("mat_yellow", (0.93, 0.78, 0.2, 1.0))
    black = make_material("mat_black", (0.1, 0.11, 0.13, 1.0))
    steel = make_material("mat_steel", (0.53, 0.57, 0.62, 1.0))

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0.26, 0))
    beam = bpy.context.active_object
    beam.scale = (2.4, 0.26, 0.48)
    apply_material(beam, yellow)
    bevel_object(beam, 0.02, 2)

    for x in (-1.6, -0.5, 0.6, 1.7):
        bpy.ops.mesh.primitive_cube_add(size=2, location=(x, 0.265, 0))
        stripe = bpy.context.active_object
        stripe.scale = (0.24, 0.27, 0.5)
        apply_material(stripe, black)

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.09, depth=0.56, location=(-2.5, 0.28, 0))
    cap_l = bpy.context.active_object
    cap_l.rotation_euler = (0, math.pi / 2, 0)
    apply_material(cap_l, steel)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.09, depth=0.56, location=(2.5, 0.28, 0))
    cap_r = bpy.context.active_object
    cap_r.rotation_euler = (0, math.pi / 2, 0)
    apply_material(cap_r, steel)

    export_model("beam_hazard")


if __name__ == "__main__":
    build_plank_long()
    build_pipe_long()
    build_container_short()
    build_container_long()
    build_ramp_wedge()
    build_beam_hazard()
    print(f"Setpieces generated: {OUTPUT_DIR}")
