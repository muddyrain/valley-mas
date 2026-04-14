import barrelTowerUrl from '../assets/models/setpieces/barrel_tower.glb';
import beamHazardUrl from '../assets/models/setpieces/beam_hazard.glb';
import cliffBlockUrl from '../assets/models/setpieces/cliff_block.glb';
import containerLongUrl from '../assets/models/setpieces/container_long.glb';
import containerShortUrl from '../assets/models/setpieces/container_short.glb';
import crateTallUrl from '../assets/models/setpieces/crate_tall.glb';
import pipeLongUrl from '../assets/models/setpieces/pipe_long.glb';
import plankLongUrl from '../assets/models/setpieces/plank_long.glb';
import rampWedgeUrl from '../assets/models/setpieces/ramp_wedge_v2.glb';
import rockSlabUrl from '../assets/models/setpieces/rock_slab.glb';
import steppingStoneUrl from '../assets/models/setpieces/stepping_stone.glb';
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
  rock_slab: {
    id: 'rock_slab',
    name: '岩板',
    url: toRuntimeAssetUrl(rockSlabUrl, import.meta.url),
    colliderSize: [2.8, 0.55, 1.6],
    colliderOffset: [0, 0.28, 0],
    baseColor: '#7f8891',
    surfacePreset: 'concrete',
  },
  crate_tall: {
    id: 'crate_tall',
    name: '高木箱',
    url: toRuntimeAssetUrl(crateTallUrl, import.meta.url),
    colliderSize: [1.55, 2.4, 1.55],
    colliderOffset: [0, 1.2, 0],
    baseColor: '#845931',
    surfacePreset: 'wood',
  },
  cliff_block: {
    id: 'cliff_block',
    name: '岩块台',
    url: toRuntimeAssetUrl(cliffBlockUrl, import.meta.url),
    colliderSize: [2.3, 1.4, 2.2],
    colliderOffset: [0, 0.7, 0],
    baseColor: '#767d83',
    surfacePreset: 'concrete',
  },
  stepping_stone: {
    id: 'stepping_stone',
    name: '踏步石',
    url: toRuntimeAssetUrl(steppingStoneUrl, import.meta.url),
    colliderSize: [1.65, 0.78, 1.35],
    colliderOffset: [0, 0.42, 0],
    baseColor: '#949ba2',
    surfacePreset: 'concrete',
  },
  barrel_tower: {
    id: 'barrel_tower',
    name: '桶塔',
    url: toRuntimeAssetUrl(barrelTowerUrl, import.meta.url),
    colliderSize: [1.68, 0.08, 1.68],
    colliderOffset: [0, 2.22, 0],
    baseColor: '#8a5e39',
    surfacePreset: 'wood',
  },
};

export function getClimberSetPieceAsset(
  assetId: ClimberSetPieceAssetId,
): ClimberSetPieceAssetDefinition {
  return SETPIECE_CATALOG[assetId];
}

export function getAllClimberSetPieceAssets(): ClimberSetPieceAssetDefinition[] {
  return Object.values(SETPIECE_CATALOG);
}
