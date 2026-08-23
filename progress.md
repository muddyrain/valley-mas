Original prompt: Rebuild Eon Vale into an original, desktop-browser, WorldBox-like map-first sandbox. The first slice is a read-only deterministic 1024×1024 world with continent, archipelago, and enclosed-lake prototypes; no residents, houses, editor, saves, or old toolbar.

## Current work

- Legacy Eon Vale source, e2e, and scripts were removed with explicit user approval.
- Correction pass resumed after workspace access was restored.
- Completed: actual staged Worker progress/cancellation, deterministic staged generator tests,
  semantic world/region/near rendering, near-object selection, and browser visual checks.
- Browser proof is stored under `output/web-game/`; the app exposes `render_game_to_text`
  and `advanceTime` for repeatable checks.
- Completed original pixel atlas: seven map-object classes, three palette variants each,
  one shared 16x24 frame specification, and near-detail rendering through atlas frames.
- Fixed the development-mode Pixi lifecycle race: React StrictMode now cancels the first
  deferred setup before Pixi starts, and MapRenderer only disposes after initialization.
- Replaced the in-memory generated atlas with the editable static source file
  `apps/eon-vale/src/assets/pixel-atlas.svg`; runtime code now loads it as an asset.
- Replaced terrain color fills with the editable static source file
  `apps/eon-vale/src/assets/terrain-atlas.svg`; every terrain cell now resolves to a
  deterministic original 4x4 tile variant from that atlas.

## Validation history

- `pnpm --filter @valley/eon-vale typecheck`, `test`, and `build` passed during the
  correction pass, including the terrain-atlas addition.
- Browser visual check completed with the real atlas at both world and near LOD. The
  resulting `terrain-atlas-near-state.json` reported near LOD at zoom 1.96, loading
  complete, and no browser errors; its screenshot is in `output/web-game/`.
- Loading now reports real renderer stages after Worker completion. A single synchronous
  whole-world build was replaced with time-budgeted chunk construction, an immediate
  biome overview, and background near-detail construction. The world outline is visible
  during `render-terrain`; near details no longer block the first usable map.
- Browser replay verified `render-terrain` progress while the complete overview was already
  visible, followed by `loading: false` after region construction, with no browser errors.
  Unbuilt near-detail chunks cannot be selected before their sprites exist.
- Added the Surface Cover world fact and its real Worker stage. The first polished composition
  has grass tufts, wildflowers, ferns, leaf litter, dune grass, and beach pebbles beneath
  selectable map features. Broadleaf trees now use three distinct original silhouettes.
- Reworked the visual foundation after screenshot review: climate bands and rare continuous
  ridges now prevent single-grass-sheet worlds, and the world/region/near LODs all retain the
  same generated object facts. At distance, forests and resource fields remain as readable
  thumbnails instead of disappearing into a flat biome map.
- Began the atlas redraw: the editable `pixel-atlas.svg` now uses 24x32 frames for conifers,
  palms, dead trees, shrubs, single rocks, and rock clusters, matching the detail scale of the
  broadleaf forest atlas. Browser capture confirmed near LOD rendering without errors.
- Expanded `forest-atlas.svg` from three to six genuinely different broadleaf silhouettes
  (oak forms, maple, birch, and willow) and changed generation so that all six are placed as
  deterministic world facts rather than unused art.
- Expanded the surface-cover world fact and editable atlas with moss patches, mushroom clusters,
  reeds, and driftwood. Each has a biome rule and the generator test now verifies that no new
  ground cover appears on an invalid biome.
- Completed the climate-cover pass with frost shrubs, ice crystals, dry brush, cactus, highland
  lichen, and scree. The same test now proves all sixteen cover kinds appear on valid terrain;
  browser capture confirmed the new shoreline and climate details render at near LOD.
- Rebuilt `terrain-atlas.svg` as a four-tone low-contrast material palette and replaced visible
  macro color bands with deterministic per-pixel terrain grain in `MapRenderer`. The near-LOD
  capture confirms the old 4x4 repeated wallpaper pattern is gone.
