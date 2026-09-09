"""8 m street kit and reusable modern storefront components."""
from math import pi, sin, cos
from utils.geometry import box, beam, panel, part, mesh
from utils.collision import proxy, bounds_proxy, building_proxies


def road(kind):
    box("RoadBed", (8, 8, .08), (0, 0, .04), "BH_Concrete_Dark", 0)
    # Tile each cell once: no overlapping asphalt surfaces at intersections.
    exits = {"Straight": (False, False, True, True), "Corner": (False, True, True, False),
             "TJunction": (True, True, True, False), "Cross": (True, True, True, True)}[kind]
    vertices, faces = [], []
    for x in range(-4, 4):
        for y in range(-4, 4):
            active = abs(x + .5) < 3 and abs(y + .5) < 3
            active |= exits[0] and x < 0 and abs(y + .5) < 3
            active |= exits[1] and x >= 0 and abs(y + .5) < 3
            active |= exits[2] and y < 0 and abs(x + .5) < 3
            active |= exits[3] and y >= 0 and abs(x + .5) < 3
            if active:
                i = len(vertices)
                vertices.extend([(x, y, .085), (x+1, y, .085), (x+1, y+1, .085), (x, y+1, .085)])
                faces.append((i, i+1, i+2, i+3))
    mesh("Asphalt", vertices, faces, "BH_Asphalt", 0)
    if kind == "Straight":
        for y in (-3, -1, 1, 3):
            box("LaneDash", (.10, 1, .008), (0, y, .09), "BH_Plastic_Light", 0)
        for x in (-3.04, 3.04):
            box("Shoulder", (.08, 8, .008), (x, 0, .09), "BH_Plastic_Light", 0)
    else:
        for enabled, angle in zip(exits, (pi/2, -pi/2, 0, pi)):
            if enabled:
                part(lambda: box("JunctionDash", (.10, .8, .008), (0, -3.5, .09), "BH_Plastic_Light", 0), rotation=angle)
    bounds_proxy(8, 8, .085)


def sidewalk(corner=False):
    if not corner:
        box("Sidewalk", (2, 8, .16), (0, 0, .08), "BH_Concrete_Light", 0)
        for y in (-3, -1, 1, 3):
            box("PavingJoint", (1.95, .018, .002), (0, y, .161), "BH_Concrete_Dark", 0)
        bounds_proxy(2, 8, .16)
    else:
        # Quarter annulus: center at origin, inside radius 3, outside radius 5.
        segments = 8
        points = [(r*cos(i*pi/2/segments), r*sin(i*pi/2/segments), z)
                  for z in (0, .16) for r in (3, 5) for i in range(segments+1)]
        n, faces = segments+1, []
        for i in range(segments):
            faces += [(i, i+1, n+i+1, n+i), (2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1),
                      (i, 2*n+i, 2*n+i+1, i+1), (n+i, n+i+1, 3*n+i+1, 3*n+i)]
        faces += [(0,n,3*n,2*n), (n-1,3*n-1,4*n-1,2*n-1)]
        mesh("SidewalkCorner", points, faces, "BH_Concrete_Light", 0)
        for i in range(4):
            angle = (i+.5)*pi/8
            # Rotated boxes approximate the bend without blocking its open center.
            part(lambda: proxy((2, 1.52, .16), (4, 0, .08), i), rotation=angle)


def wall(width=3, height=3, brick=False):
    box("Wall", (width, .20, height), (0, 0, height/2), "BH_Concrete_Dark" if brick else "BH_Concrete_Light", .016)
    box("WallPlinth", (width, .24, .22), (0, -.01, .11), "BH_Concrete_Dark", .008)
    if brick:
        for row in range(1, int(height/.4)):
            z = row*.4
            box("Mortar", (width-.08, .009, .018), (0, -.105, z), "BH_Metal_Mid", 0)
            for col in range(-int(width/2), int(width/2)+1):
                x = col + (.45 if row % 2 else 0)
                if abs(x) < width/2-.05:
                    box("VerticalJoint", (.014, .009, .36), (x, -.105, z-.2), "BH_Metal_Mid", 0)


def window(width=1.2, height=1.4):
    box("Glass", (width, .055, height), (0, 0, height/2), "BH_Glass", .008)
    for x in (-width/2, 0, width/2):
        box("Mullion", (.065, .11, height+.07), (x, -.04, height/2+.035), "BH_Metal_Mid", .008)
    for z in (.04, height):
        box("WindowRail", (width+.13, .15, .08), (0, -.04, z), "BH_Metal_Mid", .008)
    box("Sill", (width+.22, .26, .10), (0, -.06, .05), "BH_Concrete_Light", .014)
    # A lit interior panel remains readable at the game's distant camera scale.
    box("WindowLight", (width*.39, .015, height*.52), (-width*.24, -.044, height*.60), "BH_Emission_Warm", 0, group="LightMesh")


