extends SceneTree

const World=preload("res://scripts/world_data.gd")
const View=preload("res://scripts/world_view.gd")
var view
var samples: Array=[]

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.size=Vector2i(1440,900)
	Engine.max_fps=120
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	view=View.new(); root.add_child(view); view.size=Vector2(1440,720)
	var w=World.generate({"width":384,"height":256,"seed":781936,"template":"continent","trees":.9})
	view.set_world(w)
	var arguments=OS.get_cmdline_user_args()
	var weather_stress=arguments.has("weather")
	for frame in 30: await process_frame
	for rate in [0,1,5]:
		for distance in 3:
			for movement in ["pan","zoom"]:
				view.set_distance(distance)
				if weather_stress:
					w.rain_clouds.clear()
					for offset in [Vector2i(-35,-10),Vector2i(0,0),Vector2i(35,10)]:
						World.Weather.add_cloud(w,Vector2i(w.width/2,w.height/2)+offset,28,0)
					view.effects.queue_redraw()
				view.paused=rate==0
				var initial_zoom: float=view.zoom
				var initial_camera: Vector2=view.camera
				var times: Array=[]
				var model_ms: Array=[]; var view_ms: Array=[]
				for frame in 150:
					var started=Time.get_ticks_usec()
					if movement=="pan":
						view.pan_camera(Vector2(4.5,2.0)*(1 if frame%60<30 else -1))
					else:
						view.zoom_at(view.size*.5,1.022 if frame%60<30 else 1/1.022)
					if rate>0:
						var a=Time.get_ticks_usec()
						w.advance(1.0/60*rate)
						var b=Time.get_ticks_usec()
						view.refresh_ecology()
						model_ms.append((b-a)/1000.0); view_ms.append((Time.get_ticks_usec()-b)/1000.0)
					await process_frame
					times.append((Time.get_ticks_usec()-started)/1000.0)
				var summary=stats(times)
				if rate>0: summary.merge({"model_max_ms":model_ms.max(),"view_max_ms":view_ms.max()})
				summary.merge({"rate":rate,"distance":distance,"motion":movement})
				samples.append(summary)
				print(JSON.stringify(summary))
				view.zoom=initial_zoom; view.camera=initial_camera; view.queue_redraw()
	var tag=arguments[0] if not arguments.is_empty() else "after"
	var file=FileAccess.open("res://test-output/motion-"+tag+".json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"size":[384,256],"plants":w.plant_count(),"samples":samples},"\t"))
	quit()

func stats(values: Array) -> Dictionary:
	values.sort()
	var slow33=0; var slow50=0
	for value in values:
		if value>33: slow33+=1
		if value>50: slow50+=1
	return {"p50_ms":values[int(values.size()*.5)],"p95_ms":values[int(values.size()*.95)],"p99_ms":values[int(values.size()*.99)],"max_ms":values[-1],"over33":slow33,"over50":slow50}