- Reworked the near-detail composition after the latest visual review: detail chunk textures now
  carry a transparent sprite gutter, so tree and rock frames survive chunk boundaries intact.
  Reeds are generated only on wet beach cells, never in open shallow water.
- Rebuilt the authored terrain atlas into four original material variants per biome and resolved
  those variants per cell at render time. Tree placement now uses deterministic spaced anchors
  plus biome clusters; highland rocks use a much sparser anchor, avoiding overlapping crowns and
  rock fields that read as visual noise.

## TODO

- Follow-up: expand non-temperate object silhouettes (conifers, dead trees, coastal plants, and
  rocks) and add dedicated highland, shoreline, and beach-transition rules. Do not add residents,
  houses, editing, or persistence yet.

## P2-4 world LOD pass — opened (2026-08-23)

- User accepted the visible cold-biome slice and authorized P2-4. PLAN now closes P2-3, records that
  the default player UI hides seed while retaining deterministic snapshot/debug use, and adds P3-1
  world-entry/loading plus P3-2 interaction-menu/runtime-mutation follow-up stages.
- P2-4 is limited to dedicated world-LOD art/composition and the eight-template world/region/close,
  determinism, resource, and performance gate. It must stop for user visual acceptance before P3-1.
- The supplied WorldBox screenshots are reference grammar only: distant maps retain coast layers,
  biome masses, vegetation density, clearings, elevation and a few landmarks without shrinking every
  region sprite into noise. Palette, exact silhouettes and assets remain original.

## P2-4 world LOD pass — implemented, awaiting visual acceptance (2026-08-23)

- Added the semantic built-in `builtin-world-lod-1` catalog and dedicated
  `/map/builtin/lod-world-detailed-01.png` atlas. Eight biomes each expose three independent `4x4`
  vegetation-cluster silhouettes; detailed tree assets point to these world-LOD replacements without
  changing snapshot objects or region/close sprites.
- World projection now combines layered ocean/coast/biome/elevation colors, low-frequency coherent
  material variation, and real tree-object aggregation in `12x12` cell buckets. The renderer composites
  those markers into one overview texture before Pixi upload, avoiding thousands of world-view sprites.
- The first eight-template matrix exposed a generation fact bug rather than an art bug: seven prototype
  templates undershot their declared land shares, and two fixed seeds initially produced no plantable
  lowland. Generator version 6 calibrates the template elevation biases; all eight fixed seeds now stay
  inside their `WorldRulesCatalog.landShare` contracts and contain lowland.
- Added deterministic eight-template world-LOD tests, the land-share contract gate, catalog/asset tests,
  a `350ms` complete-world projection budget, and a browser smoke covering loading -> world -> region ->
  world, atlas responses, WebGL2, DPR, console errors, and failed requests.
- Verification: 45 unit tests pass; typecheck, Biome check, and production build pass; the world overview
  compiles in 210ms (350ms budget), nine cold detail chunks in 107ms (150ms budget), and all four browser
  smoke paths pass. Playwright and fixed web-game client screenshots are under
  `apps/eon-vale/output/p2-4-acceptance/`.
- P2-4 is deliberately not closed yet. P3-1 and P3-2 remain plan-only until the user accepts the actual
  world-view visual result.

## Map-first replacement — P0 stages 1–2 (2026-08-23)

- Completed the new authoritative `WorldSnapshot`, `WorldRulesCatalog`, strict visual manifest,
  built-in P0 `VisualCatalog`, and eight generated PNG contract atlases under `src/map`.
- Completed a new deterministic 1024×1024 `WorldGenerator` and Worker protocol. The Worker reports
  seven real fact-generation stages and transfers all twelve snapshot buffers exactly once.
- Completed the internal `MapSession` state machine with cancellation, stale-job protection,
  stable errors, terminal destruction, parallel visual/snapshot/world readiness, and atomic visual
  swap preparation.
- Added the eight-template seed entry and a separate real-progress loading shell. It is intentionally
  not connected to the legacy App yet; entry replacement remains gated on the stage 3 world-view
  plus one-region-chunk vertical slice.
