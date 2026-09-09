"""Reusable street furniture and readable search-container silhouettes."""
from math import pi
from utils.geometry import box, cylinder, sphere, beam, prism, panel, part
from utils.collision import bounds_proxy, proxy


def lamp(double=False):
    cylinder("LampBase", .23, .18, (0,0,.09), "BH_Metal_Mid", 12)
    cylinder("LampPole", .075, 5.65, (0,0,2.95), "BH_Metal_Mid", 12, top=.055)
    for sign in ((-1,1) if double else (1,)):
        beam("LampShoulder", (0,0,5.50), (sign*.7,0,5.9), .065, "BH_Metal_Mid")
        beam("LampArm", (sign*.7,0,5.9), (sign*1.25,0,5.9), .055, "BH_Metal_Mid")
        box("LampHousing", (.62,.35,.17), (sign*1.3,0,5.87), "BH_Metal_Dark", .025)
        box("LampLight", (.46,.27,.035), (sign*1.3,0,5.775), "BH_Emission_Warm", .008, group="LightMesh")
    bounds_proxy(.22,.22,5.6)


def pallet():
    for x in (-.48,0,.48):
        box("PalletRunner", (.16,.95,.10), (x,0,.05), "BH_Concrete_Dark", .007)
    for y in (-.39,-.195,0,.195,.39):
        box("PalletSlat", (1.2,.15,.065), (0,y,.135), "BH_Plastic_Light", .008)


def crate(metal=False, searchable=False):
    color = "BH_Muted_Green" if searchable else ("BH_Metal_Mid" if metal else "BH_Plastic_Light")
    size = (1.2,.85,.72) if searchable else (.9,.85,.85)
    x,y,z = size
    box("CrateShell", size, (0,0,z/2), color, .025)
    for sx in (-1,1):
        for sy in (-1,1):
            box("CrateCorner", (.085,.085,z), (sx*(x/2-.02),sy*(y/2-.02),z/2), "BH_Metal_Dark" if metal or searchable else "BH_Warm_Orange", .008)
    if metal or searchable:
        box("Lid", (x+.04,y+.04,.10), (0,0,z+.035), color, .021)
        for sx in (-1,1):
            box("SideHandle", (.035,.25,.08), (sx*(x/2+.01),0,z*.6), "BH_Plastic_Dark", .006)
        for px in (-x*.28,x*.28):
            box("Latch", (.10,.065,.20), (px,-y/2-.025,z-.05), "BH_Safety_Yellow" if searchable else "BH_Plastic_Light", .008)
        if searchable:
            box("LidMark", (.33,.24,.01), (0,0,z+.09), "BH_Safety_Yellow", .006)
            box("LidMarkInset", (.24,.16,.012), (0,0,z+.092), "BH_Metal_Dark", .004)
    else:
        for py in (-y/2,y/2):
            for pz in (.22,.48,.7):
                box("BoardJoint", (x-.08,.01,.016), (0,py,pz), "BH_Concrete_Dark", 0)
            beam("WoodBrace", (-x*.4,py-.01,.12), (x*.4,py-.01,z-.12), .045, "BH_Warm_Orange")


def vending(searchable=False):
    box("VendingFeet", (.83,.66,.12), (0,0,.06), "BH_Metal_Dark", .016)
    box("VendingCabinet", (.98,.72,1.72), (0,0,.98), "BH_Metal_Mid" if searchable else "BH_Muted_Green", .032)
    box("DisplayRecess", (.66,.025,1.05), (-.10,-.375,1.13), "BH_Glass", .012)
    for z in (.78,1.07,1.36):
        box("Shelf", (.58,.10,.033), (-.10,-.402,z-.12), "BH_Plastic_Light", .005)
        for x in (-.29,-.1,.09):
            cylinder("Bottle", .045,.16,(x,-.407,z), "BH_Warm_Orange" if z>1.2 else "BH_Plastic_Light", 8)
    box("PaymentPanel", (.17,.035,.50), (.35,-.382,1.25), "BH_Plastic_Dark", .01)
    box("Reader", (.10,.02,.09), (.35,-.409,1.4), "BH_Plastic_Light", .005)
    box("ProductSlot", (.60,.05,.20), (-.08,-.382,.4), "BH_Plastic_Dark", .012)
    box("VendingHeader", (.82,.03,.15), (0,-.375,1.72), "BH_Plastic_Light", .008)
    if searchable:
        box("ServiceLatch", (.13,.04,.18), (.38,-.401,.56), "BH_Safety_Yellow", .012)
        box("ServiceHinge", (.07,.05,.8), (-.46,-.40,1.1), "BH_Metal_Dark", .008)


