# Expedition HUD Interaction Fix / Survivor Alignment

## 1 Summary
Implemented the requested interaction and survivor-card fixes in the expedition HUD.

## 2 Click Marker Fix
Movement group target now uses the location-pin marker. Home/house semantics remain reserved for rally and world POI markers.

## 3 Action Hover Stability
Removed hover scale animation from action buttons so their bounds and hit areas remain fixed.

## 4 Discovery Mouse Wheel
ScrollContainer nodes are preserved by decoration filtering, and HUD squad/discovery scrollers pass wheel events.

## 5 Return Bus Hover
Return uses the same fixed-bound action button behavior; hover no longer changes its geometry.

## 6 Survivor Card Audit
The large empty circle is baked into `hud_survivor_card_bg_normal.png`: `Large empty circle is baked into survivor card PNG.`

## 7 Survivor Card Final Alignment
Portraits are near-square and the card remains a wide, flat panel. The embedded party index badge is attached to the portrait corner.

## 8 Survivor HP
Replaced the distorted scaled texture presentation with a clear 5px proportional HP line while retaining ProgressBar value/range behavior.

## 9 Survivor Selected State
Selection keeps the paper card background and applies a restrained portrait tint instead of a full-card blue wash.

## 10 Regression Tests
Godot editor import passed. Native expedition HUD phase2 test: 257 checks, 0 failures at 1920x1080.

## 11 Screenshots / Videos
Native captures are in `test-output/expedition_hud_interaction_fix/` with the ten requested filenames. No video was required.

## 12 Remaining Issues
The baked empty circle remains because removing it requires a separately authorized replacement background asset.

## 13 Out-of-Scope Issues
Camp UI pre-existing failures and unrelated world/gameplay systems were not changed.

## 14 Freeze Recommendation
NOT READY FOR FREEZE until the baked survivor-card circle is either accepted or replaced under a separate asset authorization.
