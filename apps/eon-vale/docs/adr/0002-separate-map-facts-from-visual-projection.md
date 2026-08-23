# Separate map facts from visual projection and rendering

Eon Vale will generate one complete, read-only `WorldSnapshot` from a template and seed, then keep map facts, visual asset resolution, chunk projection and Pixi rendering behind separate interfaces. The generator records semantic geography and object placement without atlas knowledge; `MapProjection` combines those facts with a validated `VisualCatalog`; Pixi only executes the resulting plans. This was chosen over letting the renderer select assets or regenerating facts per chunk so placeholder and formal tilesets can be replaced without moving objects, LODs remain projections of one world, and determinism can be tested before pixels reach the GPU.

## Consequences

- The new runtime has one public `MapSession` seam and no page-level access to snapshot arrays, Worker messages, projection rules or Pixi caches.
- Visual bundle changes invalidate projection and GPU caches, not the generated world.
- The old row-bound SVG atlas loaders and monolithic `MapRenderer` are deleted after the P0 vertical path replaces the application entry; no compatibility adapter remains.
- The current product intentionally has no map editing, persistence or pre-release generator compatibility.
