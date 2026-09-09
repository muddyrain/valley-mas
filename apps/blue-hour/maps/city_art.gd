extends RefCounted
const Assets = preload("res://vfx/generated_assets.gd")
const Visuals = preload("res://vfx/visuals.gd")
const BUILDINGS = {"corner":"BH_Building_Supermarket_01", "market":"BH_Building_Supermarket_01", "pharmacy":"BH_Building_Pharmacy_01", "garage":"BH_Building_Warehouse_01", "depot":"BH_Building_Warehouse_01"}
const VEHICLES = {"van_south":"BH_Van_01", "van_north":"BH_Van_01", "car_west":"BH_AbandonedCar_01"}

static func streets(city: Node3D, data: Resource) -> void:
	Visuals.box(city, Vector3(data.half_width*2+5,.5,data.half_depth*2+5), Vector3(0,-.5,0), Color("#656B6D"))
	# Keep the existing street locations. Short end pieces bridge the 20 m junction.
	for section in [[-24,8],[-16,8],[-8,8],[0,8],[8,8],[14,4],[20,8],[26,4]]:
		var crossing: bool = section[0] in [-24,0,20]
		var road := Assets.spawn("BH_Road_Cross" if crossing else "BH_Road_Straight", city, Vector3(0,-.09,section[0]))
		road.scale = Vector3(2,1,float(section[1])/8)
	for z in [-24,0,20]:
		for x in [-28,-20,-12,12,20,28]:
			Assets.spawn("BH_Road_Straight", city, Vector3(x,-.09,z), PI*.5)
	for x in [-9,9]:
		for z in [-16,-8,8]:
			Assets.spawn("BH_Sidewalk_Straight", city, Vector3(x,-.15,z))
	for x in [-4,4]:
		Assets.spawn("BH_Crosswalk", city, Vector3(x,.008,16))
	for x in [-11,11,-29,29]:
		for z in [-22,0,20]:
			var lamp := Assets.spawn("BH_StreetLamp_01",city,Vector3(x,0,z),0 if x<0 else PI)
			Assets.collect_lamps(lamp,city.lamps)
			if abs(x) == 11 and z in [0,20]:
				var light := OmniLight3D.new()
				lamp.add_child(light)
				light.position = Vector3(1.3,4.7,0)
				light.light_color = Color("#E8B36A")
				light.omni_range = 8.5
				light.shadow_enabled = false
				light.light_energy = 0
				city.accent_lights.append(light)

static func site(city: Node3D, parent: Node3D, spec: Dictionary, vehicle: bool) -> Node3D:
	var id: String = VEHICLES[spec.id] if vehicle else BUILDINGS[spec.id]
	var body := Assets.fit_site(id,parent,spec.position,spec.size)
	Assets.collect_lamps(body,city.lamps)
	if not vehicle:
		var roof_y: float = 4.85 if id.contains("Warehouse") else (3.95 if id.contains("Pharmacy") else 4.05)
		Assets.spawn("BH_AC_Outdoor",body,Vector3(-2,roof_y,-1))
		if id.contains("Warehouse"):
			Assets.spawn("BH_Pallet",body,Vector3(-3.6,0,4.75))
			Assets.spawn("BH_WoodCrate",body,Vector3(-3.6,.17,4.75))
	return body