- New-map gate: 8 test files / 23 tests passed; the full package has 9 files / 29 tests passing,
  along with package typecheck and production build.
- Next: P0 stage 3 — minimal projection, world-view texture, one detailed region chunk, Pixi/cache
  execution, browser visual proof, then the one-time removal of the old SVG/rendering path.

## P0 stage 3 — complete, awaiting visual acceptance (2026-08-23)

- Locked the tracer world to `continent` with seed `0x1a2b3c4d`; all other templates remain outside
  this stage's visual acceptance scope.
- Added the first pure `MapProjection` seam: a 1024×1024 world-view RGBA plan plus one deterministic
  64×64 representative coast/biome `RenderChunkPlan` with base visual handles, constrained 47-mask
  autotile topology, transition handles, debug facts, and a plan checksum.
- Extended `VisualCatalog` with validated renderer metadata and named palette access; atlas positions
  remain behind visual handles and never enter `WorldSnapshot`.
- Projection tracer test passes through the real fixed WorldGenerator, WorldSnapshot, P0 manifest,
  VisualCatalog, world plan, and region chunk plan.
- Replaced the application entry with the new `MapSession` chain and a Pixi WebGL2 renderer using
  nearest-neighbor sampling, pixel-aligned camera placement, and DPR capped at 2.
- Added browser-visible biome, terrain, chunk-boundary, and autotile-mask diagnostics plus world and
  representative-region focus controls.
- Browser smoke proof covers template selection, visible loading, world view, region chunk, all four
  debug layers, asset/console failure capture, non-black output, and same-seed checksum replay.
- After the smoke test passed, removed the old four SVG atlases, legacy atlas loaders, legacy
  `MapRenderer`, Worker client/protocol, and old generator. No compatibility runtime remains.
- Stage 3 is intentionally stopped here. Do not begin the next stage before user visual acceptance.

## P0 stage 3 visual rejection — correction in progress (2026-08-23)

- User rejected the first visible map because world and region views read as rectangular mosaic
  noise rather than coherent geography.
- A fixed-seed generator regression now measures connected land, tiny-region share, grid-boundary
  enrichment, and biome boundary density through the public `generateWorldSnapshot` seam.
- Original evidence: largest land share `81.65%`, tiny-region share `3.08%`, 16-cell landform grid
  enrichment `88.3×`, and 8-cell biome grid enrichment `3305.5×`.
- Root cause confirmed: direct bit-shifted hash sampling made terrain constant in 16×16/64×64
  rectangles and moisture constant in 8×8 rectangles. Continuous interpolation removes the grid
  bias, but macro scale and residual tiny regions still require correction and browser review.
- Correction completed: terrain now uses continuous 96/320-cell fields, moisture uses continuous
  64/192-cell fields, and the continent tracer is constrained to 30%–55% land coverage.
- The corrected browser captures show one coherent large landmass, continuous deep/open/shallow/coast
  bands, and broad biome regions. Same-seed replay now yields world checksum `708f7a66` and region
  plan checksum `ffef2bd3`; console and asset failures remain empty.
- Stage 3 remains blocked on user visual re-acceptance; do not advance to the next stage yet.

## P0 stage 4 — map-layer completion baseline (2026-08-23)

- User accepted advancement beyond the corrected stage 3 macro map and authorized the next phase.
- Replaced the one-representative-chunk region layer with deterministic viewport chunk planning,
  center-first visible work, one-ring prefetch, protected LRU caching, and GPU resource disposal.
- RenderChunkPlan now carries material groups, biome/material/landform autotile transitions, low cover,
  shadows, upright objects, foreground batches, sort keys, and variant seeds.
- Region and close LOD now render every visible chunk over the always-available world overview; zooming
  or dragging no longer switches to an empty layer. World LOD also retains tree facts as pixel marks.
- Renderer-owned camera gestures now report low-frequency LOD changes back to MapSession, so browser
  state and the actual Pixi layer agree at region and close zoom levels.
