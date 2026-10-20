# Expedition HUD Final Interaction Fix v2 Report

## 1. Summary
Fixed the four latest Expedition HUD interaction issues.

## 2. Click Marker Cleanup
The persistent group target is hidden; movement feedback is the approved procedural ground ring in `WorldInteractionVfx`, eliminating black or fallback marker blocks and Home/House icons.

## 3. Action Hover Stability
Hover scale is removed. Button bounds, HBox layout, and hotkey badge position remain fixed.

## 4. Discovery Scroll vs World Zoom
Scroll containers remain interactive and pass wheel events. World zoom now exits early while the pointer is over HUD controls, so Discovery scrolling does not zoom the camera.

## 5. Survivor Badge Alignment
The party badge is positioned as a top-level overlay over the baked card circle for consistent alignment across cards.

## 6. Regression Tests
Native Expedition HUD test: 257 checks, 0 failures. Godot export completed successfully. Existing resource-loader warnings reference unrelated missing building assets.

## 7. Screenshots / Videos
Screenshots are in `test-output/expedition_hud_final_interaction_fix_v2/`. No video capture was required.

## 8. Remaining Issues
The card circle remains baked into the survivor background PNG and was not edited per scope.

## 9. Freeze Recommendation
ready for freeze approval
