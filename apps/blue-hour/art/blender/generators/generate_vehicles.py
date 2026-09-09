"""Original civil vehicle silhouettes; +Y rear, -Y front, ground at Z=0."""
from math import pi, sin, cos
from utils.geometry import box, cylinder, beam, prism, panel, mesh
from utils.collision import bounds_proxy


def wheel(x, y, radius=.34, width=.20, abandoned=False):
    cylinder("Tyre", radius, width, (x,y,radius), "BH_Plastic_Dark", 16, (0,pi/2,0))
    sign = 1 if x>0 else -1
    cylinder("WheelRim", radius*.60, .035, (x+sign*width*.51,y,radius), "BH_Metal_Mid", 12, (0,pi/2,0))
    cylinder("WheelHub", radius*.24, .044, (x+sign*width*.63,y,radius), "BH_Metal_Dark", 12, (0,pi/2,0))
    if not abandoned:
        for angle in (0,pi/2,pi,pi*1.5):
            center=(x+sign*width*.62,y+cos(angle)*radius*.4,radius+sin(angle)*radius*.4)
            box("HubSpoke",(.015,.08,.035),center,"BH_Plastic_Light",.003)


def cabin(width, front, rear, topfront, toprear, bottom, top, paint):
    w, t = width/2, width*.41
    vertices=[(-w,front,bottom),(w,front,bottom),(w,rear,bottom),(-w,rear,bottom),
              (-t,topfront,top),(t,topfront,top),(t,toprear,top),(-t,toprear,top)]
    mesh("GlazedCabin",vertices,[(0,1,2,3),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0),(4,7,6,5)],"BH_Glass",.018)
    box("CabinRoof",(width*.83,toprear-topfront+.10,.09),(0,(topfront+toprear)/2,top+.025),paint,.032)
    for sign in (-1,1):
        beam("APillar",(sign*w,front-.01,bottom),(sign*t,topfront-.01,top),.042,paint)
        beam("CPillar",(sign*w,rear+.01,bottom),(sign*t,toprear+.01,top),.046,paint)
        beam("BPillar",(sign*w,(front+rear)/2,bottom),(sign*t,(front+rear)/2,top),.031,"BH_Metal_Dark")
        beam("WindowSill",(sign*w,front,bottom),(sign*w,rear,bottom),.030,paint)


