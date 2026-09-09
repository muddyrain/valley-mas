"""Fictional modern equipment silhouettes. Origin: grip, muzzle: Blender +Y."""
from math import pi
from utils.geometry import box, cylinder, beam, prism, part


def grip():
    prism("Grip",[(-.055,-.13),(.025,-.14),(.075,.045),(-.012,.065)],.043,"BH_Plastic_Dark",.006)
    for z in (-.095,-.064,-.033):
        box("GripRib",(.047,.007,.008),(-0.0,-.040,z),"BH_Metal_Mid",.0015)


def receiver(length, width=.062):
    prism("Receiver",[(-.095,.035),(length-.02,.035),(length,.075),(length-.035,.15),(-.095,.15),(-.12,.10)],width,"BH_Metal_Mid",.007)
    box("TopRail",(width*.63,length*.82,.015),(0,length*.37,.161),"BH_Metal_Dark",.003)
    box("SelectorMark",(.005,.035,.018),(width/2+.003,-.015,.11),"BH_Safety_Yellow",.002)
    box("EjectionRecess",(.006,.068,.027),(width/2+.004,.092,.105),"BH_Metal_Dark",.002)


def barrel(y_start, length, radius=.014):
    cylinder("Barrel",radius,length,(0,y_start+length/2,.099),"BH_Metal_Dark",12,(pi/2,0,0))
    cylinder("MuzzleCollar",radius*1.36,.031,(0,y_start+length,.099),"BH_Metal_Mid",12,(pi/2,0,0))
    cylinder("MuzzleRecess",radius*.68,.003,(0,y_start+length+.017,.099),"BH_Plastic_Dark",12,(pi/2,0,0))


def trigger_guard():
    beam("TriggerGuard",(0,-.012,.025),(0,.030,-.040),.005)
    beam("TriggerGuard",(0,.030,-.040),(0,.103,-.030),.005)
    beam("TriggerGuard",(0,.103,-.030),(0,.110,.035),.005)


def magazine(y=.16, length=.15, slant=.025):
    prism("Magazine",[(y-.035,.04),(y+.040,.04),(y+.040-slant,-length),(y-.036-slant,-length)],.042,"BH_Plastic_Dark",.005)
    box("MagazineBase",(.045,.080,.018),(0,y-slant,-length),"BH_Metal_Mid",.003)


def stock(length=.28):
    prism("Stock",[(-.11,.04),(-.11,.135),(-length,.13),(-length-.05,.08),(-length-.05,-.055),(-length+.02,-.055),(-length+.045,.03)],.052,"BH_Plastic_Dark",.009)
    box("ButtPad",(.064,.025,.16),(0,-length-.056,.025),"BH_Metal_Dark",.005)
    box("StockMark",(.057,.038,.025),(0,-length+.04,.108),"BH_Warm_Orange",.003)


def build(asset_id):
    kind = asset_id.split("_")[1]
    grip()
    trigger_guard()
    if kind == "Pistol":
        receiver(.15,.040)
        box("Slide",(.045,.252,.045),(0,.035,.145),"BH_Metal_Dark",.007)
        barrel(.15,.015,.012)
        box("RearSight",(.04,.018,.016),(0,-.074,.180),"BH_Metal_Mid",.002)
        box("FrontSight",(.012,.016,.014),(0,.145,.180),"BH_Safety_Yellow",.002)
    elif kind == "SMG":
        receiver(.26,.060)
        magazine(.115,.13,.025)
        # Open two-strut shoulder brace differentiates the compact SMG.
        for x in (-.021,.021):
            beam("Brace",(x,-.09,.1),(x,-.25,.09),.009,"BH_Metal_Mid")
        box("BraceHeel",(.060,.025,.11),(0,-.26,.045),"BH_Plastic_Dark",.005)
        barrel(.26,.095)
        box("ForeGrip",(.048,.093,.065),(0,.205,-.008),"BH_Plastic_Dark",.006)
        box("ReceiverBand",(.065,.031,.12),(0,.244,.09),"BH_Warm_Orange",.004)
    elif kind == "AR":
        receiver(.32,.066)
        stock(.31)
        magazine(.155,.19,.033)
        box("Handguard",(.073,.23,.10),(0,.33,.088),"BH_Plastic_Dark",.008)
        for x in (-.039,.039):
            for y in (.26,.32,.38,.44):
                box("CoolingRecess",(.005,.033,.024),(x,y,.10),"BH_Metal_Mid",.003)
        barrel(.45,.13)
        box("FrontPost",(.025,.031,.071),(0,.475,.166),"BH_Metal_Dark",.003)
        box("RearSight",(.045,.028,.034),(0,-.033,.184),"BH_Metal_Dark",.004)
        box("ForeEndMark",(.077,.045,.027),(0,.409,.148),"BH_Safety_Yellow",.003)
    elif kind == "Shotgun":
        receiver(.24,.074)
        stock(.34)
        barrel(.24,.45,.021)
        cylinder("Tube",.016,.45,(0,.43,.045),"BH_Metal_Mid",12,(pi/2,0,0))
        box("Pump",(.082,.23,.093),(0,.35,.052),"BH_Plastic_Dark",.009)
        for y in (.27,.31,.35,.39,.43):
            box("PumpRib",(.087,.014,.095),(0,y,.052),"BH_Metal_Mid",.002)
        box("FrontBead",(.012,.021,.024),(0,.68,.13),"BH_Safety_Yellow",.002)
        box("ReceiverBadge",(.007,.055,.036),(.041,.12,.106),"BH_Warm_Orange",.004)
    else:
        raise KeyError(asset_id)