def fence(broken=False):
    for x in (-1.5,1.5):
        box("FenceFoot", (.30,.32,.12), (x,0,.06), "BH_Concrete_Dark", .014)
        box("FencePost", (.10,.10,1.92), (x,0,1.03), "BH_Metal_Mid", .01)
    for z in (.4,1.7):
        if not broken:
            box("FenceRail", (3,.07,.07), (0,0,z), "BH_Metal_Dark", .008)
        else:
            beam("BentRail", (-1.5,0,z), (-.35,-.2,z-.25), .033)
            beam("BentRail", (.45,.35,max(.12,z-.6)), (1.5,0,z), .033)
    for i in range(9):
        x = -1.24+i*.31
        if broken and abs(x)<.45:
            continue
        beam("FenceBar", (x,0,.3), (x+(.12 if broken else 0),-.05 if broken else 0,1.8), .023)


def dumpster():
    for x in (-.63,.63):
        for y in (-.36,.36):
            cylinder("DumpsterCaster", .10,.10,(x,y,.10), "BH_Plastic_Dark", 10, (0,pi/2,0))
    prism("DumpsterBody", [(-.5,.24),(.5,.24),(.6,1.1),(-.6,1.1)],1.6,"BH_Muted_Green",.025)
    box("DumpsterLid", (1.68,1.22,.12), (0,0,1.15), "BH_Plastic_Dark", .03, rotation=(.04,0,0))
    for x in (-.48,.48):
        box("LidRib", (.055,1.05,.06), (x,0,1.23), "BH_Metal_Dark", .012)
    box("DumpsterHandle", (.4,.08,.08), (0,-.66,1.10), "BH_Safety_Yellow", .014)
    for x in (-.6,.6):
        box("DumpsterWarning", (.18,.023,.18), (x,-.602,.87), "BH_Plastic_Light", .008)


def trunk():
    box("TrunkFloor", (1.55,.95,.16), (0,0,.08), "BH_Metal_Mid", .025)
    for x in (-.7,.7):
        box("TrunkSide", (.15,.95,.55), (x,0,.32), "BH_Metal_Mid", .022)
    box("TrunkLining", (1.3,.84,.06), (0,0,.2), "BH_Plastic_Dark", .015)
    box("OpenTrunkLid", (1.55,.10,.85), (0,.45,.75), "BH_Metal_Mid", .03, rotation=(.35,0,0))
    box("TrunkLatch", (.20,.065,.12), (0,-.48,.24), "BH_Safety_Yellow", .01)
    for x in (-.58,.58):
        box("TrunkTailLamp", (.24,.06,.15), (x,-.49,.31), "BH_Emergency_Red", .014)