def car(kind):
    van = kind == "Van"
    hatch = kind == "Hatchback"
    abandoned = kind == "Abandoned"
    length = 4.65 if van else (4.12 if hatch else 4.48)
    width = 1.95 if van else 1.82
    paint = "BH_Plastic_Light" if van else ("BH_Metal_Mid" if hatch else "BH_Muted_Green")
    half = length/2
    axle = 1.37 if not hatch else 1.21
    radius = .35 if van else .33
    # Wheel openings are in the side silhouette, not painted rectangles.
    lower=[(-half,.39)]
    for center in (-axle,axle):
        lower.append((center-.40,.39))
        for i in range(7):
            a = pi-i*pi/6
            lower.append((center+cos(a)*.40,.39+sin(a)*.43))
    lower += [(half,.39),(half,.87),(half-.16,1.01),(half-.65,1.04),(-half+.6,1.00),(-half,.84)]
    prism("VehicleBody",lower,width,paint,.030)
    box("Chassis",(width*.76,length*.89,.17),(0,0,.40),"BH_Metal_Dark",.018)
    for x in (-width/2,width/2):
        for y in (-axle,axle):
            wheel(x,y,radius,.20,abandoned)
    if van:
        cabin(width*.97,-1.65,1.82,-1.12,1.68,.98,1.91,paint)
        # Solid cargo sides replace rear glazing, leaving a distinct tall cabin.
        for sign in (-1,1):
            box("CargoPanel",(.075,2.6,.76),(sign*width*.456,.41,1.40),paint,.024)
            box("CargoRail",(.095,3.9,.13),(sign*width*.50,.10,.90),"BH_Metal_Mid",.012)
            box("VanHandle",(.032,.25,.05),(sign*width*.501,-.7,1.05),"BH_Metal_Dark",.006)
        box("CargoRear",(width*.88,.06,.76),(0,1.95,1.40),paint,.022)
        box("RearDoorSeam",(.025,.07,.76),(0,1.99,1.4),"BH_Metal_Mid",.003)
        box("DeliveryStripe",(width*.88,.025,.14),(0,2.00,1.15),"BH_Warm_Orange",.008)
    else:
        cabin(width,-1.1,1.32 if hatch else 1.08,-.54,1.03 if hatch else .63,1.00,1.57 if hatch else 1.47,paint)
        for sign in (-1,1):
            for y in (-.43,.57):
                box("DoorHandle",(.026,.19,.045),(sign*(width/2+.008),y,.94),"BH_Metal_Dark",.007)
            beam("DoorSeam",(sign*(width/2+.008),.17,.52),(sign*(width/2+.008),.17,1.0),.008,"BH_Concrete_Dark")
        box("HoodInset",(width*.73,.65,.025),(0,-half+.45,.96),paint,.016)
    for sign in (-1,1):
        box("WingMirror",(.18,.24,.13),(sign*(width/2+.07),-.83,1.2),"BH_Metal_Dark",.022)
        box("HeadLamp",(.32,.065,.15),(sign*width*.32,-half-.022,.73),"BH_Emission_Warm",.018,group="LightMesh")
        box("TailLamp",(.25,.06,.14),(sign*width*.34,half+.02,.77),"BH_Emergency_Red",.018)
    for y in (-half,half):
        box("Bumper",(width+.035,.12,.17),(0,y,.43),"BH_Metal_Dark",.024)
        box("LicenseBlank",(.37,.023,.12),(0,y*1.031,.65),"BH_Plastic_Light",.008)
    box("Grille",(.63,.06,.15),(0,-half-.036,.73),"BH_Metal_Dark",.011)
    if abandoned:
        panel("PatchedBonnet",[(-.7,-2.12,1.005),(.68,-2.12,1.005),(.50,-1.49,1.045),(-.6,-1.49,1.045)],"BH_Concrete_Dark",.012,axis=2)
        beam("WindshieldCrack",(-.3,-.99,1.10),(.18,-.70,1.34),.008,"BH_Concrete_Dark")
        beam("WindshieldCrack",(.18,-.70,1.34),(.45,-.82,1.24),.008,"BH_Concrete_Dark")
        box("TrunkLatch",(.18,.045,.12),(0,half+.05,.91),"BH_Safety_Yellow",.008)
    bounds_proxy(width,length,2 if van else 1.62)


