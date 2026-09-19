# Unified Survivor T bind review

Run `reproduce.ps1` to rebuild the two isolated candidates, static poses, native public locomotion samples, videos and Windows review executable. Requires Blender, Godot export templates, NumPy, Pillow and ffmpeg already installed locally.

Inputs are the existing `test-output/survivor-unified-rig/{character}/{character}_unified_rig_candidate.blend`, canonical QA evidence in `test-output/canonical-public-locomotion`, the checked-in fit landmarks, and the approved three clips in `assets/animations/public_locomotion`. This is not a clean-checkout bootstrap: retain those input authoring artifacts. No rig definition or animation bake is run by this workflow.

`align_survivor_bind.py` aligns the mesh surface and skin with the frozen T rest. The upper arm envelope is fitted to the canonical joint positions; hand size is preserved. Topology, UV, image pixels, materials and the lower body below 0.70 m remain unchanged. These are mesh authoring changes, not object transforms or hidden armature poses.

Static `arm_45` means 45-degree lateral elevation from arms down; `arm_90` means 90-degree forward shoulder flexion; T rest itself is 90-degree lateral elevation. `elbow_90` is forward flexion from T, and `knee_90` uses 30-degree thigh lift plus 90-degree knee flexion. Probe poses are transient and never saved as animation resources.

The public clip bytes are copied unchanged into the isolated project, with only the AnimationLibrary resource paths relocated. Both actors receive the same library and Animation instances. `static_analysis.py` also compares native skeleton/rest and every sampled animation matrix against the prior public-library run.

Contact is evaluated with fixed sole vertex patches and phase windows from the approved source. The 3 mm all-sole clearance statistic is not a physiological flight measurement. Edge stretch on a T-space mask is a defect locator, not a proof of collision-free skin. Final visual release must inspect the gallery, including rear and side details.
