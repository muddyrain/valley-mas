"""Basic humanoid only; intentionally not a final survivor or boss."""
from utils.geometry import box, sphere, beam, prism


def build(asset_id):
    if asset_id != "BH_Infected_Basic_Placeholder":
        raise KeyError(asset_id)
    for x in (-.13,.13):
        box("WornShoe",(.18,.31,.14),(x,-.06,.07),"BH_Plastic_Dark",.020)
        beam("TrouserLeg",(x,0,.18),(x,.05,.73),.09,"BH_Metal_Mid")
    prism("TornJacket",[(-.13,.65),(.17,.72),(.14,1.27),(-.21,1.39),(-.28,1.0)],.45,"BH_Muted_Green",.025)
    sphere("Neck",.10,(0,-.19,1.43),"BH_Concrete_Light",(.8,.8,1))
    sphere("PaleHead",.21,(0,-.23,1.62),"BH_Concrete_Light",(.78,.88,1.06))
    box("BrowShadow",(.22,.03,.05),(0,-.42,1.66),"BH_Concrete_Dark",.01)
    for sign in (-1,1):
        beam("JacketSleeve",(sign*.25,-.07,1.29),(sign*.37,-.21,1.04),.09,"BH_Muted_Green")
        beam("LongForearm",(sign*.37,-.21,1.04),(sign*.42,-.36,.71),.065,"BH_Concrete_Light")
        sphere("Hand",.095,(sign*.42,-.38,.65),"BH_Concrete_Light",(.7,.85,1.1))
    box("TornHem",(.14,.13,.18),(-.14,-.20,.63),"BH_Muted_Green",.008,rotation=(.1,.17,0))
    box("DarkAnomaly",(.11,.027,.14),(.13,-.274,1.10),"BH_Emergency_Red",.008)
