# Weapon RarityProfile Resource Phase W2-2 Delivery Report

Moved weapon rarity metadata into five `WeaponRarityProfileData` Resources with a validating registry. Equipment reads rarity weights and legacy modifier capacity from profiles, while the Weapon Browser reads profile labels and colors. Existing rarity ordinals, SPECIAL-to-EPIC mapping, save data, weapon values, modifier counts, and combat/VFX behavior remain compatible.

Godot 4.7.2 import passed. Rarity Profile passed 32 checks, Weapon System passed 474 checks, and Expedition Combat Capture passed with 375 frames, four screenshots, and no failures. Capture evidence is in `test-output/expedition_combat_capture_w2_2/`.

The full implementation record is [Weapon RarityProfile W2-2](../audit/weapon/weapon_rarityprofile_resource_phase_w2_2_report.md).
