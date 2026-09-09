"""Meter-scale geometry in Blender XYZ, Z up. Transforms baked to vertices."""
import math
import bpy
from mathutils import Matrix, Vector
from .materials import material
from .bevel import bevel


def finish(obj, name, mat, edge=0.018, group="RenderMesh"):
    obj.name = "BH_" + name
    obj.data.name = obj.name
    obj["bh_group"] = group
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(material(mat))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, edge)
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    return obj


def box(name, size, pos=(0, 0, 0), mat="BH_Metal_Dark", edge=0.018, rotation=(0, 0, 0), group="RenderMesh"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos, rotation=rotation)
    obj = bpy.context.object
    obj.dimensions = size
    return finish(obj, name, mat, edge, group)


def cylinder(name, radius, depth, pos, mat="BH_Metal_Dark", vertices=12, rotation=(0, 0, 0), top=None, group="RenderMesh"):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if top is None else top, depth=depth, location=pos, rotation=rotation)
    return finish(bpy.context.object, name, mat, 0.008, group)


def sphere(name, radius, pos, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=pos)
    bpy.context.object.scale = scale
    return finish(bpy.context.object, name, mat, 0)


def beam(name, start, end, radius=0.025, mat="BH_Metal_Dark", group="RenderMesh"):
    a, b = Vector(start), Vector(end)
    axis = b - a
    rot = axis.to_track_quat("Z", "Y").to_euler()
    return cylinder(name, radius, axis.length, (a + b) / 2, mat, 8, rot, group=group)


def mesh(name, vertices, faces, mat, edge=0.015, group="RenderMesh"):
    data = bpy.data.meshes.new("BH_" + name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new("BH_" + name, data)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # Ensure consistent outward normals on authored solids.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    return finish(obj, name, mat, edge, group)


def prism(name, profile, width, mat, edge=0.02, group="RenderMesh"):
    """Extrude a YZ side silhouette along X (vehicles, weapons, brackets)."""
    n = len(profile)
    verts = [(x, y, z) for x in (-width / 2, width / 2) for y, z in profile]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, verts, faces, mat, edge, group)


def panel(name, points, mat, thickness=0.018, axis=1, group="RenderMesh"):
    """Thin solid panel from a 3D polygon, preserving clean silhouette."""
    n = len(points)
    offset = Vector([thickness if i == axis else 0 for i in range(3)])
    verts = list(points) + [Vector(p) + offset for p in points]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, verts, faces, mat, 0, group)


def transform_since(objects_before, offset=(0, 0, 0), rotation=0, scale=(1, 1, 1)):
    matrix = Matrix.Translation(Vector(offset)) @ Matrix.Rotation(rotation, 4, "Z") @ Matrix.Diagonal(Vector((*scale, 1)))
    for obj in set(bpy.context.scene.objects) - objects_before:
        if obj.type == "MESH":
            obj.data.transform(matrix)


def part(builder, *args, offset=(0, 0, 0), rotation=0, scale=(1, 1, 1), **kwargs):
    before = set(bpy.context.scene.objects)
    builder(*args, **kwargs)
    transform_since(before, offset, rotation, scale)
