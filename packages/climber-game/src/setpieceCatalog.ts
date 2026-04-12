import beamHazardUrl from '../assets/models/setpieces/beam_hazard.glb';
import containerLongUrl from '../assets/models/setpieces/container_long.glb';
import containerShortUrl from '../assets/models/setpieces/container_short.glb';
import grassPatchUrl from '../assets/models/setpieces/grass_patch.glb';
import pipeLongUrl from '../assets/models/setpieces/pipe_long.glb';
import plankLongUrl from '../assets/models/setpieces/plank_long.glb';
import rampWedgeUrl from '../assets/models/setpieces/ramp_wedge_v2.glb';
import roadSegmentUrl from '../assets/models/setpieces/road_segment.glb';
import roundStoolUrl from '../assets/models/setpieces/round_stool.glb';
import treePineUrl from '../assets/models/setpieces/tree_pine.glb';
import { toRuntimeAssetUrl } from './assetUrl';
import type { ClimberSetPieceAssetDefinition, ClimberSetPieceAssetId } from './types';

const SETPIECE_CATALOG: Record<ClimberSetPieceAssetId, ClimberSetPieceAssetDefinition> = {
  plank_long: {
    id: 'plank_long',
    name: '长木板',
    url: toRuntimeAssetUrl(plankLongUrl, import.meta.url),
    colliderSize: [5.4, 0.28, 1.04],
    colliderOffset: [0, 0.2, 0],
    baseColor: '#b97842',
    surfacePreset: 'wood',
  },
  pipe_long: {
    id: 'pipe_long',
    name: '长管道',
    url: toRuntimeAssetUrl(pipeLongUrl, import.meta.url),
    colliderSize: [4.8, 1.44, 1.44],
    colliderOffset: [0, 0.72, 0],
    baseColor: '#b8c7d1',
    surfacePreset: 'metal',
  },
  container_short: {
    id: 'container_short',
    name: '短货柜',
    url: toRuntimeAssetUrl(containerShortUrl, import.meta.url),
    colliderSize: [3.6, 1.6, 2.1],
    colliderOffset: [0, 0.8, 0],
    baseColor: '#2b6dd6',
    surfacePreset: 'container',
  },
  container_long: {
    id: 'container_long',
    name: '长货柜',
    url: toRuntimeAssetUrl(containerLongUrl, import.meta.url),
    colliderSize: [5.8, 1.8, 2.24],
    colliderOffset: [0, 0.9, 0],
    baseColor: '#d2552f',
    surfacePreset: 'container',
  },
  ramp_wedge: {
    id: 'ramp_wedge',
    name: '斜坡块',
    url: toRuntimeAssetUrl(rampWedgeUrl, import.meta.url),
    colliderSize: [3, 1, 1.4],
    colliderOffset: [0, 0.5, 0],
    colliderShape: 'ramp',
    colliderLocalRotation: [0, 0, 0],
    baseColor: '#b9a06c',
    surfacePreset: 'concrete',
  },
  beam_hazard: {
    id: 'beam_hazard',
    name: '警示横杆',
    url: toRuntimeAssetUrl(beamHazardUrl, import.meta.url),
    colliderSize: [4.8, 0.52, 1],
    colliderOffset: [0, 0.26, 0],
    baseColor: '#f1be2b',
    surfacePreset: 'hazard',
  },
  round_stool: {
    id: 'round_stool',
    name: '圆台',
    url: toRuntimeAssetUrl(roundStoolUrl, import.meta.url),
    colliderSize: [1.2, 1.2, 1.2],
    colliderOffset: [0, 0.6, 0],
    baseColor: '#ef5f49',
    surfacePreset: 'metal',
  },
  tree_pine: {
    id: 'tree_pine',
    name: '松树',
    url: toRuntimeAssetUrl(treePineUrl, import.meta.url),
    colliderSize: [1.2, 3.2, 1.2],
    colliderOffset: [0, 1.6, 0],
    baseColor: '#2f8f3e',
    surfacePreset: 'leaf',
    preserveMaterial: true,
  },
  grass_patch: {
    id: 'grass_patch',
    name: '草丛',
    url: toRuntimeAssetUrl(grassPatchUrl, import.meta.url),
    colliderSize: [1, 0.35, 1],
    colliderOffset: [0, 0.18, 0],
    baseColor: '#3faa4a',
    surfacePreset: 'grass',
  },
  road_segment: {
    id: 'road_segment',
    name: '路面',
    url: toRuntimeAssetUrl(roadSegmentUrl, import.meta.url),
    colliderSize: [9, 0.16, 3.2],
    colliderOffset: [0, 0.08, 0],
    baseColor: '#3a3c40',
    surfacePreset: 'asphalt',
  },
};

export function getClimberSetPieceAsset(
  assetId: ClimberSetPieceAssetId,
): ClimberSetPieceAssetDefinition {
  return SETPIECE_CATALOG[assetId];
}