- Added visible water effect overlays driven by the visual clock while keeping the world overview static.
- Full-view object projection exposed and fixed invalid sapling/tall combinations, terrain-restricted
  decorations placed on invalid landforms, and uniform rare-landmark selection. Rare landmarks now use
  weighted frequency and 32–64-cell spacing.
- Browser proof is stored under `apps/eon-vale/output/phase4-smoke/`. Region LOD completed with 9 visible
  chunks / 20 cached / 90 visible objects; close LOD drag completed with 25 cached / 203 visible objects,
  zero pending work, zero console errors, and zero failed asset requests.
- Fixed acceptance input now yields snapshot checksum `61783266` and representative chunk checksum
  `fea9dfd3`. P0 contract atlases remain intentionally crude and are not formal art acceptance.
- Stop here for the user's map-layer visual acceptance before starting the P1 authored visual slice.

## P0 stage 4 visual correction — awaiting re-acceptance (2026-08-23)

- Reproduced the user's rectangular slice artifact as partial detailed-chunk exposure over the world
  overview while the visible build queue was still running.
- Detailed LOD now stays on the complete world overview until every currently visible chunk is cached,
  then reveals all detailed ground, objects, effects, and debug content atomically.
- The browser smoke test samples every animation frame during region focus and rejects any state where
  only a strict subset of visible detailed chunks reaches the screen.
- World-view trees are no longer rendered one object to one dark pixel. A deterministic `16×16`-cell
  bucket emits at most one lower-contrast marker, while region and close LOD retain the same tree facts.
- P0 tree, landmark, terrain, and decoration silhouettes remain contract placeholders. Their visual
  redesign belongs to the P1 authored slice and does not require generation or projection rewrites.

## P1-1 temperate coast authored slice — awaiting visual acceptance (2026-08-23)

- Locked `continent + 0x1a2b3c4d + chunk 162 (128,640)` as a reproducible grassland/woodland coast
  fixture with shallow water, coast, both temperate biomes, and more than 30 visible objects.
- Added the complete `p1-temperate-coast-1` visual bundle and switched the built-in runtime catalog to
  its independent PNG atlas pages without changing snapshot facts or semantic asset IDs.
- Authored the first P1 batch: 40 vegetated-soil slots, four water/coast classes with 11 frames,
  48 grassland/woodland tree age-height sprites, and readable common cover, rock, and deadwood shapes.
- Replaced per-cell full-width water highlights with deterministic sparse short ripples and reduced
  base-tile grain after browser captures exposed horizontal striping and excessive texture noise.
- Saved the built-in image-generation direction board at
  `apps/eon-vale/docs/visual/p1/temperate-coast-direction-v1.png`; it is reference-only and not loaded
  by the game. Runtime assets are generated deterministically by `scripts/build-p1-atlases.mjs`.
- P1 contact sheets and browser captures live under `apps/eon-vale/output/p1-acceptance/`. Remaining
  P0 categories include non-temperate biomes, large landmarks, corruption, and dedicated elevation art.

## P1-1 correction pass — in progress (2026-08-23)

- User accepted the temperate tree silhouettes and spacing, but rejected the cold world-to-region LOD
  transition performance and the current grassland/woodland ground finish.
- Browser reproduction measured cold visible detail at about 399 ms against the 150 ms gate, P95 frame
  time at 67–91 ms against the 25 ms gate, and 23 over-budget frames. The same transition after cache
  warm-up measured about 6.2 ms P95.
- CPU sampling identified repeated full-catalog matching as the dominant cold path, followed by
  synchronous Canvas raster work. The correction must index visual queries, prioritize visible work,
  and keep prefetch outside the visible-detail gate before reconsidering a Worker adapter.
- Current temperate ground uses one shared sparse texture over flat biome fills, while the generic
  inland transition mask is sand-colored. The correction must separate grassland/woodland material
  rhythm and remove the bright inland outline without expanding into the full P1-2 transition slice.

## P1-1 correction pass — implemented, awaiting visual re-acceptance (2026-08-23)

- Indexed and cached normalized `VisualCatalog` candidate queries instead of scanning all 551 assets
  for every projected cell. The fixed nine-chunk projection benchmark now passes the 150 ms gate.
