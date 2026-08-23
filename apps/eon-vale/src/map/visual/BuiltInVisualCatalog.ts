import { decodeAtlasInBrowser } from './BrowserAtlasDecoder';
import { BUILT_IN_MAP_VISUAL_BUNDLE } from './BuiltInMapVisualBundle';
import { createVisualCatalog, type VisualCatalog } from './VisualCatalog';

let builtInCatalogPromise: Promise<VisualCatalog> | undefined;

export function loadBuiltInVisualCatalog(): Promise<VisualCatalog> {
  builtInCatalogPromise ??= createVisualCatalog(BUILT_IN_MAP_VISUAL_BUNDLE, decodeAtlasInBrowser);
  return builtInCatalogPromise;
}
