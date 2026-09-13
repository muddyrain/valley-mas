# CAMP Survivor Ambient Behavior V1.1 Report

## 1. V1 root causes
V1 selected coarse scene origins with offsets, entered MOVE without projecting or path validation, had no reservation/cooldown, and had no bounded stuck recovery. CampActor also kept a movement intent after an unavailable NavigationAgent path.

## 2. Changed files
- `camp/camp_ambient_behavior.gd`: Ambient-only navigation ownership, safe anchors, projection/path validation, timing, reservation, cooldown, stuck recovery, smooth facing, departure handoff and optional debug view.
- `camp/camp_ambient_navigation.gd`: ground-only baked map with explicit exclusion volumes for buildings, steps, props, greenhouse and vehicle corridor.
- `camp/camp_ambient_debug.gd`: opt-in anchor/path/state/reservation/stuck visualization (`--camp-ambient-debug`).
- `camp/camp_actor.gd`: cancel navigation, stop on finished/invalid path, smooth facing.
- `camp/camp_main.gd`: departure calls `departure_override()`.

## 3–6. Safe POI and navigation
Seven independent anchors are defined: workbench front, notice board front, main station forecourt, storage front, rest table, rest fire and rest bench. Each has a 0.35m safe radius, capacity 1, projected target and facing vector. The Ambient map excludes large static collision footprints, greenhouse, main station/steps, and vehicle path. Unsafe projections are disabled with one warning.

## 7–8. Stuck / Repath
Stuck means <0.12m movement for 2.0s. The first event requests one path again; a second event after 1.75s cancels navigation, releases the reservation, returns to IDLE and applies 3–6s cooldown. Travel is capped at 38s. CampActor follows `get_next_path_position()` only.

## 9–11. Rhythm and cooldown
Initial Idle is staggered at 6–9.5s / 10.5–14s. Normal Idle is 8–18s. Work/notice/main/storage stays are 12–24s; rest stays are 18–30s. Leaving a POI applies a random 20–40s per-character cooldown.

## 12. Reservation
Every POI has capacity 1. Reservation occurs only after projection and path validation; it remains held during POI stay and the following stationary Idle, and is released when another destination is accepted, on recovery or on departure.

## 13. Runtime evidence
- `tests/camp_ambient_navigation.gd`: PASS, 7 anchors connected, forbidden geometry excluded, capacity-one reservation, departure ownership.
- `tests/camp_ambient_runtime.gd --ambient-mode=stuck`: PASS, 7 checks, exactly one repath, no failures.
- `tests/camp_ambient_runtime.gd --ambient-mode=departure`: PASS, 12 checks, Ambient released before assembly and Mission handoff completed.
- Native rendered 35s probe: PASS, 5 checks, 349 frames, no unsafe overlap; [camp_ambient_v11_probe.mp4](../test-output/camp_ambient_v11_probe.mp4).
- Headless 40s stability sample: PASS, moving time 7.73s / 3.63s per actor, minimum separation 0.642m, max stuck timer 0.10s, zero recoveries, zero unsafe entries.
- The 300s native and Headless attempts were stopped before a complete fresh report was obtained. Their incomplete captures do not establish five-minute acceptance; runtime availability itself was demonstrated by the shorter successful runs.

## 14. Requested videos
- `camp_ambient_v11_5min.mp4`: not produced; only 35s native probe is available.
- `camp_ambient_v11_stuck_test.mp4`: not produced; deterministic headless stuck test PASS.
- `camp_ambient_v11_departure_override.mp4`: not produced; deterministic headless departure test PASS.

## 15. New navigation issues
The authored scene has no independent Notice Board / Storage / Rest marker nodes; this implementation supplies runtime Safe Ambient Anchors and disables any anchor that fails projection. The original authored NavigationMesh contains elevated/indoor polygons, so Ambient uses a separate ground-only map while Departure retains the original map.

## Status
Implementation and targeted runtime checks are complete. Full five-minute acceptance, three requested MP4s and Windows build/standalone verification remain incomplete; therefore this is not a claim of complete V1.1 acceptance.
