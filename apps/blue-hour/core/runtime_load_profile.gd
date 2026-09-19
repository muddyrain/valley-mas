extends RefCounted
## Monotonic wall-clock evidence; rendering waits are included in total, not hidden.

var started_usec: int = Time.get_ticks_usec()
var events: Dictionary = {}
var event_order: Array[String] = []
var stages: Dictionary = {}
var gates: Dictionary = {}
var seed: int = 0

func mark(label: String) -> void:
	event_order.append(label)
	events[label] = (Time.get_ticks_usec() - started_usec) / 1000.0

func measure(label: String, began_usec: int) -> void:
	stages[label] = (Time.get_ticks_usec() - began_usec) / 1000.0

func report() -> Dictionary:
	return {"seed": seed, "events_ms": events.duplicate(), "event_order": event_order.duplicate(), "stages_ms": stages.duplicate(), "gates": gates.duplicate()}

func print_report() -> void:
	print("[EXP_LOAD] " + JSON.stringify(report()))