- Replaced thousands of per-chunk Canvas draw calls with decoded atlas pixel compositing into one
  `ImageData` upload. Visible chunks build before prefetch in an 8 ms time slice and remain atomic.
- Added browser gates for cold detail readiness and frame-time P95. The final fixed-scene record is
  `70.6 ms` to all 9 visible detailed chunks and `18.1 ms` P95, against `150 ms` / `25 ms` limits.
- Bumped the bundle to `p1-temperate-coast-2`. Grassland and woodland now resolve distinct ground
  bases, groups, and overlays; base grain is sparse, clustered material groups carry broad rhythm,
  and inland transitions no longer reuse the bright coast/sand color.
- Rebuilt P1 atlases and regenerated world, region, close, drag, and debug browser captures. The
  exact web-game client confirms WebGL2, DPR 1, deterministic seed `439041101`, catalog v2, and no
  browser-reported errors.
- Validation: 31 unit tests, the 53 ms standalone performance benchmark, typecheck, production build,
  Playwright smoke, Biome check, and mojibake/text-loss guard all pass.
- P1-2 remains unopened. Full 4–12-cell biome bridge art, elevation, corruption, the six other biome
  asset families, and replacement of their P0 rectangular placeholders are intentionally deferred.

## P1-1 ground art v3 — implementation in progress (2026-08-23)

- User rejected the v2 ground finish after comparing it with the supplied WorldBox land reference.
  The previous claim that grassland/woodland material was complete was corrected: v2 only separated
  palette/candidate pools and removed the sand-colored inland edge; it did not create sufficient art.
- Added a dedicated `ground` acceptance mode that keeps detailed terrain/water visible while hiding
  shadows, low cover, upright objects, and foreground sprites. Browser smoke now captures this state.
- RenderChunkPlan now carries deterministic temperate overlay handles and wet/middle/dune shore bands.
  The renderer adds seed-stable 19/46-cell quantized tone fields across chunk boundaries, uses the
  previously idle material-overlay assets, and composites material groups below autotile edges.
- Reworked grassland/woodland atlas frames into separate micro bases, sparse semantic overlays, and
  transparent irregular 16×16 patches; coast frames now leave quiet cells between wet/highlight marks.
- First v3 browser capture exposed a new sandpaper failure caused by overly frequent overlays and
  per-pixel group variation. The second pass reduced overlays from 5/7 to 1/2 of 16 sampled cells,
  changed groups to coherent color shapes, darkened the temperate bases, and strengthened wet/dune
  shore tinting. Continue visual iteration before marking this slice ready for user acceptance.

## P1-1 rounded ground material pass (2026-08-23)

- Rebuilt the `16×16px` grassland and woodland material-group silhouettes as unions of several
  offset ellipses. The result is a stepped, pixel-rounded natural patch rather than a hard rectangle.
- Kept sparse edge notches, varied aspect ratios, and quiet groups so the rounded treatment does not
  collapse into repeated circles, blurred edges, or an evenly tiled pebble pattern.
- Regenerated the P1 atlas and repeated the complete browser smoke flow. Ground-only, region, and
  close captures show continuous rounded material patches with trees removed or restored as expected.
- Latest cold world-to-detail transition reached all 9 visible detailed chunks in about `100.4ms`;
  measured P95 frame time was about `12.2ms`, within the `150ms` and `25ms` gates.
- This remains a P1-1 visual acceptance checkpoint. P1-2 elevation, corruption, and the remaining
  biome-specific art have not started.

## P1-1 ground high-frequency reduction (2026-08-23)

- User comparison showed that the rounded pass still contained substantially more uniform pixel
  noise than the supplied WorldBox reference, especially across sand, shallow water, and woodland.
- Added a deterministic browser regression signal over the fixed no-object ground view. The original
  v3 capture failed at `12.06%` high-frequency color edges against a new `5%` maximum.
- Root cause was three visual layers expressing micro-detail simultaneously: base-frame grain,
  outlined material groups, and frequent semantic overlays. This was an art-composition issue, not
  a world-generation or camera defect.
