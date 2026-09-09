extends RefCounted

const IDS=["continent","box_world","islands","boring_plains","donut","toast","pancake","fjords"]
const NAMES=["大陆","盒中世界","岛屿","无聊平原","甜甜圈","面包片","热香饼","峡湾双陆"]
const CONTROLS={
	"continent":[["land_size","陆块大小",1,10],["islands","附岛数量",0,6],["coast","海岸曲折",0,10]],
	"box_world":[["land_size","陆地比例",1,10],["lakes","湖海数量",1,4],["coast","湖岸曲折",0,10]],
	"islands":[["land_size","岛屿大小",1,10],["islands","岛屿数量",3,7],["coast","海岸曲折",0,10]],
	"boring_plains":[],
	"donut":[["land_size","圆环大小",1,10],["ring_width","环带宽度",1,10],["coast","海岸曲折",0,10]],
	"toast":[["land_size","陆块大小",1,10],["coast","海岸曲折",0,10]],
	"pancake":[["land_size","陆块大小",1,10],["coast","海岸曲折",0,10]],
	"fjords":[["land_size","陆块大小",1,10],["strait_width","海峡宽度",1,10],["coast","峡湾曲折",0,10]]
}
const RIVER_TYPES=["continent","box_world","islands","fjords"]

# Historical saves keep the original common fields; new controls are additive.
static func settings(config: Dictionary) -> Dictionary:
	return {"land_size":clampi(int(config.get("land_size",6)),1,10),"islands":clampi(int(config.get("islands",3)),0,12),"coast":clampi(int(config.get("coast",4)),0,10),"trees":clampf(float(config.get("trees",.8)),0,1),"rivers":bool(config.get("rivers",true)),"lakes":clampi(int(config.get("lakes",2)),1,4),"ring_width":clampi(int(config.get("ring_width",6)),1,10),"strait_width":clampi(int(config.get("strait_width",5)),1,10)}

static func recipe(type: String, config: Dictionary={}) -> Dictionary:
	var result=settings(config)
	if type=="islands": result.islands=clampi(int(config.get("islands",5)),3,7)
	elif type=="continent": result.islands=clampi(result.islands,0,6)
	if type not in RIVER_TYPES: result.rivers=false
	return result
