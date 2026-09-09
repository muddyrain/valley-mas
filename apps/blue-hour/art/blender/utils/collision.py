"""Simple box proxies imported by Godot as convex shapes, never render trimeshes."""
from .geometry import box


def proxy(size, pos, index=0):
    obj = box(f"COL_{index:02d}", size, pos, mat=None, edge=0, group="Collision")
    obj["bh_proxy"] = True
    return obj


def bounds_proxy(width, depth, height):
    proxy((width, depth, height), (0, 0, height / 2))


def building_proxies(width, depth, height, doorway=1.5):
    # Front wall has a real door opening in standalone module use.
    t = 0.2
    proxy((width, t, height), (0, depth / 2 - t / 2, height / 2), 0)
    for i, sign in enumerate((-1, 1)):
        proxy((t, depth, height), (sign * (width / 2 - t / 2), 0, height / 2), i + 1)
        span = (width - doorway) / 2
        proxy((span, t, height), (sign * (doorway / 2 + span / 2), -depth / 2 + t / 2, height / 2), i + 3)
    proxy((doorway, t, max(0.1, height - 2.15)), (0, -depth / 2 + t / 2, (height + 2.15) / 2), 5)