- Built `p1-temperate-coast-4`: water/coast base frames are quiet and structural ripples remain in
  the sparse effect layer; grass/woodland base marks are connected and limited to one quarter of
  variants; material groups no longer have dark outlines, appear in about `18%` of candidate groups,
  and render at lower opacity; semantic overlays now occur at roughly `1–2` of every `64` land cells.
- The final fixed scene measures `3.01%` high-frequency edges, a 75% reduction from the rejected
  capture. Browser world/region/close/debug flow passes with no console or asset errors; cold detail
  readiness is about `59.3ms` and P95 frame time about `15.8ms` in the final validation run.
- User accepted the final Web result and closed P1-1. P1-2 has not started; its next slice is limited
  to temperate biome bridging, elevation-rise visuals, and one constrained corruption front. Formal
  rainforest, savanna, desert, wetland, tundra, and polar art remains P2 scope.

## P1-2 structure slice — implemented, awaiting visual acceptance (2026-08-23)

- Closed P1-1 after user acceptance and opened P1-2 without expanding into the six P2 biome art sets.
- Added deterministic `4–12`-cell grassland/woodland visual bridges. The projection keeps each cell's
  authoritative biome while replacing the hard single-line edge with quantized cross-biome tongues.
- Added a controlled mountain core to the fixed continent so lowland, highland, and mountain are all
  observable. Authored rock base/group/overlay placeholders now express broken ledges and scree;
  highland and mountain object density is reduced instead of covering raised ground with forest.
- Replaced the old `32×32` corruption blocks with a land-only, continuously warped focus. Corruption
  is projected as a constrained theme tint, sparse veins, and a manifest-backed effect while the
  underlying landform, biome, water, and ground material stay intact.
- Added fixed acceptance chunks `180` (bridge), `118` (elevation), and `166` (temperate corruption),
  plus structure-debug projections and browser captures in `output/p1-2-acceptance/browser-smoke/`.
- Bumped the runtime catalog to `p1-structure-1` and generator version to `4`. The latest browser run
  reached all 9 visible detail chunks atomically in about `120ms`, with `24.2ms` P95 and `3.89%`
  ground high-frequency edges. Console errors and failed asset requests were zero.
- The fixed web-game client also exposed a first-frame timing race; acceptance fixtures are now
  hard-coded instead of rescanned during world preparation, and deterministic renderer stepping
  submits the Pixi stage. P1-2 is intentionally stopped at user visual acceptance before P2.

## P1-2 rapid-pan chunk flicker correction (2026-08-23)

- Reproduced the reported flash with a browser frame-by-frame gate: a fast viewport change dropped
  `visibleDetailedChunks` from 9 to 0 for eight frames while 22–15 chunks remained queued.
- Confirmed the cause was the visibility gate, not atlas network loading. Any incomplete new visible
  set hid every detail layer and exposed the world overview until the set became complete.
- Added committed detail coverage. The last complete chunk set stays visible and protected from LRU
  eviction while the next viewport builds; the renderer swaps to the new set only when it is complete.
- The same transition now retains 9 detailed chunks for every sampled build frame. Browser smoke passes
  at 135.2 ms cold detail readiness and 24.4 ms P95 with no console or asset errors.
- User re-tested rapid dragging, confirmed the flicker correction, and accepted P1-2. P1-2 is closed.
- P2 has not started. Its planned order is tropical/wet biomes, dry biomes, cold biomes, then the
  dedicated `lod-world` art/composition pass and the eight-template complete-world gate.

## P2-1 wet-hot biome slice — implemented, awaiting visual acceptance (2026-08-23)

- Opened P2 without changing the deterministic `continent + 0x1a2b3c4d` world facts. Fixed chunk
  `146` as the rainforest-coast view and chunk `201` as the wetland-mud-coast view.
- Added the independent `p2-wet-hot-1` catalog and `/map/p2/` PNG atlas set while retaining all 551
  semantic slots. Runtime loading no longer exposes a P1-specific catalog function name.
