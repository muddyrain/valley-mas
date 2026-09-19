# Canonical locomotion offline conversion

Run `reproduce.ps1` from any working directory. It stages these authoring tools in `test-output/canonical-public-locomotion`, samples only the three approved Standard `.tres` files, converts and bakes one common library, verifies the canonical rig, then captures both frozen candidates using the same library. Blender supplies NumPy/mathutils; the configured Python supplies NumPy/Pillow. No new dependencies are installed.

The `.gdignore` here keeps isolated-project script templates out of the main Godot importer. Public assets are written only to `assets/animations/public_locomotion`; nothing connects them to a character controller or gameplay. The old public library and character-specific assets are not inputs.

`convert.py` creates a common anatomical authoring reference from Source Rest and the frozen canonical Rest. It preserves the source upper-body motion directions and adapts the lower chain against a diagnostic sole envelope. Neither candidate mesh supplies conversion targets. `bake.gd` writes only 23 rotation tracks and one Hips position track per animation.

Numerical and resource checks are reproducible. The visual observations in `finalize.py` describe the currently reviewed frozen candidates: **canonical checks pass, candidate skin compatibility fails**. A later binding change needs fresh visual review and report observations; running the numerical scripts alone is not production approval.

See `docs/CANONICAL_PUBLIC_LOCOMOTION_REPORT.md` and the linked evidence for limitations, measurements, and the required next binding audit. This task does not change any Mesh, Skin, Skeleton Rest, gameplay state, or movement speed.
