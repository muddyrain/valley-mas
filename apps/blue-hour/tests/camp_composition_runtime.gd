extends "res://tests/camp_ambient_runtime.gd"
## Reuse the real interaction and collision checks without continuous image encoding.

func _process(_delta: float) -> bool:
	return false