- Authored the first wet-hot batch: four rainforest and three wetland tree archetypes across the
  existing age/height contract, plus rainforest soil, wetland mud, fern, moss, mushroom, reed, and
  bush visuals. These remain replaceable prototype assets, not claimed final art.
- Generalized biome bridge projection to retain an encoded target biome and a deterministic `4–12`
  cell visual band. Snapshot biome facts remain untouched; the renderer only mixes the target palette.
- Browser review rejected the initial dense material-group pass as circular wallpaper. Wet-hot base
  frames are now quiet, material groups are rare and lower-opacity, and broad tone fields replace the
  medium-frequency repeated blobs.
- Final ground-only high-frequency rates are `2.21%` for the rainforest fixture and `3.38%` for the
  wetland fixture against a `5%` gate. The full Playwright flow passes with WebGL2, complete atomic
  chunk coverage, deterministic replay, no console errors, and no failed asset requests.
- P2-1 is intentionally stopped at user visual acceptance. P2-2 dry biomes has not started.
- Exposed the two fixed acceptance cameras as the development-only `雨林` and `湿地` controls; the browser smoke test now reaches both scenes through those visible controls.

## P2-2 dry biome slice — implemented, awaiting visual acceptance (2026-08-23)

- User accepted rainforest and wetland, closing P2-1. Opened P2-2 without starting cold biomes or
  world-LOD art. Fixed `continent + seed 8`, chunk `126` for savanna coast and chunk `141` for the
  desert/savanna transition.
- Added `p2-dry-2` with 599 replaceable assets and independent `/map/p2-2/` PNG atlases. Savanna and
  desert now resolve separate bare-soil/sand base, group, and overlay candidates without overwriting
  temperate or wet-hot decoration art.
- Authored prototype dry assets: three savanna tree archetypes, one rare desert/oasis archetype,
  dry grass, thorn bush, cactus, weathered stones, deadwood, and bleached coast debris. After the
  ground passed user review, refined grass/high grass, bush, cactus, small stone/rock cluster, stump,
  and dead tree so every asset family has at least three genuinely different silhouettes. Lighting
  now shares the trees' top-left highlight, bottom-right dark edge, ground shadow, and controlled
  color tiers. Existing age/height contracts remain intact; object placement and snapshot facts were
  not rewritten.
- Kept 4x4 ground bases quiet and moved recognition to broad coordinate-stable tones, sparse organic
  16x16 groups, and semantic objects. Removed a first-pass base mark pattern after desert measured
  5.04% high-frequency edges; final savanna/desert ground-only rates are 1.56% / 1.63%.
- Added visible `草原` / `沙漠` acceptance controls plus deterministic P2-2 tests and browser smoke.
  Atlas generation now fails unless eight refined decoration families each expose at least three
  distinct trimmed alpha masks; semantic form tags also preserve those silhouette identities.
  The close-LOD rapid drag retains atomic chunk coverage; P2-1 regression, console, requests,
  WebGL2, DPR, binary alpha, build, 38 unit tests, Biome check, and the 127ms projection gate pass.
- P2-2 ground is user-accepted; the decoration refinement is intentionally stopped for user visual
  acceptance. P2-3 cold biomes and P2-4 dedicated world-view art have not started.

## P2-3 cold biome slice — implemented, awaiting visual acceptance (2026-08-23)

- User accepted the P2-2 decoration refinement and opened P2-3. The stable replacement seam remains
  the existing visual manifest: semantic ID, source canvas/size family, bottom-center anchor, logical
  footprint, clearance, render layer, shadow/LOD references, and animation states are contractual;
  PNG files, atlas pages, frame positions, silhouettes, and palette values remain replaceable.
- Generator version 5 adds one deterministic northern cold ridge to the representative continent.
  This fixes a real world-fact gap: the previous fixed seeds contained tundra and polar cells but no
  cold highland or mountain cells. The ridge is generated terrain, not a snow-mountain render decal.
- Locked `continent + seed 8` with chunk `36` for tundra snow coast, chunk `24` for polar ice coast,
  and chunk `38` for the cold elevation relationship. The generator and acceptance tests assert all
  three structures and preserve same-input determinism.
