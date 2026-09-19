extends Node3D
## Isolated review of the same shared AnimationLibrary on frozen candidates.
const IDS: Array[String] = ["canonical", "xia_zhiyao", "su_wanxing"]
const CLIPS: Array[StringName] = [&"public_idle", &"public_walking", &"public_running"]
const LIBRARY: AnimationLibrary = preload("res://assets/public_locomotion.tres")
var actors: Array[Node3D] = []
var players: Array[AnimationPlayer] = []
var camera: Camera3D
var label: Label
var actor_index: int = 1
var clip_index: int = 0
var view_index: int = 0

func _ready() -> void:
    var environment := WorldEnvironment.new()
    environment.environment = Environment.new()
    environment.environment.background_mode = Environment.BG_COLOR
    environment.environment.background_color = Color("#293442")
    environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.environment.ambient_light_color = Color.WHITE
    environment.environment.ambient_light_energy = 0.3
    add_child(environment)
    var light := DirectionalLight3D.new()
    light.rotation_degrees = Vector3(-40,-25,0)
    light.light_energy = 0.65
    light.shadow_enabled = true
    add_child(light)
    var ground := MeshInstance3D.new()
    var plane := PlaneMesh.new()
    plane.size = Vector2(8,8)
    ground.mesh = plane
    var mat := StandardMaterial3D.new()
    mat.albedo_color = Color("#68727b")
    ground.material_override = mat
    add_child(ground)
    for id: String in IDS:
        var actor := (load("res://candidates/"+id+".glb") as PackedScene).instantiate() as Node3D
        add_child(actor)
        var skeleton := actor.find_children("*","Skeleton3D",true,false)[0] as Skeleton3D
        var player := AnimationPlayer.new()
        actor.add_child(player)
        player.root_node = player.get_path_to(skeleton.get_parent())
        player.add_animation_library(&"Public",LIBRARY)
        actors.append(actor)
        players.append(player)
    camera = Camera3D.new()
    camera.projection = Camera3D.PROJECTION_ORTHOGONAL
    add_child(camera)
    camera.make_current()
    var canvas := CanvasLayer.new()
    add_child(canvas)
    label = Label.new()
    label.position = Vector2(16,16)
    canvas.add_child(label)
    update_selection()

func _unhandled_key_input(event: InputEvent) -> void:
    if not event.is_pressed() or event.is_echo():
        return
    if event is InputEventKey:
        match (event as InputEventKey).physical_keycode:
            KEY_TAB: actor_index = (actor_index+1)%IDS.size()
            KEY_SPACE: clip_index = (clip_index+1)%CLIPS.size()
            KEY_V: view_index = (view_index+1)%4
            KEY_ESCAPE: get_tree().quit()
            _: return
        update_selection()

func update_selection() -> void:
    for i: int in actors.size():
        actors[i].visible = i==actor_index
        players[i].play(&"Public/"+CLIPS[clip_index])
    var at := Vector3(0,.8,0)
    camera.size = 1.95
    match view_index:
        0: camera.position = Vector3(0,.86,4)
        1: camera.position = Vector3(4,.86,0)
        2: camera.position = Vector3(2.8,1.12,3.6)
        3:
            camera.position = Vector3(2.2,.45,3)
            camera.size = .95
            at = Vector3(0,.18,0)
    camera.look_at(at)
    label.text = IDS[actor_index]+"  /  "+str(CLIPS[clip_index])+"\nTab: Character   Space: Motion   V: View   Esc: Exit"
