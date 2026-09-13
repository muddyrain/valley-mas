extends Node
var voices: Array[AudioStreamPlayer] = []
var samples: Dictionary = {}
var ambient_player: AudioStreamPlayer
var voice_index: int = 0

func _ready() -> void:
	_ensure_audio_bus("Music")
	_ensure_audio_bus("SFX")
	for i in range(8):
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		player.volume_db = -22.0
		add_child(player)
		voices.append(player)
	samples["shot"] = _tone(130, 0.09, true)
	samples["melee"] = _tone(75, 0.13, true)
	samples["loot"] = _tone(780, 0.15, false)
	samples["blue"] = _tone(220, 1.2, false)
	samples["night"] = _tone(90, 1.5, false)
	samples["alarm"] = _tone(560, 0.65, false)
	samples["home"] = _tone(440, 0.6, false)
	ambient_player = AudioStreamPlayer.new()
	ambient_player.bus = "Music"
	add_child(ambient_player)
	var drone := _tone(55, 2.0, false, true)
	ambient_player.stream = drone
	ambient_player.volume_db = -42
	ambient_player.play()

func _tone(frequency: float, seconds: float, noisy: bool, loop: bool = false) -> AudioStreamWAV:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = 22050
	var count := int(seconds * stream.mix_rate)
	var bytes := PackedByteArray()
	bytes.resize(count * 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1029
	for i in range(count):
		var t := float(i) / stream.mix_rate
		var envelope := 0.45 if loop else pow(1.0 - float(i) / count, 2.0)
		var sample := sin(TAU * frequency * t) * 0.65 + sin(TAU * frequency * 1.5 * t) * 0.2
		if loop:
			sample = sin(TAU * frequency * t) * (0.4 + 0.2 * cos(TAU * t))
		if noisy:
			sample = sample * 0.3 + rng.randf_range(-0.7, 0.7)
		bytes.encode_s16(i * 2, int(clampf(sample * envelope, -1, 1) * 28000))
	stream.data = bytes
	if loop:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_end = count
	return stream

func play_cue(id: String, pitch: float = 1.0) -> void:
	if voices.is_empty() or not samples.has(id):
		return
	var player := voices[voice_index % voices.size()]
	voice_index += 1
	player.stream = samples[id]
	player.pitch_scale = pitch
	player.play()

func set_phase(phase: int) -> void:
	ambient_player.volume_db = [-42, -31, -26][phase]
	ambient_player.pitch_scale = [1.0, 1.2, 0.8][phase]
	if phase > 0:
		play_cue("blue" if phase == 1 else "night")

func _ensure_audio_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) >= 0:
		return
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)

func _exit_tree() -> void:
	# Release looping playback before tearing down a sortie or quitting tests.
	if ambient_player:
		ambient_player.stop()
		ambient_player.stream = null
	for player in voices:
		player.stop()
		player.stream = null
