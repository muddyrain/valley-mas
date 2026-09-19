# Survivor upper sleeve weight polish

`reproduce.ps1` reads the frozen T-bind `.blend` files in `test-output/survivor-t-pose-bind` and writes isolated candidates to `test-output/survivor-upper-skin`. Keep the T-bind authoring files, vertex correspondence and native QA evidence: this stage intentionally does not recreate the rig, bind geometry or animations.

`polish_survivor_skin.py` only redistributes existing UpperArm / LowerArm / UpperChest weights on the arm surface. The elbow transition is narrower and slightly asymmetric across its inside/outside. Su uses stronger adjustment than Xia. Shoulder smoothing uses a seam-welded graph, freezes semantic boundaries and caps the local transfer. No new influence families, geometry, modifiers or deformation bones are introduced. Head, Chest, Hand and every vertex outside the permitted sleeve mask remain exact.

`validate.py` reopens Blender outputs to check mesh positions, topology, UV, textures, material names, full bone rest/length/axis, transforms, socket and lower/non-sleeve weights. `analyze.py` compares the same native poses and meshes against the prior T-bind run. Imported mesh cache reordering is handled with exact coordinate and triangle multisets. The elbow cross-section hull is a silhouette/area proxy, not true closed volume. Edge statistics are not collision tests.

`capture_upper.gd` renders the same public animation instance at the same 60 FPS times, camera and lighting on reference and polished meshes. `package.py` outputs four final Run videos, four reference videos, four side-by-side comparisons and Idle front images. Videos repeat twelve complete source cycles; there is no crossfade or retiming. All three clips are numerically regressed even though only Run videos are requested.

The Windows review is isolated and does not access gameplay or player saves. Visual acceptance remains separate from structural checks, especially the unresolved worst shoulder/hair seam.
