# Expedition HUD + Scavenge Interaction UI Minimal Fix Report

## 1. Modified Files
`ui/expedition/action_icon.gd`, `ui/expedition/hud_skin.gd`, `ui/expedition/poi_context.gd`, `ui/expedition/search_card.gd`, `ui/expedition/squad_card.gd`, and `ui/mission_hud.gd`.

## 2. Hover Root Cause
Action hover and pressed PNGs use different dimensions and transparent padding (normal 156×87, hover 156×83); native state switching changed the visual bounds. All states now share the normal geometry.

## 3. HUD Fixes
Party indices remain runtime generated and are positioned inside the card's baked corner circle. Action, Return Bus, and Rally retain fixed layout bounds and use non-geometry-changing hover feedback. The existing phase strip remains runtime-driven.

## 4. World UI Cleanup
World hover no longer opens large building or vehicle information cards. Legacy focus text and loot toast are hidden. Only an active search may retain a compact world progress surface.

## 5. Search Feedback
Active search shows a small percentage/progress line and compact cancel affordance; completion remains represented by the Discovery list and resource ledger.

## 6. Camera Assessment
No camera change was necessary after removing world overlays; the remaining framing is readable without changing zoom.

## 7. Runtime Verification
Native Expedition HUD regression: 257 checks, 0 failures at 1920×1080. Godot editor import and Windows export were also run.

## 8. Final Expedition Screenshots
See `test-output/expedition_hud_clarity/`.

## 9. Freeze Recommendation
NOT READY FOR FREEZE until manual visual acceptance confirms the reference-image alignment and the compact search card placement.
