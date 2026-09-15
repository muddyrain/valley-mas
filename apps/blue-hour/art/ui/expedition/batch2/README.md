# Blue Hour Homeward - Expedition HUD UI Batch 2

This package contains the second UI asset batch after clean slicing and alpha cleanup.

## QA / clean-slicing rules
- Every main asset is exported as an independent transparent PNG.
- Neighboring sprite pixels are not retained.
- Tiny detached alpha noise is removed.
- A small transparent safety padding is preserved around every cut asset.
- Low-priority separators / sparkle / corner accents are intentionally grouped into:
  `04_world_and_misc/misc_decorations.png`

## Folder structure
- 01_resources: food / scrap / intel / menu
- 02_survivor: weapon / status / HP / party badge / portrait frame
- 03_action: stop / focus fire / locate / frenzy / hotkey badges / cooldown wedge
- 04_world_and_misc: house / vehicle / minimap / interaction icons + combined decoration sheet
- 05_return_bus: return-bus button states and bus icons

## Important
Text, numeric values, key labels, and runtime values should remain dynamic in Godot.
Do not bake labels such as X / F / L / 1 / E into these PNGs.