- Added the independent `p2-cold-1` catalog with 680 contract-valid assets under `/map/p2-3/`:
  tundra snow, polar ice, cold rock base/group/overlay sets; two tundra tree archetypes across all
  existing age/height combinations; and cold grass/lichen, bush, stone, rock, crystal, stump, dead
  tree, and coast-debris candidates.
- Cold coast, highland, and mountain use dedicated palette roles. Polar and tundra retain quiet
  `4×4px` bases, sparse `16×16px` groups, and low-frequency overlays; a browser ground-only gate caps
  high-frequency edges at 5% and caught/removes the first noisy wildcard-candidate pass.
- Added visible `苔原` / `极地` / `寒岭` acceptance controls. Browser smoke confirms WebGL2, DPR at
  most 2, atomic detailed chunk coverage, all three fixed cameras, no console errors, and no failed
  asset requests. P2-3 now stops for user visual acceptance; P2-4 world-view art has not started.

## P2-4 closure and P3-1 new-world entry — implemented, awaiting entry acceptance (2026-08-23)

- User accepted the world/region/close LOD relationship, so P2-4 is closed. The dedicated world atlas,
  real-object density aggregation, eight-template matrix, continuity gate, and performance budgets stay
  unchanged; P3-2 formal game tools remain unstarted.
- Replaced phase-coded source bundle names with `MapVisualContractBundle`,
  `TemperateMapVisualBundle`, `WetHotMapVisualBundle`, `DryMapVisualBundle`, and
  `ColdMapVisualBundle`. Runtime symbols, tests, catalog composition, and atlas builders now use the
  same semantic names; generated atlas storage paths remain stable to avoid an unrelated asset move.
- Added eight original `128×128px` structural template previews and a cartographer-table entry screen.
  The player-facing `/` route does not render seed controls. Every template choice creates a fresh
  unsigned random seed; deterministic input is limited to Vite development with `?mapDebug=1`.
- Rebuilt loading as an original star-map/world-core scene driven by actual generation stages and
  percentage, with cancellation and reduced-motion handling. It never exposes the previous world or a
  fake progress timer.
- Generator version 7 keeps the continent template's main-landmass contract while applying broad
  domain warp, irregular coast rhythm, and six deterministic satellite-island fields. Same template +
  seed remains reproducible. Acceptance fixtures were re-locked to real v7 slices rather than weakening
  geography to preserve old chunk coordinates.
- The dedicated entry smoke reaches template selection → real loading → Pixi world, verifies all eight
  choices, hidden default seed, random session seed, console/network cleanliness, and records review
  captures under `apps/eon-vale/output/p3-1-new-world-entry/browser-smoke/`.

## P3-1 entry revision after first visual review — implemented, awaiting re-acceptance (2026-08-23)

- Replaced the structural pixel previews with eight original top-down cartoon concept paintings. The
  source renders remain outside the runtime bundle; `640×640` WebP derivatives live under
  `public/map/ui/concepts/` and can be replaced without changing template or generation rules.
- Rebuilt template selection and loading around rounded parchment cards, chunky outlines, warm accent
  colors, compact player-facing copy, keyboard focus, pressed states, and reduced motion. Loading keeps
  its real job-stage interaction while sharing the same visual language.
- Generator version 8 makes the player-facing structures materially different: the mainland has
  peninsulas and detached satellites, twin continents remain separate, the island chain has at least
  six disconnected islands, and the former lone-island slot is now a three-continent world. Fixed-seed
  tests enforce those topology facts as well as every template's declared land-share range.
- Added a visible in-world “更换世界” route back to template selection. Development acceptance controls
  now load their required fixed world before focusing the requested biome, fixing controls that appeared
  clickable but silently did nothing on an arbitrary random world.
- Browser smoke now covers selection → loading → world, a cross-seed acceptance jump, and world →
  selection without refresh. The run is WebGL2, reports no console or request failures, and the full
  suite passes 47 unit tests plus production build. P3-2 remains unstarted pending visual acceptance.
