import archGateUrl from '../assets/models/setpieces/arch_gate.glb';
import barrelTowerUrl from '../assets/models/setpieces/barrel_tower.glb';
import beamCrossUrl from '../assets/models/setpieces/beam_cross.glb';
import beamHazardUrl from '../assets/models/setpieces/beam_hazard.glb';
import boulderRoundUrl from '../assets/models/setpieces/boulder_round.glb';
import branchBridgeUrl from '../assets/models/setpieces/branch_bridge.glb';
import bridgeArcUrl from '../assets/models/setpieces/bridge_arc.glb';
import bridgeLatticeUrl from '../assets/models/setpieces/bridge_lattice.glb';
import cliffBlockUrl from '../assets/models/setpieces/cliff_block.glb';
import cloudArchUrl from '../assets/models/setpieces/cloud_arch.glb';
import cloudPadUrl from '../assets/models/setpieces/cloud_pad.glb';
import cloudRingUrl from '../assets/models/setpieces/cloud_ring.glb';
import containerLongUrl from '../assets/models/setpieces/container_long.glb';
import containerShortUrl from '../assets/models/setpieces/container_short.glb';
import crateTallUrl from '../assets/models/setpieces/crate_tall.glb';
import crystalClusterUrl from '../assets/models/setpieces/crystal_cluster.glb';
import cubeFrameUrl from '../assets/models/setpieces/cube_frame.glb';
import drumPlatformUrl from '../assets/models/setpieces/drum_platform.glb';
import duneBackboneUrl from '../assets/models/setpieces/dune_backbone.glb';
import fanBladeUrl from '../assets/models/setpieces/fan_blade.glb';
import floatingIslandUrl from '../assets/models/setpieces/floating_island.glb';
import grassPatchUrl from '../assets/models/setpieces/grass_patch.glb';
import hexPadUrl from '../assets/models/setpieces/hex_pad.glb';
import houseTunnelUrl from '../assets/models/setpieces/house_tunnel.glb';
import hutFrameLargeUrl from '../assets/models/setpieces/hut_frame_large.glb';
import hutFrameSmallUrl from '../assets/models/setpieces/hut_frame_small.glb';
import ledgeHookUrl from '../assets/models/setpieces/ledge_hook.glb';
import logTiltUrl from '../assets/models/setpieces/log_tilt.glb';
import lotusPadUrl from '../assets/models/setpieces/lotus_pad.glb';
import meteorChunkUrl from '../assets/models/setpieces/meteor_chunk.glb';
import moonStepUrl from '../assets/models/setpieces/moon_step.glb';
import neonPillarUrl from '../assets/models/setpieces/neon_pillar.glb';
import orbPodiumUrl from '../assets/models/setpieces/orb_podium.glb';
import pillarThinUrl from '../assets/models/setpieces/pillar_thin.glb';
import pipeLongUrl from '../assets/models/setpieces/pipe_long.glb';
import plankLongUrl from '../assets/models/setpieces/plank_long.glb';
import prismGateUrl from '../assets/models/setpieces/prism_gate.glb';
import rampWedgeUrl from '../assets/models/setpieces/ramp_wedge_v2.glb';
import roadSegmentUrl from '../assets/models/setpieces/road_segment.glb';
import rockSlabUrl from '../assets/models/setpieces/rock_slab.glb';
import ropePostUrl from '../assets/models/setpieces/rope_post.glb';
import roundStoolUrl from '../assets/models/setpieces/round_stool.glb';
import shellRidgeUrl from '../assets/models/setpieces/shell_ridge.glb';
import skyBridgeLongUrl from '../assets/models/setpieces/sky_bridge_long.glb';
import spiralPillarUrl from '../assets/models/setpieces/spiral_pillar.glb';
import starFrameUrl from '../assets/models/setpieces/star_frame.glb';
import steppingStoneUrl from '../assets/models/setpieces/stepping_stone.glb';
import stumpShortUrl from '../assets/models/setpieces/stump_short.glb';
import totemMaskUrl from '../assets/models/setpieces/totem_mask.glb';
import towerGateUrl from '../assets/models/setpieces/tower_gate.glb';
import treePineUrl from '../assets/models/setpieces/tree_pine.glb';
import tunnelFrameUrl from '../assets/models/setpieces/tunnel_frame.glb';
import vortexRingUrl from '../assets/models/setpieces/vortex_ring.glb';
import wingPlatformUrl from '../assets/models/setpieces/wing_platform.glb';
import zigzagBeamUrl from '../assets/models/setpieces/zigzag_beam.glb';
import { toRuntimeAssetUrl } from './assetUrl';
import { isRemovedSetPieceAsset } from './removedSetPieceAssets';
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
  rock_slab: {
    id: 'rock_slab',
    name: '岩板',
    url: toRuntimeAssetUrl(rockSlabUrl, import.meta.url),
    colliderSize: [2.8, 0.55, 1.6],
    colliderOffset: [0, 0.28, 0],
    baseColor: '#7f8891',
    surfacePreset: 'concrete',
  },
  boulder_round: {
    id: 'boulder_round',
    name: '圆巨石',
    url: toRuntimeAssetUrl(boulderRoundUrl, import.meta.url),
    colliderSize: [2.2, 1.8, 2],
    colliderOffset: [0, 0.9, 0],
    baseColor: '#747c85',
    surfacePreset: 'concrete',
  },
  stump_short: {
    id: 'stump_short',
    name: '短树桩',
    url: toRuntimeAssetUrl(stumpShortUrl, import.meta.url),
    colliderSize: [1.1, 0.9, 1.1],
    colliderOffset: [0, 0.45, 0],
    baseColor: '#93633c',
    surfacePreset: 'wood',
  },
  log_tilt: {
    id: 'log_tilt',
    name: '横木',
    url: toRuntimeAssetUrl(logTiltUrl, import.meta.url),
    colliderSize: [3.8, 0.7, 0.7],
    colliderOffset: [0, 0.72, 0],
    baseColor: '#8e5d38',
    surfacePreset: 'wood',
  },
  branch_bridge: {
    id: 'branch_bridge',
    name: '树枝桥',
    url: toRuntimeAssetUrl(branchBridgeUrl, import.meta.url),
    colliderSize: [4.2, 0.26, 0.92],
    colliderOffset: [0, 0.18, 0],
    baseColor: '#9b6d42',
    surfacePreset: 'wood',
  },
  pillar_thin: {
    id: 'pillar_thin',
    name: '细石柱',
    url: toRuntimeAssetUrl(pillarThinUrl, import.meta.url),
    colliderSize: [0.9, 3.3, 0.9],
    colliderOffset: [0, 1.65, 0],
    baseColor: '#a6a59f',
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
  ledge_hook: {
    id: 'ledge_hook',
    name: '悬挑台',
    url: toRuntimeAssetUrl(ledgeHookUrl, import.meta.url),
    colliderSize: [2.6, 0.24, 1],
    colliderOffset: [0, 1.12, -0.1],
    baseColor: '#939da8',
    surfacePreset: 'metal',
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
  beam_cross: {
    id: 'beam_cross',
    name: '十字木梁',
    url: toRuntimeAssetUrl(beamCrossUrl, import.meta.url),
    colliderSize: [3.3, 0.5, 3.1],
    colliderOffset: [0, 0.72, 0],
    baseColor: '#a36f44',
    surfacePreset: 'wood',
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
  rope_post: {
    id: 'rope_post',
    name: '绳桩',
    url: toRuntimeAssetUrl(ropePostUrl, import.meta.url),
    colliderSize: [0.7, 2.5, 0.7],
    colliderOffset: [0, 1.25, 0],
    baseColor: '#855a36',
    surfacePreset: 'wood',
  },
  hut_frame_small: {
    id: 'hut_frame_small',
    name: '小木屋骨架',
    url: toRuntimeAssetUrl(hutFrameSmallUrl, import.meta.url),
    colliderSize: [2.7, 0.16, 2.4],
    colliderOffset: [0, 2.62, 0],
    baseColor: '#8f6640',
    surfacePreset: 'wood',
  },
  hut_frame_large: {
    id: 'hut_frame_large',
    name: '大木屋骨架',
    url: toRuntimeAssetUrl(hutFrameLargeUrl, import.meta.url),
    colliderSize: [4.4, 0.2, 3.3],
    colliderOffset: [0, 3.28, 0],
    baseColor: '#966c44',
    surfacePreset: 'wood',
  },
  arch_gate: {
    id: 'arch_gate',
    name: '石拱门',
    url: toRuntimeAssetUrl(archGateUrl, import.meta.url),
    colliderSize: [3.3, 0.6, 0.9],
    colliderOffset: [0, 3.1, 0],
    baseColor: '#8d9194',
    surfacePreset: 'concrete',
  },
  tunnel_frame: {
    id: 'tunnel_frame',
    name: '隧道框',
    url: toRuntimeAssetUrl(tunnelFrameUrl, import.meta.url),
    colliderSize: [3.7, 0.26, 3.6],
    colliderOffset: [0, 2.52, 0],
    baseColor: '#8e98a0',
    surfacePreset: 'metal',
  },
  cube_frame: {
    id: 'cube_frame',
    name: '立方框架',
    url: toRuntimeAssetUrl(cubeFrameUrl, import.meta.url),
    colliderSize: [2.8, 0.2, 2.8],
    colliderOffset: [0, 2.5, 0],
    baseColor: '#9b734a',
    surfacePreset: 'wood',
  },
  house_tunnel: {
    id: 'house_tunnel',
    name: '穿屋门洞',
    url: toRuntimeAssetUrl(houseTunnelUrl, import.meta.url),
    colliderSize: [3.4, 0.2, 2.5],
    colliderOffset: [0, 2.85, 0],
    baseColor: '#aa845f',
    surfacePreset: 'wood',
  },
  cloud_pad: {
    id: 'cloud_pad',
    name: '云朵平台',
    url: toRuntimeAssetUrl(cloudPadUrl, import.meta.url),
    colliderSize: [3.2, 0.16, 1.9],
    colliderOffset: [0, 0.2, 0],
    baseColor: '#f7fbff',
    surfacePreset: 'cloud',
  },
  cloud_ring: {
    id: 'cloud_ring',
    name: '云环平台',
    url: toRuntimeAssetUrl(cloudRingUrl, import.meta.url),
    colliderSize: [2.6, 0.14, 2],
    colliderOffset: [0, 0.2, 0],
    baseColor: '#f8fcff',
    surfacePreset: 'cloud',
  },
  cloud_arch: {
    id: 'cloud_arch',
    name: '云拱平台',
    url: toRuntimeAssetUrl(cloudArchUrl, import.meta.url),
    colliderSize: [3.5, 0.15, 1.5],
    colliderOffset: [0, 0.26, 0],
    baseColor: '#f8fcff',
    surfacePreset: 'cloud',
  },
  floating_island: {
    id: 'floating_island',
    name: '浮空岛',
    url: toRuntimeAssetUrl(floatingIslandUrl, import.meta.url),
    colliderSize: [3.6, 0.24, 2.5],
    colliderOffset: [0, 0.46, 0],
    baseColor: '#81af7a',
    surfacePreset: 'grass',
  },
  spiral_pillar: {
    id: 'spiral_pillar',
    name: '螺旋石柱',
    url: toRuntimeAssetUrl(spiralPillarUrl, import.meta.url),
    colliderSize: [1.9, 4.4, 1.9],
    colliderOffset: [0, 2.2, 0],
    baseColor: '#9fa1a4',
    surfacePreset: 'concrete',
  },
  sky_bridge_long: {
    id: 'sky_bridge_long',
    name: '天桥长段',
    url: toRuntimeAssetUrl(skyBridgeLongUrl, import.meta.url),
    colliderSize: [7.8, 0.16, 1.0],
    colliderOffset: [0, 0.16, 0],
    baseColor: '#a06f45',
    surfacePreset: 'wood',
  },
  prism_gate: {
    id: 'prism_gate',
    name: '棱镜门',
    url: toRuntimeAssetUrl(prismGateUrl, import.meta.url),
    colliderSize: [2.9, 0.28, 0.6],
    colliderOffset: [0, 3.05, 0],
    baseColor: '#92a0b0',
    surfacePreset: 'metal',
  },
  lotus_pad: {
    id: 'lotus_pad',
    name: '莲叶台',
    url: toRuntimeAssetUrl(lotusPadUrl, import.meta.url),
    colliderSize: [2.8, 0.18, 2.1],
    colliderOffset: [0, 0.22, 0],
    baseColor: '#77ac79',
    surfacePreset: 'grass',
  },
  meteor_chunk: {
    id: 'meteor_chunk',
    name: '陨石块',
    url: toRuntimeAssetUrl(meteorChunkUrl, import.meta.url),
    colliderSize: [2.8, 0.16, 1.8],
    colliderOffset: [0.1, 1.05, -0.05],
    baseColor: '#60626d',
    surfacePreset: 'concrete',
  },
  neon_pillar: {
    id: 'neon_pillar',
    name: '霓虹柱',
    url: toRuntimeAssetUrl(neonPillarUrl, import.meta.url),
    colliderSize: [0.95, 0.14, 0.95],
    colliderOffset: [0, 3.18, 0],
    baseColor: '#b5eeff',
    surfacePreset: 'metal',
  },
  drum_platform: {
    id: 'drum_platform',
    name: '鼓台',
    url: toRuntimeAssetUrl(drumPlatformUrl, import.meta.url),
    colliderSize: [1.96, 0.08, 1.96],
    colliderOffset: [0, 1.08, 0],
    baseColor: '#995749',
    surfacePreset: 'wood',
  },
  zigzag_beam: {
    id: 'zigzag_beam',
    name: '折线梁',
    url: toRuntimeAssetUrl(zigzagBeamUrl, import.meta.url),
    colliderSize: [4.2, 0.2, 0.8],
    colliderOffset: [0, 0.5, 0],
    baseColor: '#a6764c',
    surfacePreset: 'wood',
  },
  fan_blade: {
    id: 'fan_blade',
    name: '风扇台',
    url: toRuntimeAssetUrl(fanBladeUrl, import.meta.url),
    colliderSize: [2.8, 0.14, 2.8],
    colliderOffset: [0, 0.46, 0],
    baseColor: '#8992a0',
    surfacePreset: 'metal',
  },
  bridge_arc: {
    id: 'bridge_arc',
    name: '弧桥',
    url: toRuntimeAssetUrl(bridgeArcUrl, import.meta.url),
    colliderSize: [3.6, 0.16, 1.0],
    colliderOffset: [0, 0.75, 0],
    baseColor: '#9c7049',
    surfacePreset: 'wood',
  },
  crystal_cluster: {
    id: 'crystal_cluster',
    name: '晶簇',
    url: toRuntimeAssetUrl(crystalClusterUrl, import.meta.url),
    colliderSize: [1.9, 0.14, 1.2],
    colliderOffset: [0.08, 0.2, 0],
    baseColor: '#a8dcf3',
    surfacePreset: 'cloud',
  },
  moon_step: {
    id: 'moon_step',
    name: '月牙台',
    url: toRuntimeAssetUrl(moonStepUrl, import.meta.url),
    colliderSize: [2.3, 0.14, 1.4],
    colliderOffset: [0, 0.22, 0],
    baseColor: '#e5e8ec',
    surfacePreset: 'concrete',
  },
  star_frame: {
    id: 'star_frame',
    name: '星框',
    url: toRuntimeAssetUrl(starFrameUrl, import.meta.url),
    colliderSize: [2.2, 0.14, 0.36],
    colliderOffset: [0, 0.62, 0],
    baseColor: '#f5c865',
    surfacePreset: 'metal',
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
  totem_mask: {
    id: 'totem_mask',
    name: '图腾柱',
    url: toRuntimeAssetUrl(totemMaskUrl, import.meta.url),
    colliderSize: [1.2, 0.2, 0.9],
    colliderOffset: [0, 2.72, 0],
    baseColor: '#a9774f',
    surfacePreset: 'wood',
  },
  shell_ridge: {
    id: 'shell_ridge',
    name: '贝脊台',
    url: toRuntimeAssetUrl(shellRidgeUrl, import.meta.url),
    colliderSize: [2.7, 0.12, 1.6],
    colliderOffset: [0, 0.18, 0],
    baseColor: '#e2ccba',
    surfacePreset: 'concrete',
  },
  wing_platform: {
    id: 'wing_platform',
    name: '翼台',
    url: toRuntimeAssetUrl(wingPlatformUrl, import.meta.url),
    colliderSize: [2.8, 0.14, 0.78],
    colliderOffset: [0, 0.46, 0],
    baseColor: '#aeb6c1',
    surfacePreset: 'metal',
  },
  vortex_ring: {
    id: 'vortex_ring',
    name: '涡环',
    url: toRuntimeAssetUrl(vortexRingUrl, import.meta.url),
    colliderSize: [2.6, 0.18, 2.6],
    colliderOffset: [0, 0.62, 0],
    baseColor: '#7d93b6',
    surfacePreset: 'metal',
  },
  tower_gate: {
    id: 'tower_gate',
    name: '塔门',
    url: toRuntimeAssetUrl(towerGateUrl, import.meta.url),
    colliderSize: [3.6, 0.44, 0.8],
    colliderOffset: [0, 3.5, 0],
    baseColor: '#8b9298',
    surfacePreset: 'concrete',
  },
  hex_pad: {
    id: 'hex_pad',
    name: '六角垫',
    url: toRuntimeAssetUrl(hexPadUrl, import.meta.url),
    colliderSize: [2.44, 0.18, 2.44],
    colliderOffset: [0, 0.24, 0],
    baseColor: '#89a7d0',
    surfacePreset: 'cloud',
  },
  bridge_lattice: {
    id: 'bridge_lattice',
    name: '格桥',
    url: toRuntimeAssetUrl(bridgeLatticeUrl, import.meta.url),
    colliderSize: [3.9, 0.14, 0.94],
    colliderOffset: [0, 0.34, 0],
    baseColor: '#9a7048',
    surfacePreset: 'wood',
  },
  orb_podium: {
    id: 'orb_podium',
    name: '球坛',
    url: toRuntimeAssetUrl(orbPodiumUrl, import.meta.url),
    colliderSize: [1.8, 0.1, 1.8],
    colliderOffset: [0, 1.06, 0],
    baseColor: '#7f8790',
    surfacePreset: 'metal',
  },
  dune_backbone: {
    id: 'dune_backbone',
    name: '沙脊',
    url: toRuntimeAssetUrl(duneBackboneUrl, import.meta.url),
    colliderSize: [3.8, 0.16, 1.7],
    colliderOffset: [0, 0.25, 0],
    baseColor: '#c0a97d',
    surfacePreset: 'concrete',
  },
};

export function getClimberSetPieceAsset(
  assetId: ClimberSetPieceAssetId,
): ClimberSetPieceAssetDefinition {
  return SETPIECE_CATALOG[assetId];
}

export function getAllClimberSetPieceAssets(): ClimberSetPieceAssetDefinition[] {
  return Object.values(SETPIECE_CATALOG).filter((asset) => !isRemovedSetPieceAsset(asset.id));
}