def bus():
    width, length = 2.5, 9.0
    # Slightly raked nose, broad civilian windows, softened roof, no tank silhouette.
    prism("BusBody",[(-4.5,.52),(4.5,.52),(4.5,2.67),(4.24,2.98),(-3.96,2.98),(-4.5,2.46)],width,"BH_Plastic_Light",.055)
    box("Underbody",(2.22,8.7,.28),(0,0,.48),"BH_Metal_Dark",.03)
    for x in (-1.23,1.23):
        for y in (-2.95,2.9):
            wheel(x,y,.46,.25)
    for sign in (-1,1):
        box("CommunityStripe",(.055,8.8,.44),(sign*1.265,0,1.20),"BH_Warm_Orange",.024)
        for y in (-3.3,-2.02,-.74,.54,1.82,3.1):
            if sign==1 and y==-2.02:
                continue
            box("BusWindow",(.04,1.08,.80),(sign*1.266,y,2.15),"BH_Glass",.03)
            box("WarmWindowLine",(.017,.92,.04),(sign*1.295,y,2.49),"BH_Emission_Warm",.004,group="LightMesh")
        box("LowerSideGuard",(.09,5.20,.20),(sign*1.29,.25,.80),"BH_Metal_Mid",.02)
        box("CommunityBadgeBlank",(.072,1.18,.39),(sign*1.307,.55,1.25),"BH_Plastic_Light",.018)
        # One small practical protective grille per side, restricted to rear windows.
        for y in (2.67,3.10,3.53):
            beam("WindowGuard",(sign*1.32,y,1.83),(sign*1.32,y,2.5),.014,"BH_Metal_Mid")
        for z in (1.98,2.29):
            beam("WindowGuard",(sign*1.32,2.64,z),(sign*1.32,3.56,z),.014,"BH_Metal_Mid")
    # Door stays independent for the existing Godot closing animation.
    box("DoorwayRecess",(.035,1.02,2.02),(1.30,-2.02,1.53),"BH_Plastic_Dark",.008)
    box("BusDoor",(.09,.98,2.00),(1.32,-2.02,1.53),"BH_Metal_Dark",.025,group="Door")
    for y in (-2.25,-1.79):
        box("DoorGlass",(.024,.37,1.19),(1.38,y,1.76),"BH_Glass",.014,group="Door")
        box("DoorLowerPanel",(.024,.37,.47),(1.38,y,.82),"BH_Warm_Orange",.014,group="Door")
    box("DoorStep",(.22,1.02,.15),(1.29,-2.02,.48),"BH_Metal_Dark",.024)
    panel("Windshield",[(-1.08,-4.512,1.74),(1.08,-4.512,1.74),(1.06,-4.512,2.42),(-1.06,-4.512,2.42)],"BH_Glass",.015)
    for x in (-.65,.65):
        beam("Wiper",(x,-4.54,1.80),(x-.35,-4.54,2.13),.016)
        box("FrontLamp",(.43,.065,.24),(x,-4.54,1.00),"BH_Emission_Warm",.025,group="LightMesh")
        box("TailLight",(.17,.065,.40),(x,4.54,1.23),"BH_Emergency_Red",.022)
    box("DestinationBlank",(1.6,.05,.22),(0,-4.44,2.61),"BH_Metal_Dark",.02)
    box("RearWindow",(1.75,.055,.64),(0,4.515,2.22),"BH_Glass",.025)
    for y in (-4.5,4.5):
        box("ReinforcedBumper",(2.55,.22,.24),(0,y,.67),"BH_Metal_Mid",.032)
    for sign in (-1,1):
        beam("BusMirrorArm",(sign*1.1,-3.7,2.4),(sign*1.49,-4.15,2.35),.028,"BH_Metal_Mid")
        box("BusMirror",(.13,.20,.32),(sign*1.49,-4.15,2.21),"BH_Metal_Dark",.02)
    # Roof rack, canvas bundles and modest amber beacons.
    box("RoofRackFloor",(2.14,4.7,.09),(0,.30,3.08),"BH_Metal_Dark",.02)
    for x in (-1.05,1.05):
        beam("RoofRail",(x,-2.1,3.43),(x,2.7,3.43),.03,"BH_Metal_Mid")
        for y in (-2.1,.3,2.7):
            beam("RackUpright",(x,y,3.10),(x,y,3.43),.025,"BH_Metal_Mid")
    for y in (-2.1,2.7):
        beam("RackEnd",(-1.05,y,3.43),(1.05,y,3.43),.028,"BH_Metal_Mid")
    for x,y,sz in ((-.43,-.95,(.82,1.15,.37)),(.46,.1,(.74,1.15,.46)),(-.30,1.50,(1.30,.72,.38))):
        box("SupplyBundle",sz,(x,y,3.18+sz[2]/2),"BH_Muted_Green",.045)
        for dy in (-sz[1]*.3,sz[1]*.3):
            box("SupplyStrap",(sz[0]+.015,.055,.014),(x,y+dy,3.18+sz[2]+.01),"BH_Concrete_Dark",.004)
    for x in (-.72,.72):
        cylinder("BeaconBase",.14,.09,(x,-3.30,3.05),"BH_Metal_Dark",12)
        cylinder("AmberBeacon",.12,.19,(x,-3.30,3.19),"BH_Emission_Warm",12,top=.095,group="LightMesh")
    bounds_proxy(2.65,9.22,3.0)


def build(asset_id):
    if asset_id == "BH_EvacBus_01":
        bus()
    else:
        car({"BH_Car_Sedan_01":"Sedan","BH_Car_Hatchback_01":"Hatchback","BH_Van_01":"Van","BH_AbandonedCar_01":"Abandoned"}[asset_id])
