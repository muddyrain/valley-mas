# Expedition HUD / Scavenge Interaction Second Fix

## 1. Root Cause
Manual movement did not release active SearchTask assignments, so stale task state continued after a survivor left. The old City marker also remained alongside the procedural ring.

## 2. Modified Files
`missions/mission.gd`, `maps/city.gd`, `ui/expedition/action_icon.gd`, `ui/expedition/hud_skin.gd`, `ui/expedition/poi_context.gd`, `ui/expedition/search_card.gd`, `ui/expedition/squad_card.gd`, `ui/mission_hud.gd`.

## 3. Scavenge State Fix
Movement now releases active tasks before issuing paths. World UI is shown only for an active task and cancellation calls the real mission recall path.

## 4. Black Shadow Source
The legacy textured City movement marker was still being flashed. It is now permanently hidden; the procedural WorldInteractionVfx ground ring remains.

## 5. Hover Shader / Tween
Action buttons keep fixed native geometry and use a CanvasItem shader material for a restrained brightness/cool-edge highlight, with 1.025 hover lift, 2px upward motion, 0.99 pressed compression, and synchronized badge movement. Return Bus uses the same component.

## 6. Day / Time
Day typography was reduced, Time remains the primary value, and the shared top-row spacing was tightened while retaining runtime clock data.

## 7. Runtime Tests
Native Expedition HUD regression: 257 checks, 0 failures. Godot import and Windows export succeeded.

## 8. Screenshots
Evidence: `test-output/expedition_hud_clarity/`.

## 9. Freeze
NOT READY FOR FREEZE pending manual screenshot acceptance of the compact search card and final reference alignment.