def door(shop=False):
    width, height = (1.6, 2.15) if shop else (1, 2.1)
    box("DoorPanel", (width, .09, height), (0, 0, height/2), "BH_Glass" if shop else "BH_Metal_Mid", .015)
    for x in (-width/2, width/2):
        box("DoorFrame", (.085, .2, height), (x, -.035, height/2), "BH_Metal_Dark", .012)
    box("Header", (width+.085, .2, .10), (0, -.035, height), "BH_Metal_Dark", .01)
    for x in ((-.12, .12) if shop else (.30,)):
        box("PullHandle", (.035, .10, .38), (x, -.13, 1.05), "BH_Plastic_Light", .009)
    if shop:
        box("MeetingStile", (.045, .12, height), (0, -.06, height/2), "BH_Metal_Mid", .008)
        box("SafetyBand", (width, .016, .1), (0, -.11, .85), "BH_Safety_Yellow", 0)


def shutter(width=3.2, height=3):
    box("Shutter", (width, .12, height), (0, 0, height/2), "BH_Metal_Mid", .015)
    for x in (-width/2, width/2):
        box("ShutterGuide", (.12, .24, height), (x, -.04, height/2), "BH_Metal_Dark", .015)
    for i in range(1, int(height/.2)):
        box("ShutterSlat", (width-.08, .028, .025), (0, -.075, i*.2), "BH_Metal_Dark", .003)
    box("ShutterHousing", (width+.2, .38, .28), (0, .03, height), "BH_Concrete_Dark", .024)
    box("LiftHandle", (.42, .06, .07), (0, -.10, .4), "BH_Plastic_Light", .008)


def awning(width=3.2, depth=1.15, color="BH_Muted_Green"):
    box("Canopy", (width, depth, .16), (0, 0, .16), color, .02, rotation=(.10,0,0))
    box("CanopyLip", (width, .08, .22), (0, -depth/2, .11), color, .014)
    for x in (-width*.36, width*.36):
        beam("CanopyBrace", (x, depth/2, .06), (x, -depth*.33, .12), .024)


def roof(width=3, depth=3):
    box("RoofDeck", (width, depth, .18), (0, 0, .09), "BH_Concrete_Dark", .015)


def roof_edge(width=3):
    box("Parapet", (width, .22, .4), (0, 0, .2), "BH_Concrete_Light", .016)
    box("ParapetCap", (width, .29, .07), (0, 0, .40), "BH_Metal_Mid", .012)


def frame(width=4, height=3):
    for x in (-width/2+.1, width/2-.1):
        box("StoreColumn", (.2, .36, height), (x, 0, height/2), "BH_Concrete_Light", .024)
    box("StoreLintel", (width, .36, .26), (0, 0, height-.13), "BH_Concrete_Light", .024)