def build(asset_id):
    key = asset_id.removeprefix("BH_")
    if key.startswith("StreetLamp"):
        lamp(key.endswith("02"))
        return
    if key == "Pallet":
        pallet(); bounds_proxy(1.2,.95,.17)
    elif key in ("WoodCrate","MetalCrate","Searchable_Crate"):
        crate(key != "WoodCrate", key == "Searchable_Crate")
        bounds_proxy(1.2 if key.startswith("Searchable") else .9,.85,.81 if key.startswith("Searchable") else .95)
    elif key in ("VendingMachine","Searchable_VendingMachine"):
        vending(key.startswith("Searchable")); bounds_proxy(.98,.72,1.84)
    elif key in ("Fence","Fence_Broken"):
        fence(key.endswith("Broken"))
        if key.endswith("Broken"):
            proxy((1.15,.35,1.9),(-1,0,.95),0)
            proxy((1.15,.35,1.9),(1,0,.95),1)
        else:
            bounds_proxy(3.1,.1,2)
    elif key == "Searchable_Dumpster":
        dumpster(); bounds_proxy(1.6,1.2,1.25)
    elif key == "Searchable_CarTrunk":
        trunk(); bounds_proxy(1.55,.95,.58)
    elif key == "TrashBin_01":
        cylinder("BinBody", .28,.8,(0,0,.43),"BH_Muted_Green",12,top=.34)
        cylinder("BinBase", .30,.07,(0,0,.035),"BH_Metal_Dark",12)
        cylinder("BinLid", .36,.12,(0,0,.88),"BH_Metal_Dark",12,top=.30)
        box("BinOpening", (.30,.025,.10),(0,-.32,.85),"BH_Plastic_Dark",.014)
        bounds_proxy(.65,.65,.94)
    elif key == "Bench_01":
        for x in (-.65,.65):
            box("BenchLeg", (.12,.5,.4),(x,0,.2),"BH_Metal_Dark",.017)
            beam("BackSupport",(x,.19,.35),(x,.32,.88),.04)
            beam("ArmRest",(x,-.22,.65),(x,.28,.65),.032)
        for y in (-.19,0,.19):
            box("SeatSlat", (1.8,.15,.065),(0,y,.45),"BH_Plastic_Light",.012)
        for z in (.65,.82):
            box("BackSlat", (1.8,.07,.13),(0,.31,z),"BH_Plastic_Light",.012,rotation=(.10,0,0))
        bounds_proxy(1.8,.58,.9)
    elif key == "Barrier_Concrete":
        prism("JerseyBarrier",[(-.4,0),(.4,0),(.4,.18),(.18,.62),(.16,.95),(-.16,.95),(-.18,.62),(-.4,.18)],2.4,"BH_Concrete_Light",.024)
        for x in (-.78,.78):
            box("BarrierReflector",(.25,.022,.10),(x,-.181,.72),"BH_Safety_Yellow",.005)
        bounds_proxy(2.4,.8,.95)
    elif key == "Barricade_Metal":
        for x in (-.85,.85):
            beam("StandLeg",(x,-.4,.04),(x,.25,1.08),.045,"BH_Metal_Mid")
            beam("StandLeg",(x,.4,.04),(x,-.25,1.08),.045,"BH_Metal_Mid")
        box("BarrierBoard",(2.1,.10,.38),(0,0,.82),"BH_Safety_Yellow",.024)
        for x in (-.7,-.2,.3,.8):
            panel("WarningSlash",[(x-.13,-.06,.65),(x+.02,-.06,.65),(x+.23,-.06,.99),(x+.08,-.06,.99)],"BH_Metal_Dark")
        bounds_proxy(2.1,.8,1.12)
    elif key == "TrafficCone":
        box("ConeFoot",(.43,.43,.055),(0,0,.0275),"BH_Plastic_Dark",.025)
        cylinder("Cone",.175,.55,(0,0,.32),"BH_Warm_Orange",12,top=.035)
        cylinder("ConeBand",.102,.11,(0,0,.38),"BH_Plastic_Light",12,top=.074)
        bounds_proxy(.43,.43,.60)
    elif key == "RoadSign":
        cylinder("SignFoot",.16,.12,(0,0,.06),"BH_Concrete_Dark",12)
        cylinder("SignPost",.035,2.4,(0,0,1.27),"BH_Metal_Mid",10)
        panel("DirectionSign",[(-.6,-.05,1.94),(.36,-.05,1.94),(.65,-.05,2.2),(.36,-.05,2.46),(-.6,-.05,2.46)],"BH_Muted_Green",.07)
        box("DirectionBar",(.63,.016,.06),(-.1,-.066,2.2),"BH_Plastic_Light",.002)
        bounds_proxy(.2,.2,2.5)
    elif key == "GarbageBag_Set":
        for i,(x,y,r) in enumerate(((-.26,0,.30),(.26,.08,.25),(0,.30,.22))):
            sphere("GarbageBag",r,(x,y,r*1.05),"BH_Plastic_Dark",(1,.88,1.05))
            cylinder("BagTie",.045,.11,(x,y,r*1.98),"BH_Plastic_Dark",8,top=.012)
        bounds_proxy(1.1,.8,.67)
    elif key == "AC_Outdoor":
        for x in (-.3,.3):
            box("ACFeet",(.12,.5,.12),(x,0,.06),"BH_Metal_Dark",.008)
        box("ACCase",(.95,.40,.61),(0,0,.40),"BH_Plastic_Light",.024)
        cylinder("FanRecess",.235,.022,(-.17,-.218,.40),"BH_Metal_Dark",16,(pi/2,0,0))
        cylinder("FanHub",.055,.032,(-.17,-.24,.40),"BH_Metal_Mid",12,(pi/2,0,0))
        for z in (.24,.34,.44,.54):
            box("ACGrille",(.28,.022,.025),(.29,-.215,z),"BH_Metal_Mid",.003)
        for x in (-.3,-.17,-.04):
            box("FanGuard",(.018,.018,.4),(x,-.245,.4),"BH_Metal_Mid",.002)
        bounds_proxy(.95,.5,.72)
    else:
        raise KeyError(asset_id)
