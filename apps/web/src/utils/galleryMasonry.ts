export type GalleryMasonryResource = {
  id: string;
  width?: number;
  height?: number;
};

const UNKNOWN_IMAGE_RATIO = 1;
const CAPTION_HEIGHT_WEIGHT = 0.16;

function getResourceHeightWeight(resource: GalleryMasonryResource) {
  if (
    typeof resource.width !== 'number' ||
    typeof resource.height !== 'number' ||
    resource.width <= 0 ||
    resource.height <= 0
  ) {
    return UNKNOWN_IMAGE_RATIO + CAPTION_HEIGHT_WEIGHT;
  }
  return resource.height / resource.width + CAPTION_HEIGHT_WEIGHT;
}

/**
 * Assigns resources incrementally to the current shortest lane.
 * Re-running with an appended resource list preserves every existing assignment.
 */
export function distributeGalleryResources<T extends GalleryMasonryResource>(
  resources: T[],
  requestedColumnCount: number,
) {
  const columnCount = Math.max(1, Math.floor(requestedColumnCount) || 1);
  const columns = Array.from({ length: columnCount }, () => [] as T[]);
  const heights = Array.from({ length: columnCount }, () => 0);

  for (const resource of resources) {
    let shortestLane = 0;
    for (let lane = 1; lane < columnCount; lane += 1) {
      if (heights[lane] < heights[shortestLane]) shortestLane = lane;
    }
    columns[shortestLane].push(resource);
    heights[shortestLane] += getResourceHeightWeight(resource);
  }

  return columns;
}