def building(kind):
    warehouse = kind == "Warehouse"
    width, depth, height = (10.5, 10, 4.7) if warehouse else ((8.5, 8, 3.8) if kind == "Pharmacy" else (9.7, 8, 3.9))
    front = -depth/2
    part(wall, width, height, warehouse, offset=(0, depth/2, 0))
    for side in (-1, 1):
        part(wall, depth, height, warehouse, offset=(side*(width/2-.1), 0, 0), rotation=pi/2)
    part(wall, width, height, warehouse, offset=(0, front, 0))
    part(roof, width, depth+.2, offset=(0,0,height))
    for y in (front, depth/2):
        part(roof_edge, width, offset=(0,y,height+.15))
    for x in (-width/2+.1, width/2-.1):
        part(roof_edge, depth, offset=(x,0,height+.15), rotation=pi/2)
    # Front pieces sit in front of the backing wall; interiors are out of scope.
    if warehouse:
        part(shutter, 4.4, 3.35, offset=(0,front-.17,0))
        part(door, offset=(width*.36, front-.17,0))
        for x in (-width*.40, -width*.27, width*.27, width*.40):
            box("SteelRib", (.11,.20,height), (x,front-.17,height/2), "BH_Metal_Mid", .014)
        for x in (-width*.23, width*.23):
            box("LoadingBollard", (.17,.17,.75), (x,front-.35,.375), "BH_Safety_Yellow", .022)
        box("LoadingPlatform", (5.4,.65,.14), (0,front-.23,.07), "BH_Concrete_Dark", .025)
        for y in (-1.8, 1.5):
            box("RoofMonitorBase", (5.5,1.5,.35), (0,y,height+.35), "BH_Metal_Mid", .045)
            box("RoofMonitorGlass", (5.1,1.15,.08), (0,y,height+.565), "BH_Glass", .014)
        box("IndustrialSignBlank", (2.8,.10,.55), (-2.8,front-.23,height-.45), "BH_Plastic_Light", .018)
    else:
        for x in (-width*.32, width*.32):
            part(window, width*.26, 2.1, offset=(x,front-.18,.35))
        part(door, True, offset=(0,front-.26,0))
        part(frame, width, 3.05, offset=(0,front-.12,0))
        part(awning, 3.4 if kind == "Pharmacy" else width-.2, 1.0, "BH_Plastic_Light" if kind == "Pharmacy" else "BH_Muted_Green", offset=(0,front-.37,2.65))
        box("SignMount", (2.4 if kind == "Pharmacy" else width*.72,.15,.57), (0,front-.17,3.4), "BH_Muted_Green", .025)
        if kind == "Pharmacy":
            box("MedicalPylon", (.95,.6,2.2), (-width/2+.6,front+.4,height+1.1), "BH_Plastic_Light", .045)
            box("MedicalCrossV", (.24,.07,1.05), (-width/2+.6,front+.06,height+1.35), "BH_Muted_Green", .01)
            box("MedicalCrossH", (.74,.07,.24), (-width/2+.6,front+.05,height+1.35), "BH_Muted_Green", .01)
            box("ClinicPier", (.32,.10,3.4), (-width/2+.6,front-.16,1.7), "BH_Muted_Green", .016)
            box("MedicalCrossFrontV", (.15,.07,.43), (0,front-.28,3.4), "BH_Plastic_Light", .007)
            box("MedicalCrossFrontH", (.45,.07,.15), (0,front-.28,3.4), "BH_Plastic_Light", .007)
        else:
            # Basket pictogram makes the supermarket readable without words.
            for x in (-.3,.3):
                beam("Basket", (x,front-.27,3.25), (x*1.4,front-.27,3.57), .035, "BH_Plastic_Light")
            beam("BasketBottom", (-.3,front-.27,3.25), (.3,front-.27,3.25), .035, "BH_Plastic_Light")
            for x in (-.12,.12):
                beam("BasketUpright", (x,front-.27,3.25), (x,front-.27,3.48), .025, "BH_Plastic_Light")
        # Rooftop service housing gives a readable top-down silhouette.
        box("RooftopHousing", (1.5,2,.8), (width*.23,1.7,height+.5), "BH_Concrete_Light", .035)
        for y in (1.2,1.5,1.8,2.1):
            box("HousingVent", (1.1,.08,.035), (width*.23,y,height+.915), "BH_Metal_Mid", .006)
    building_proxies(width, depth, height, 4.4 if warehouse else 1.6)


def build(asset_id):
    key = asset_id.removeprefix("BH_")
    if key.startswith("Road_"):
        road(key.removeprefix("Road_"))
        return
    if key.startswith("Sidewalk_"):
        sidewalk(key.endswith("Corner"))
        return
    if key.startswith("Building_"):
        building(key.split("_")[1])
        return
    if key == "Curb":
        box("Curb", (.18,8,.18), (0,0,.09), "BH_Concrete_Light", 0)
        bounds_proxy(.18,8,.18)
        return
    if key == "Crosswalk":
        for y in (-1.5,-.9,-.3,.3,.9,1.5):
            box("CrosswalkStripe", (5.7,.38,.008), (0,y,.004), "BH_Plastic_Light", 0)
        bounds_proxy(5.7,3.38,.008)
        return
    builders = {
        "Wall_Concrete": (lambda: wall(), (3,.24,3)),
        "Wall_Brick": (lambda: wall(brick=True), (3,.24,3)),
        "Window_Small": (lambda: window(), (1.42,.26,1.5)),
        "Window_Large": (lambda: window(2.8,1.8), (3.02,.26,1.9)),
        "Door_Normal": (lambda: door(), (1.1,.25,2.15)),
        "Door_Shop": (lambda: door(True), (1.7,.25,2.2)),
        "Roller_Shutter": (lambda: shutter(), (3.4,.38,3.2)),
        "Awning": (lambda: awning(), (3.2,1.15,.34)),
        "Roof_Flat": (lambda: roof(), (3,3,.18)),
        "Roof_Edge": (lambda: roof_edge(), (3,.29,.44)),
        "Storefront_Frame": (lambda: frame(), (4,.36,3)),
    }
    builder, dimensions = builders[key]
    builder()
    if key == "Storefront_Frame":
        for i, x in enumerate((-1.9,1.9)):
            proxy((.2,.36,3), (x,0,1.5), i)
        proxy((3.6,.36,.26), (0,0,2.87), 2)
    else:
        bounds_proxy(*dimensions)
