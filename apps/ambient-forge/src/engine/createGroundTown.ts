import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import type { QualityProfile } from '../core/quality';
import type { SceneSignals } from '../core/scene-signals';
import { scaleTownVec2, TOWN_LAYOUT_SCALE } from '../core/town-layout';
import {
  createCollisionFreeNavigationGraph,
  type NavigationGraph,
  type TownCollider,
  type TownVec2,
} from '../core/town-navigation';
import { disposeObject3D } from './dispose';

export interface ParkingSpot {
  id: string;
  position: TownVec2;
  heading: number;
  roadNodeId: string;
}

export interface GroundTownAssembly {
  root: Group;
  colliders: readonly TownCollider[];
  pedestrianGraph: NavigationGraph;
  vehicleGraph: NavigationGraph;
  parkingSpots: readonly ParkingSpot[];
  update: (signals: SceneSignals, elapsed?: number) => void;
  getActivitySnapshot: () => TownActivitySnapshot;
  setQuality: (profile: QualityProfile) => void;
  dispose: () => void;
}

export interface TownActivitySnapshot {
  craneRotation: number;
  cargoHeight: number;
  plantGrowth: number;
  lampIntensity: number;
}

const material = (color: string, roughness = 0.82, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness });

const box = (
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  meshMaterial: MeshStandardMaterial,
): Mesh => {
  const mesh = new Mesh(new BoxGeometry(...size), meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
};

const markShadow = (object: Object3D, enabled: boolean): void => {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = enabled;
    child.receiveShadow = enabled;
  });
};

function addRoad(
  parent: Group,
  name: string,
  size: readonly [number, number],
  position: TownVec2,
  roadMaterial: MeshStandardMaterial,
  sidewalkMaterial: MeshStandardMaterial,
  alongX: boolean,
): void {
  const sidewalk = box(
    `${name}-sidewalk`,
    [size[0] + 1.4, 0.13, size[1] + 1.4],
    [position[0], 0.075, position[1]],
    sidewalkMaterial,
  );
  const road = box(name, [size[0], 0.14, size[1]], [position[0], 0.15, position[1]], roadMaterial);
  parent.add(sidewalk, road);

  const dashMaterial = material('#d8d2b2', 0.64);
  const length = alongX ? size[0] : size[1];
  const count = Math.max(2, Math.floor(length / 3));
  for (let index = 0; index < count; index += 1) {
    const offset = -length * 0.5 + 1.2 + index * 3;
    const dash = box(
      `${name}-lane-mark-${index}`,
      alongX ? [1.15, 0.02, 0.09] : [0.09, 0.02, 1.15],
      [position[0] + (alongX ? offset : 0), 0.232, position[1] + (alongX ? 0 : offset)],
      dashMaterial,
    );
    parent.add(dash);
  }
}

function addBuilding(
  parent: Group,
  colliders: TownCollider[],
  options: {
    name: string;
    position: TownVec2;
    size: readonly [number, number, number];
    wall: string;
    roof: string;
    heading?: number;
  },
): Group {
  const building = new Group();
  building.name = options.name;
  building.userData.buildingId = options.name;
  building.position.set(options.position[0], 0, options.position[1]);
  building.rotation.y = options.heading ?? 0;
  const body = box(
    `${options.name}-walls`,
    options.size,
    [0, options.size[1] * 0.5 + 0.18, 0],
    material(options.wall, 0.78),
  );
  const roof = new Mesh(
    new ConeGeometry(Math.max(options.size[0], options.size[2]) * 0.72, 1.45, 4),
    material(options.roof, 0.7),
  );
  roof.name = `${options.name}-roof`;
  roof.position.y = options.size[1] + 0.9;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = options.size[2] / options.size[0];
  const door = box(
    `${options.name}-door`,
    [0.82, 1.55, 0.12],
    [0, 0.96, options.size[2] * 0.5 + 0.07],
    material('#59453a', 0.74),
  );
  const glass = new MeshStandardMaterial({
    color: '#8db5bd',
    emissive: '#31576a',
    emissiveIntensity: 0.08,
    roughness: 0.18,
    metalness: 0.06,
  });
  for (const x of [-options.size[0] * 0.27, options.size[0] * 0.27]) {
    const window = box(
      `${options.name}-window`,
      [0.72, 0.76, 0.1],
      [x, 1.82, options.size[2] * 0.5 + 0.075],
      glass,
    );
    const sill = box(
      `${options.name}-window-sill`,
      [0.9, 0.1, 0.2],
      [x, 1.4, options.size[2] * 0.5 + 0.11],
      material('#e3d3ae', 0.86),
    );
    building.add(window, sill);
  }
  building.add(body, roof, door);
  parent.add(building);
  colliders.push({
    id: options.name,
    center: options.position,
    halfSize: [options.size[0] * 0.5, options.size[2] * 0.5],
    height: options.size[1],
    vaultable: false,
  });
  return building;
}

function addTree(
  parent: Group,
  colliders: TownCollider[],
  position: TownVec2,
  index: number,
): void {
  const tree = new Group();
  tree.name = `town-tree-${index}`;
  tree.position.set(position[0], 0.2, position[1]);
  const trunk = new Mesh(new CylinderGeometry(0.2, 0.28, 1.65, 8), material('#70513a', 0.94));
  trunk.position.y = 0.82;
  const crownMaterial = material(index % 2 === 0 ? '#6c9364' : '#789b62', 0.9);
  const lower = new Mesh(new ConeGeometry(1.05, 2.15, 8), crownMaterial);
  lower.position.y = 2.05;
  const upper = new Mesh(new ConeGeometry(0.72, 1.55, 8), crownMaterial);
  upper.position.y = 3.05;
  tree.add(trunk, lower, upper);
  parent.add(tree);
  colliders.push({
    id: tree.name,
    center: position,
    halfSize: [0.34, 0.34],
    height: 2.8,
    vaultable: false,
  });
}

function addStreetLamp(
  parent: Group,
  colliders: TownCollider[],
  name: string,
  position: TownVec2,
  lampMetal: MeshStandardMaterial,
  lampGlow: MeshStandardMaterial,
): void {
  const lamp = new Group();
  lamp.name = name;
  lamp.position.set(position[0], 0.2, position[1]);
  const post = new Mesh(new CylinderGeometry(0.07, 0.1, 2.6, 8), lampMetal);
  post.position.y = 1.3;
  const glow = new Mesh(new CylinderGeometry(0.2, 0.16, 0.34, 8), lampGlow);
  glow.position.y = 2.48;
  const cap = new Mesh(new ConeGeometry(0.3, 0.22, 8), lampMetal);
  cap.position.y = 2.78;
  lamp.add(post, glow, cap);
  parent.add(lamp);
  colliders.push({
    id: name,
    center: position,
    halfSize: [0.18, 0.18],
    height: 2.9,
    vaultable: false,
  });
}

function addBench(
  parent: Group,
  colliders: TownCollider[],
  name: string,
  position: TownVec2,
): void {
  const bench = new Group();
  bench.name = name;
  bench.position.set(position[0], 0.2, position[1]);
  const timber = material('#846248', 0.86);
  const metal = material('#3f4b48', 0.52, 0.35);
  bench.add(
    box(`${name}-seat`, [0.58, 0.12, 1.8], [0, 0.48, 0], timber),
    box(`${name}-back`, [0.12, 0.72, 1.8], [-0.24, 0.8, 0], timber),
    box(`${name}-leg-a`, [0.38, 0.45, 0.1], [0, 0.23, -0.58], metal),
    box(`${name}-leg-b`, [0.38, 0.45, 0.1], [0, 0.23, 0.58], metal),
  );
  parent.add(bench);
  colliders.push({
    id: name,
    center: position,
    halfSize: [0.34, 0.96],
    height: 0.92,
    vaultable: false,
  });
}

function addCrosswalk(parent: Group, position: TownVec2, alongX: boolean): void {
  const stripeMaterial = material('#ded9c7', 0.72);
  for (let index = -2; index <= 2; index += 1) {
    const stripe = box(
      `crosswalk-stripe-${position[0]}-${position[1]}-${index}`,
      alongX ? [0.34, 0.025, 2.5] : [2.5, 0.025, 0.34],
      [position[0] + (alongX ? index * 0.56 : 0), 0.245, position[1] + (alongX ? 0 : index * 0.56)],
      stripeMaterial,
    );
    parent.add(stripe);
  }
}

export function createGroundTown(): GroundTownAssembly {
  const root = new Group();
  root.name = 'ground-town';
  root.userData.cameraView = 'overview';
  root.userData.layoutScale = TOWN_LAYOUT_SCALE;
  root.userData.districtCount = 7;
  root.userData.districtNames =
    'central|west-harbor|east-residential|south-riverside|north-old-town|northeast-hillside|southeast-garden';
  root.scale.set(TOWN_LAYOUT_SCALE, 1, TOWN_LAYOUT_SCALE);
  const colliders: TownCollider[] = [];
  const grassMaterial = material('#6c885f', 0.94);
  const soilMaterial = material('#4a4438', 0.96);
  const roadMaterial = material('#39464a', 0.74, 0.04);
  const sidewalkMaterial = material('#9c9b88', 0.9);

  const ground = box('town-ground', [148, 1, 132], [0, -0.35, 2], grassMaterial);
  const underlayer = box('town-earth-layer', [149, 1.8, 133], [0, -1.72, 2], soilMaterial);
  root.add(underlayer, ground);

  const roadLoop = new Group();
  roadLoop.name = 'main-road-loop';
  addRoad(roadLoop, 'north-road', [24, 4.6], [0, -8], roadMaterial, sidewalkMaterial, true);
  addRoad(roadLoop, 'south-road', [24, 4.6], [0, 8], roadMaterial, sidewalkMaterial, true);
  addRoad(roadLoop, 'west-road', [4.6, 20.6], [-12, 0], roadMaterial, sidewalkMaterial, false);
  addRoad(roadLoop, 'east-road', [4.6, 20.6], [12, 0], roadMaterial, sidewalkMaterial, false);
  addRoad(roadLoop, 'harbor-road', [13, 4.6], [-20.2, 0], roadMaterial, sidewalkMaterial, true);
  addRoad(roadLoop, 'garden-road', [13, 4.6], [20.2, 0], roadMaterial, sidewalkMaterial, true);
  root.add(roadLoop);

  const eastDistrictRoadLoop = new Group();
  eastDistrictRoadLoop.name = 'east-district-road-loop';
  addRoad(
    eastDistrictRoadLoop,
    'east-district-connector-road',
    [16, 4.2],
    [29, 0],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    eastDistrictRoadLoop,
    'east-district-west-road',
    [4.2, 31],
    [34, 0],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    eastDistrictRoadLoop,
    'east-district-east-road',
    [4.2, 31],
    [46, 0],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    eastDistrictRoadLoop,
    'east-district-north-road',
    [16, 4.2],
    [40, -13.5],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    eastDistrictRoadLoop,
    'east-district-south-road',
    [16, 4.2],
    [40, 13.5],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  root.add(eastDistrictRoadLoop);

  const southRiversideRoadLoop = new Group();
  southRiversideRoadLoop.name = 'south-riverside-road-loop';
  addRoad(
    southRiversideRoadLoop,
    'south-riverside-connector-road',
    [4.2, 29],
    [0, 21.5],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    southRiversideRoadLoop,
    'south-riverside-north-road',
    [28, 4.2],
    [0, 35],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    southRiversideRoadLoop,
    'south-riverside-south-road',
    [28, 4.2],
    [0, 51],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    southRiversideRoadLoop,
    'south-riverside-west-road',
    [4.2, 20],
    [-12, 43],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    southRiversideRoadLoop,
    'south-riverside-east-road',
    [4.2, 20],
    [12, 43],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  root.add(southRiversideRoadLoop);

  const westCoastRoadLoop = new Group();
  westCoastRoadLoop.name = 'west-coast-road-loop';
  addRoad(
    westCoastRoadLoop,
    'west-coast-connector-road',
    [14.5, 4.6],
    [-32, 0],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    westCoastRoadLoop,
    'west-coast-east-road',
    [4.6, 31],
    [-38, 0],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    westCoastRoadLoop,
    'west-coast-west-road',
    [4.6, 31],
    [-50, 0],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    westCoastRoadLoop,
    'west-coast-north-road',
    [16, 4.6],
    [-44, -13.5],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    westCoastRoadLoop,
    'west-coast-south-road',
    [16, 4.6],
    [-44, 13.5],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  root.add(westCoastRoadLoop);

  const northOldTownRoadLoop = new Group();
  northOldTownRoadLoop.name = 'north-old-town-road-loop';
  addRoad(
    northOldTownRoadLoop,
    'north-old-town-connector-road',
    [4.6, 30],
    [0, -23],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northOldTownRoadLoop,
    'north-old-town-west-road',
    [4.6, 22],
    [-12, -47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northOldTownRoadLoop,
    'north-old-town-east-road',
    [4.6, 22],
    [12, -47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northOldTownRoadLoop,
    'north-old-town-north-road',
    [28, 4.6],
    [0, -56],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    northOldTownRoadLoop,
    'north-old-town-south-road',
    [28, 4.6],
    [0, -38],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  root.add(northOldTownRoadLoop);

  const northeastHillsideRoadLoop = new Group();
  northeastHillsideRoadLoop.name = 'northeast-hillside-road-loop';
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-south-connector-road',
    [4.6, 26],
    [40, -26],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-west-connector-road',
    [34, 4.6],
    [27, -47],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-west-road',
    [4.6, 22],
    [42, -47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-east-road',
    [4.6, 22],
    [58, -47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-north-road',
    [20.5, 4.6],
    [50, -56],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    northeastHillsideRoadLoop,
    'northeast-hillside-south-road',
    [20.5, 4.6],
    [50, -38],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  root.add(northeastHillsideRoadLoop);

  const southeastGardenRoadLoop = new Group();
  southeastGardenRoadLoop.name = 'southeast-garden-road-loop';
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-north-connector-road',
    [4.6, 27],
    [40, 27],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-west-connector-road',
    [30, 4.6],
    [27, 47],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-west-road',
    [4.6, 22],
    [42, 47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-east-road',
    [4.6, 22],
    [58, 47],
    roadMaterial,
    sidewalkMaterial,
    false,
  );
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-north-road',
    [20.5, 4.6],
    [50, 38],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  addRoad(
    southeastGardenRoadLoop,
    'southeast-garden-south-road',
    [20.5, 4.6],
    [50, 56],
    roadMaterial,
    sidewalkMaterial,
    true,
  );
  root.add(southeastGardenRoadLoop);

  const plazaShape = new Shape();
  plazaShape.moveTo(-6, -5.2);
  plazaShape.lineTo(6, -5.2);
  plazaShape.lineTo(6, 5.2);
  plazaShape.lineTo(-6, 5.2);
  plazaShape.closePath();
  const plaza = new Mesh(new ShapeGeometry(plazaShape), material('#b5ad91', 0.88));
  plaza.name = 'town-square';
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.19;
  root.add(plaza);

  addCrosswalk(root, [-12, -4.8], true);
  addCrosswalk(root, [12, 4.8], true);
  addCrosswalk(root, [-5.2, 8], false);
  addCrosswalk(root, [5.2, -8], false);
  addCrosswalk(root, [34, 4.8], true);
  addCrosswalk(root, [40, -13.5], false);
  addCrosswalk(root, [40, 13.5], false);
  addCrosswalk(root, [0, 35], false);
  addCrosswalk(root, [-12, 43], true);
  addCrosswalk(root, [12, 43], true);
  addCrosswalk(root, [0, 51], false);
  addCrosswalk(root, [-38, 4.8], true);
  addCrosswalk(root, [-44, -13.5], false);
  addCrosswalk(root, [-44, 13.5], false);
  addCrosswalk(root, [-50, 0], true);
  addCrosswalk(root, [0, -38], false);
  addCrosswalk(root, [-12, -47], true);
  addCrosswalk(root, [12, -47], true);
  addCrosswalk(root, [42, -47], true);
  addCrosswalk(root, [50, -38], false);
  addCrosswalk(root, [42, 47], true);
  addCrosswalk(root, [50, 38], false);

  addBuilding(root, colliders, {
    name: 'town-hall',
    position: [-5, -14.1],
    size: [6.2, 4.5, 4.2],
    wall: '#c8a776',
    roof: '#6e4f48',
  });
  addBuilding(root, colliders, {
    name: 'residence-blue',
    position: [5.5, -14.3],
    size: [5.2, 3.6, 4],
    wall: '#809ca2',
    roof: '#4f676c',
  });
  addBuilding(root, colliders, {
    name: 'bakery',
    position: [-5.2, 14.2],
    size: [5.6, 3.4, 4],
    wall: '#c58f78',
    roof: '#704f43',
  });
  addBuilding(root, colliders, {
    name: 'residence-sage',
    position: [5.5, 14.2],
    size: [5, 3.7, 4],
    wall: '#8ca27d',
    roof: '#53644c',
  });
  addBuilding(root, colliders, {
    name: 'harbor-workshop',
    position: [-21.2, -6.2],
    size: [8, 4.2, 5.2],
    wall: '#8d7b67',
    roof: '#4b565b',
  });
  addBuilding(root, colliders, {
    name: 'northwest-cottages',
    position: [-17.5, -15.4],
    size: [6.4, 3.7, 4.4],
    wall: '#a6816d',
    roof: '#5e4945',
  });
  addBuilding(root, colliders, {
    name: 'northeast-market',
    position: [17.2, -15.2],
    size: [6.8, 4.1, 4.6],
    wall: '#b7986b',
    roof: '#536268',
  });
  addBuilding(root, colliders, {
    name: 'southwest-inn',
    position: [-17.4, 15.2],
    size: [6.6, 4.3, 4.5],
    wall: '#9d7771',
    roof: '#664943',
  });
  addBuilding(root, colliders, {
    name: 'southeast-studio',
    position: [16.8, 15.4],
    size: [6.2, 3.8, 4.3],
    wall: '#819e91',
    roof: '#4d6158',
  });
  addBuilding(root, colliders, {
    name: 'east-district-cafe',
    position: [36, -21],
    size: [6.2, 3.8, 4.2],
    wall: '#c78d70',
    roof: '#6b4543',
  });
  addBuilding(root, colliders, {
    name: 'east-district-library',
    position: [44, -21],
    size: [6.4, 4.4, 4.4],
    wall: '#b9a274',
    roof: '#4e6266',
  });
  addBuilding(root, colliders, {
    name: 'east-district-clinic',
    position: [36, 21],
    size: [6, 3.9, 4.2],
    wall: '#88aaa1',
    roof: '#4f6963',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'east-district-residence',
    position: [44, 21],
    size: [6, 3.8, 4.2],
    wall: '#9b8eaa',
    roof: '#5d5368',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'south-riverside-workshop',
    position: [-6, 29],
    size: [6.4, 4, 4.2],
    wall: '#8da19a',
    roof: '#4a5d5d',
  });
  addBuilding(root, colliders, {
    name: 'south-riverside-market',
    position: [6, 29],
    size: [6.2, 3.8, 4.2],
    wall: '#c1966f',
    roof: '#6f5046',
  });
  addBuilding(root, colliders, {
    name: 'south-riverside-station',
    position: [-6, 57],
    size: [6.8, 4.2, 4.4],
    wall: '#a58d78',
    roof: '#53636b',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'south-riverside-residence',
    position: [6, 57],
    size: [6.2, 3.9, 4.2],
    wall: '#8799ae',
    roof: '#535c70',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'west-coast-ferry-terminal',
    position: [-48, -21],
    size: [6.8, 4.3, 4.5],
    wall: '#829aa1',
    roof: '#465d66',
  });
  addBuilding(root, colliders, {
    name: 'west-coast-fish-market',
    position: [-40, -21],
    size: [6.2, 3.8, 4.2],
    wall: '#c39672',
    roof: '#6c4e43',
  });
  addBuilding(root, colliders, {
    name: 'west-coast-boathouse',
    position: [-48, 21],
    size: [6.6, 4, 4.4],
    wall: '#8ca19a',
    roof: '#4a6160',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'west-coast-residence',
    position: [-40, 21],
    size: [6.1, 3.9, 4.2],
    wall: '#9b8ca7',
    roof: '#5c5268',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'north-old-town-teahouse',
    position: [-7, -61],
    size: [7.2, 3.8, 4.4],
    wall: '#b79b78',
    roof: '#634d48',
  });
  addBuilding(root, colliders, {
    name: 'north-old-town-apartments',
    position: [7, -61],
    size: [7.4, 4.8, 4.6],
    wall: '#8f9b9c',
    roof: '#4d5d63',
  });
  addBuilding(root, colliders, {
    name: 'north-old-town-bookshop',
    position: [-7, -33],
    size: [6.8, 3.7, 4.2],
    wall: '#a98677',
    roof: '#604942',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'north-old-town-residence',
    position: [7, -33],
    size: [6.8, 4.1, 4.2],
    wall: '#829a88',
    roof: '#4d6254',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'northeast-hillside-observatory',
    position: [46, -61],
    size: [7.2, 5.2, 4.6],
    wall: '#8b9ca8',
    roof: '#4a5967',
  });
  addBuilding(root, colliders, {
    name: 'northeast-hillside-school',
    position: [57, -61],
    size: [8.2, 4.6, 4.8],
    wall: '#c1a574',
    roof: '#62504a',
  });
  addBuilding(root, colliders, {
    name: 'northeast-hillside-clinic',
    position: [46, -33],
    size: [7.2, 4.1, 4.4],
    wall: '#86aaa5',
    roof: '#496861',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'northeast-hillside-civic-hall',
    position: [57, -33],
    size: [8, 5, 4.8],
    wall: '#aaa080',
    roof: '#545d61',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'southeast-garden-nursery',
    position: [46, 33],
    size: [7, 3.8, 4.2],
    wall: '#8fa780',
    roof: '#50664d',
  });
  addBuilding(root, colliders, {
    name: 'southeast-garden-cafe',
    position: [57, 33],
    size: [7, 4, 4.2],
    wall: '#c58f77',
    roof: '#6b4b43',
  });
  addBuilding(root, colliders, {
    name: 'southeast-garden-workshop',
    position: [46, 61],
    size: [7.2, 4.2, 4.4],
    wall: '#899c96',
    roof: '#4d5f5e',
    heading: Math.PI,
  });
  addBuilding(root, colliders, {
    name: 'southeast-garden-residence',
    position: [57, 61],
    size: [7.2, 4.2, 4.4],
    wall: '#9d8eaa',
    roof: '#5d5268',
    heading: Math.PI,
  });

  const greenhouse = new Group();
  greenhouse.name = 'garden-greenhouse';
  greenhouse.position.set(21, 0, 7.5);
  const greenhouseGlass = new MeshStandardMaterial({
    color: '#a5d5c9',
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.52,
    side: DoubleSide,
  });
  const greenhouseBody = box('greenhouse-glass', [8, 3.6, 5.6], [0, 2, 0], greenhouseGlass);
  const greenhouseRoof = new Mesh(new ConeGeometry(4.15, 2.3, 4), greenhouseGlass);
  greenhouseRoof.name = 'greenhouse-roof';
  greenhouseRoof.position.y = 4.35;
  greenhouseRoof.rotation.y = Math.PI / 4;
  greenhouseRoof.scale.z = 0.7;
  const greenhouseCrops = new Group();
  greenhouseCrops.name = 'greenhouse-crops';
  const cropSoil = material('#594532', 0.96);
  const cropLeaf = material('#6e9d58', 0.9);
  for (const x of [-2.5, 0, 2.5]) {
    greenhouseCrops.add(box('greenhouse-crop-bed', [1.3, 0.32, 4.4], [x, 0.42, 0], cropSoil));
    for (const z of [-1.65, -0.55, 0.55, 1.65]) {
      const crop = new Group();
      crop.name = 'greenhouse-crop';
      crop.position.set(x, 0.58, z);
      const stem = new Mesh(new CylinderGeometry(0.035, 0.055, 0.66, 6), cropLeaf);
      stem.position.y = 0.33;
      const crown = new Mesh(new ConeGeometry(0.28, 0.62, 7), cropLeaf);
      crown.position.y = 0.78;
      crop.add(stem, crown);
      greenhouseCrops.add(crop);
    }
  }
  greenhouse.add(greenhouseBody, greenhouseRoof, greenhouseCrops);
  for (const x of [-3.8, 0, 3.8]) {
    greenhouse.add(
      box('greenhouse-frame', [0.12, 4.4, 5.9], [x, 2.2, 0], material('#526d67', 0.45, 0.25)),
    );
  }
  root.add(greenhouse);
  colliders.push({
    id: 'garden-greenhouse',
    center: [21, 7.5],
    halfSize: [4, 2.8],
    height: 4.6,
    vaultable: false,
  });

  const harborCrane = new Group();
  harborCrane.name = 'harbor-crane';
  harborCrane.position.set(-24, 0.15, 8.1);
  const craneMetal = material('#d29a4f', 0.48, 0.48);
  const craneDark = material('#3f4b4e', 0.58, 0.42);
  const craneBase = new Mesh(new CylinderGeometry(0.86, 1.08, 0.55, 12), craneDark);
  craneBase.position.y = 0.28;
  const craneMast = new Mesh(new CylinderGeometry(0.24, 0.38, 5.5, 10), craneMetal);
  craneMast.position.y = 3.05;
  const craneBoom = new Group();
  craneBoom.name = 'harbor-crane-boom';
  craneBoom.position.y = 5.52;
  const boomBeam = box('harbor-crane-beam', [0.38, 0.38, 6.6], [0, 0, 1.9], craneMetal);
  const counterweight = box(
    'harbor-crane-counterweight',
    [1.15, 0.72, 1.25],
    [0, -0.08, -1.55],
    craneDark,
  );
  const craneCargo = new Group();
  craneCargo.name = 'harbor-crane-cargo';
  craneCargo.position.set(0, -2.3, 4.35);
  const cable = new Mesh(new CylinderGeometry(0.025, 0.025, 2.2, 6), craneDark);
  cable.position.y = 1.1;
  const cargo = box(
    'harbor-crane-crate',
    [1.4, 0.95, 1.3],
    [0, -0.48, 0],
    material('#8e6545', 0.9),
  );
  craneCargo.add(cable, cargo);
  craneBoom.add(boomBeam, counterweight, craneCargo);
  harborCrane.add(craneBase, craneMast, craneBoom);
  root.add(harborCrane);
  colliders.push({
    id: 'harbor-crane',
    center: [-24, 8.1],
    halfSize: [1.1, 1.1],
    height: 5.8,
    vaultable: false,
  });

  const planterMaterial = material('#8f7155', 0.92);
  const planterPositions: TownVec2[] = [
    [-3.6, -3.7],
    [3.6, -3.7],
    [-3.6, 3.7],
    [3.6, 3.7],
  ];
  for (const [index, position] of planterPositions.entries()) {
    const planter = box(
      `square-planter-${index}`,
      [2.1, 0.65, 0.75],
      [position[0], 0.52, position[1]],
      planterMaterial,
    );
    root.add(planter);
    for (let plantIndex = -1; plantIndex <= 1; plantIndex += 1) {
      const shrub = new Mesh(
        new ConeGeometry(0.22, 0.58 + Math.abs(plantIndex) * 0.08, 7),
        material(plantIndex === 0 ? '#789958' : '#8aa36a', 0.9),
      );
      shrub.name = `square-planter-${index}-plant-${plantIndex}`;
      shrub.position.set(position[0] + plantIndex * 0.54, 1.08, position[1]);
      root.add(shrub);
    }
    colliders.push({
      id: planter.name,
      center: position,
      halfSize: [1.05, 0.38],
      height: 0.65,
      vaultable: true,
    });
  }

  const fountain = new Group();
  fountain.name = 'town-fountain';
  const fountainStone = material('#87908b', 0.7, 0.04);
  const basin = new Mesh(new CylinderGeometry(1.65, 1.78, 0.42, 24), fountainStone);
  basin.position.y = 0.42;
  const water = new Mesh(
    new CylinderGeometry(1.38, 1.38, 0.08, 24),
    new MeshStandardMaterial({
      color: '#79acb7',
      emissive: '#315d69',
      emissiveIntensity: 0.08,
      roughness: 0.2,
      metalness: 0.16,
      transparent: true,
      opacity: 0.78,
    }),
  );
  water.position.y = 0.66;
  const column = new Mesh(new CylinderGeometry(0.28, 0.38, 1.55, 12), fountainStone);
  column.position.y = 1.08;
  const bowl = new Mesh(new CylinderGeometry(0.74, 0.48, 0.25, 18), fountainStone);
  bowl.position.y = 1.77;
  fountain.add(basin, water, column, bowl);
  root.add(fountain);
  colliders.push({
    id: 'town-fountain',
    center: [0, 0],
    halfSize: [1.75, 1.75],
    height: 1.9,
    vaultable: false,
  });

  const eastDistrictSquare = box(
    'east-district-square',
    [6.2, 0.1, 11],
    [40, 0.2, 0],
    material('#b8ae90', 0.88),
  );
  root.add(eastDistrictSquare);
  const eastPlanterPositions: TownVec2[] = [
    [38.3, -4.1],
    [41.7, -4.1],
    [38.3, 4.1],
    [41.7, 4.1],
  ];
  eastPlanterPositions.forEach((position, index) => {
    const name = `east-district-planter-${index}`;
    root.add(box(name, [1.35, 0.55, 0.65], [position[0], 0.5, position[1]], planterMaterial));
    for (const offset of [-0.36, 0, 0.36]) {
      const flower = new Mesh(
        new ConeGeometry(0.16, 0.42, 7),
        material(index % 2 === 0 ? '#769760' : '#8b9e66', 0.9),
      );
      flower.name = `${name}-plant`;
      flower.position.set(position[0] + offset, 0.98, position[1]);
      root.add(flower);
    }
    colliders.push({
      id: name,
      center: position,
      halfSize: [0.68, 0.33],
      height: 0.55,
      vaultable: true,
    });
  });
  addBench(root, colliders, 'east-district-bench-0', [38, 0]);
  addBench(root, colliders, 'east-district-bench-1', [42, 0]);

  const southRiversideSquare = box(
    'south-riverside-square',
    [16, 0.1, 10],
    [0, 0.2, 43],
    material('#b9ad91', 0.88),
  );
  root.add(southRiversideSquare);
  const riversidePond = new Mesh(
    new CylinderGeometry(2.15, 2.3, 0.22, 24),
    new MeshStandardMaterial({
      color: '#6e9fa9',
      emissive: '#2d555f',
      emissiveIntensity: 0.08,
      roughness: 0.24,
      metalness: 0.12,
    }),
  );
  riversidePond.name = 'south-riverside-pond';
  riversidePond.position.set(0, 0.36, 43);
  root.add(riversidePond);
  colliders.push({
    id: riversidePond.name,
    center: [0, 43],
    halfSize: [2.3, 2.3],
    height: 0.48,
    vaultable: false,
  });
  const riversidePlanters: TownVec2[] = [
    [-5.8, 39.5],
    [5.8, 39.5],
    [-5.8, 46.5],
    [5.8, 46.5],
  ];
  riversidePlanters.forEach((position, index) => {
    const name = `south-riverside-planter-${index}`;
    root.add(box(name, [1.7, 0.58, 0.72], [position[0], 0.5, position[1]], planterMaterial));
    for (const offset of [-0.42, 0, 0.42]) {
      const plant = new Mesh(
        new ConeGeometry(0.18, 0.48, 7),
        material(index % 2 === 0 ? '#799660' : '#8c9d65', 0.9),
      );
      plant.name = `${name}-plant`;
      plant.position.set(position[0] + offset, 0.99, position[1]);
      root.add(plant);
    }
    colliders.push({
      id: name,
      center: position,
      halfSize: [0.86, 0.37],
      height: 0.58,
      vaultable: true,
    });
  });
  addBench(root, colliders, 'south-riverside-bench-0', [-5.3, 43]);
  addBench(root, colliders, 'south-riverside-bench-1', [5.3, 43]);

  const westCoastSquare = box(
    'west-coast-square',
    [6.2, 0.1, 11],
    [-44, 0.2, 0],
    material('#b4aa8e', 0.88),
  );
  root.add(westCoastSquare);
  const westCoastPlanters: TownVec2[] = [
    [-45.7, -4.1],
    [-42.3, -4.1],
    [-45.7, 4.1],
    [-42.3, 4.1],
  ];
  westCoastPlanters.forEach((position, index) => {
    const name = `west-coast-planter-${index}`;
    root.add(box(name, [1.35, 0.55, 0.65], [position[0], 0.5, position[1]], planterMaterial));
    for (const offset of [-0.36, 0, 0.36]) {
      const shrub = new Mesh(
        new ConeGeometry(0.16, 0.44, 7),
        material(index % 2 === 0 ? '#6f9168' : '#86a276', 0.9),
      );
      shrub.name = `${name}-plant`;
      shrub.position.set(position[0] + offset, 0.99, position[1]);
      root.add(shrub);
    }
    colliders.push({
      id: name,
      center: position,
      halfSize: [0.68, 0.33],
      height: 0.55,
      vaultable: true,
    });
  });
  addBench(root, colliders, 'west-coast-bench-0', [-46, 0]);
  addBench(root, colliders, 'west-coast-bench-1', [-42, 0]);

  const expansionSquares = [
    { name: 'north-old-town-square', position: [0, -47] as TownVec2, color: '#b4aa8f' },
    {
      name: 'northeast-hillside-square',
      position: [50, -47] as TownVec2,
      color: '#a9aa98',
    },
    {
      name: 'southeast-garden-square',
      position: [50, 47] as TownVec2,
      color: '#b8ad8f',
    },
  ] as const;
  expansionSquares.forEach((square, squareIndex) => {
    root.add(
      box(
        square.name,
        [11, 0.1, 10],
        [square.position[0], 0.2, square.position[1]],
        material(square.color, 0.88),
      ),
    );
    for (const [planterIndex, offset] of [
      [-3.8, -3.2],
      [3.8, -3.2],
      [-3.8, 3.2],
      [3.8, 3.2],
    ].entries()) {
      const position: TownVec2 = [square.position[0] + offset[0], square.position[1] + offset[1]];
      const name = `${square.name}-planter-${planterIndex}`;
      root.add(box(name, [1.5, 0.58, 0.72], [position[0], 0.5, position[1]], planterMaterial));
      const shrub = new Mesh(
        new ConeGeometry(0.35, 0.82, 8),
        material(squareIndex === 2 ? '#789b62' : '#718f67', 0.9),
      );
      shrub.name = `${name}-shrub`;
      shrub.position.set(position[0], 1.08, position[1]);
      root.add(shrub);
      colliders.push({
        id: name,
        center: position,
        halfSize: [0.75, 0.36],
        height: 0.58,
        vaultable: true,
      });
    }
    addBench(root, colliders, `${square.name}-bench-west`, [
      square.position[0] - 3.2,
      square.position[1],
    ]);
    addBench(root, colliders, `${square.name}-bench-east`, [
      square.position[0] + 3.2,
      square.position[1],
    ]);
  });

  const oldTownClock = new Group();
  oldTownClock.name = 'north-old-town-clock';
  oldTownClock.position.set(0, 0.2, -47);
  const clockStone = material('#7f8177', 0.78);
  oldTownClock.add(
    box('north-old-town-clock-column', [0.9, 3.4, 0.9], [0, 1.7, 0], clockStone),
    new Mesh(new ConeGeometry(0.9, 1.1, 4), material('#6b5149', 0.72)),
  );
  const clockRoof = oldTownClock.children[1];
  if (clockRoof) clockRoof.position.y = 3.9;
  root.add(oldTownClock);
  colliders.push({
    id: oldTownClock.name,
    center: [0, -47],
    halfSize: [0.55, 0.55],
    height: 4.5,
    vaultable: false,
  });

  const lighthouse = new Group();
  lighthouse.name = 'west-coast-lighthouse';
  lighthouse.position.set(-56, 0.15, 0);
  const lighthouseStone = material('#e1d8bb', 0.76);
  const lighthouseAccent = material('#b65f52', 0.62);
  const lighthouseTower = new Mesh(new CylinderGeometry(0.78, 1.15, 5.7, 16), lighthouseStone);
  lighthouseTower.position.y = 2.85;
  const lighthouseBand = new Mesh(new CylinderGeometry(0.83, 0.9, 0.72, 16), lighthouseAccent);
  lighthouseBand.position.y = 3.4;
  const lighthouseLamp = new Mesh(
    new CylinderGeometry(0.68, 0.68, 0.82, 14),
    new MeshStandardMaterial({
      color: '#f6d78f',
      emissive: '#eca943',
      emissiveIntensity: 0.72,
      roughness: 0.24,
      transparent: true,
      opacity: 0.82,
    }),
  );
  lighthouseLamp.position.y = 6.04;
  const lighthouseRoof = new Mesh(new ConeGeometry(1.02, 0.82, 16), lighthouseAccent);
  lighthouseRoof.position.y = 6.86;
  lighthouse.add(lighthouseTower, lighthouseBand, lighthouseLamp, lighthouseRoof);
  root.add(lighthouse);
  colliders.push({
    id: lighthouse.name,
    center: [-56, 0],
    halfSize: [1.15, 1.15],
    height: 7.3,
    vaultable: false,
  });

  const lampMetal = material('#364440', 0.44, 0.48);
  const lampGlow = new MeshStandardMaterial({
    color: '#ffd992',
    emissive: '#f3a848',
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });
  const lampPositions: TownVec2[] = [
    [-7.2, -6.2],
    [7.2, -6.2],
    [-7.2, 6.2],
    [7.2, 6.2],
  ];
  lampPositions.forEach((position, index) => {
    addStreetLamp(root, colliders, `town-lamp-${index}`, position, lampMetal, lampGlow);
  });
  const eastLampPositions: TownVec2[] = [
    [31.4, -17.2],
    [48.6, -17.2],
    [31.4, 17.2],
    [48.6, 17.2],
  ];
  eastLampPositions.forEach((position, index) => {
    addStreetLamp(root, colliders, `east-district-lamp-${index}`, position, lampMetal, lampGlow);
  });
  const southRiversideLampPositions: TownVec2[] = [
    [-14.3, 33],
    [14.3, 33],
    [-14.3, 53],
    [14.3, 53],
  ];
  southRiversideLampPositions.forEach((position, index) => {
    addStreetLamp(root, colliders, `south-riverside-lamp-${index}`, position, lampMetal, lampGlow);
  });
  const westCoastLampPositions: TownVec2[] = [
    [-52.6, -17.2],
    [-35.4, -17.2],
    [-52.6, 17.2],
    [-35.4, 17.2],
  ];
  westCoastLampPositions.forEach((position, index) => {
    addStreetLamp(root, colliders, `west-coast-lamp-${index}`, position, lampMetal, lampGlow);
  });
  const expansionLampPositions: Array<{ district: string; position: TownVec2 }> = [
    { district: 'north-old-town', position: [-15, -35] },
    { district: 'north-old-town', position: [15, -35] },
    { district: 'north-old-town', position: [-15, -59] },
    { district: 'north-old-town', position: [15, -59] },
    { district: 'northeast-hillside', position: [39, -59] },
    { district: 'northeast-hillside', position: [61, -59] },
    { district: 'northeast-hillside', position: [39, -35] },
    { district: 'northeast-hillside', position: [61, -35] },
    { district: 'southeast-garden', position: [39, 35] },
    { district: 'southeast-garden', position: [61, 35] },
    { district: 'southeast-garden', position: [39, 59] },
    { district: 'southeast-garden', position: [61, 59] },
  ];
  expansionLampPositions.forEach(({ district, position }, index) => {
    addStreetLamp(root, colliders, `${district}-lamp-${index}`, position, lampMetal, lampGlow);
  });

  const treePositions: TownVec2[] = [
    [-24.5, -15.8],
    [-12.5, -18],
    [12.8, -18],
    [24.2, -14.2],
    [-24, 14.8],
    [-12.2, 18],
    [12.4, 18],
    [24, 15.4],
    [29.2, -23.8],
    [51.4, -22.5],
    [29.4, 23.4],
    [51.6, 22.8],
    [56.2, -9.2],
    [56.5, 8.8],
    [-24.5, 32.2],
    [23.8, 32.4],
    [-24.2, 54.5],
    [23.8, 54.2],
    [-57, -22.8],
    [-32.2, -22.5],
    [-57.2, 22.7],
    [-32.4, 22.9],
    [-55.8, -10],
    [-55.8, 10],
    [-22, -35],
    [22, -35],
    [-22, -58],
    [22, -58],
    [34, -58],
    [66, -58],
    [34, -35],
    [66, -35],
    [34, 35],
    [66, 35],
    [34, 59],
    [66, 59],
  ];
  treePositions.forEach((position, index) => {
    addTree(root, colliders, position, index);
  });

  const boundary = new Group();
  boundary.name = 'cliff-boundary';
  const cliffMaterial = material('#4d5046', 0.96);
  const edges: Array<
    readonly [readonly [number, number, number], readonly [number, number, number]]
  > = [
    [
      [149, 2.8, 1.6],
      [0, -1.18, -64],
    ],
    [
      [149, 2.8, 1.6],
      [0, -1.18, 68],
    ],
    [
      [1.6, 2.8, 133],
      [-74, -1.18, 2],
    ],
    [
      [1.6, 2.8, 133],
      [74, -1.18, 2],
    ],
  ];
  edges.forEach(([size, position], index) => {
    boundary.add(box(`cliff-edge-${index}`, size, position, cliffMaterial));
  });
  root.add(boundary);

  const tunnel = new Group();
  tunnel.name = 'closed-tunnel';
  tunnel.position.set(0, 0.2, -62.4);
  const portal = new Mesh(new BoxGeometry(7.4, 4.4, 1.2), material('#57574e', 0.96));
  portal.position.y = 2.2;
  const gate = box(
    'closed-tunnel-gate',
    [4.8, 3.2, 0.28],
    [0, 1.65, 0.7],
    material('#343c3c', 0.42, 0.5),
  );
  tunnel.add(portal, gate);
  root.add(tunnel);
  colliders.push({
    id: 'closed-tunnel',
    center: [0, -61.8],
    halfSize: [3.7, 0.8],
    height: 4.4,
    vaultable: false,
  });

  const parkingSpots: ParkingSpot[] = [
    { id: 'square-west', position: [-9.3, -4.5], heading: 0, roadNodeId: 'road-nw' },
    { id: 'square-east', position: [9.3, 4.5], heading: Math.PI, roadNodeId: 'road-se' },
    { id: 'bakery', position: [-7.5, 9], heading: Math.PI / 2, roadNodeId: 'road-south' },
    { id: 'harbor-a', position: [-19, 1.1], heading: Math.PI / 2, roadNodeId: 'road-harbor' },
    { id: 'harbor-b', position: [-22.5, -1.1], heading: -Math.PI / 2, roadNodeId: 'road-harbor' },
    { id: 'greenhouse', position: [19, -1.1], heading: -Math.PI / 2, roadNodeId: 'road-garden' },
    {
      id: 'east-cafe',
      position: [37.2, -12.3],
      heading: Math.PI / 2,
      roadNodeId: 'road-east-district-north',
    },
    {
      id: 'east-clinic',
      position: [37.2, 12.3],
      heading: -Math.PI / 2,
      roadNodeId: 'road-east-district-south',
    },
    {
      id: 'east-square',
      position: [44.8, 2.4],
      heading: 0,
      roadNodeId: 'road-east-district-east',
    },
    {
      id: 'south-market',
      position: [5.8, 37.2],
      heading: 0,
      roadNodeId: 'road-south-riverside-north',
    },
    {
      id: 'south-station',
      position: [-5.8, 48.8],
      heading: Math.PI,
      roadNodeId: 'road-south-riverside-south',
    },
    {
      id: 'south-square',
      position: [13.2, 43],
      heading: Math.PI / 2,
      roadNodeId: 'road-south-riverside-east',
    },
    {
      id: 'west-ferry',
      position: [-47.2, -12.3],
      heading: Math.PI / 2,
      roadNodeId: 'road-west-coast-north',
    },
    {
      id: 'west-boathouse',
      position: [-47.2, 12.3],
      heading: -Math.PI / 2,
      roadNodeId: 'road-west-coast-south',
    },
    {
      id: 'west-square',
      position: [-36.8, 2.4],
      heading: 0,
      roadNodeId: 'road-west-coast-east',
    },
    {
      id: 'north-teahouse',
      position: [-7.2, -54.8],
      heading: Math.PI,
      roadNodeId: 'road-north-old-town-north',
    },
    {
      id: 'north-bookshop',
      position: [7.2, -39.2],
      heading: 0,
      roadNodeId: 'road-north-old-town-south',
    },
    {
      id: 'hillside-school',
      position: [54.8, -54.8],
      heading: Math.PI,
      roadNodeId: 'road-northeast-hillside-north',
    },
    {
      id: 'hillside-clinic',
      position: [45.2, -39.2],
      heading: 0,
      roadNodeId: 'road-northeast-hillside-south',
    },
    {
      id: 'garden-cafe',
      position: [54.8, 39.2],
      heading: Math.PI,
      roadNodeId: 'road-southeast-garden-north',
    },
    {
      id: 'garden-workshop',
      position: [45.2, 54.8],
      heading: 0,
      roadNodeId: 'road-southeast-garden-south',
    },
  ];
  const parkingMaterial = material('#d9d5bd', 0.74);
  for (const spot of parkingSpots) {
    const marking = new Mesh(new PlaneGeometry(2.7, 1.35), parkingMaterial);
    marking.name = `parking-${spot.id}`;
    marking.rotation.x = -Math.PI / 2;
    marking.rotation.z = spot.heading;
    marking.position.set(spot.position[0], 0.238, spot.position[1]);
    root.add(marking);
  }

  const pedestrianGraph: NavigationGraph = {
    nodes: [
      {
        id: 'square-n',
        position: [5.2, -5.2],
        neighbors: ['square-w', 'square-e', 'north-cross-in'],
        tags: ['district-anchor'],
      },
      {
        id: 'square-e',
        position: [5.2, 4.8],
        neighbors: ['square-n', 'square-s', 'east-cross-in'],
      },
      {
        id: 'square-s',
        position: [-5.2, 5.2],
        neighbors: ['square-e', 'square-w', 'south-cross-in'],
      },
      {
        id: 'square-w',
        position: [-5.2, -4.8],
        neighbors: ['square-s', 'square-n', 'west-cross-in'],
      },
      {
        id: 'north-cross-in',
        position: [5.2, -6],
        neighbors: ['square-n', 'north-cross-out'],
      },
      {
        id: 'north-cross-out',
        position: [5.2, -10],
        neighbors: ['north-cross-in', 'town-hall', 'blue-home', 'north-old-town-gate'],
      },
      { id: 'town-hall', position: [-5, -11.4], neighbors: ['north-cross-out'] },
      { id: 'blue-home', position: [5.5, -11.4], neighbors: ['north-cross-out'] },
      {
        id: 'south-cross-in',
        position: [-5.2, 6],
        neighbors: ['square-s', 'south-cross-out'],
      },
      {
        id: 'south-cross-out',
        position: [-5.2, 10],
        neighbors: ['south-cross-in', 'bakery', 'sage-home', 'south-riverside-entry'],
      },
      { id: 'bakery', position: [-5.2, 11.4], neighbors: ['south-cross-out'] },
      { id: 'sage-home', position: [5.5, 11.4], neighbors: ['south-cross-out'] },
      {
        id: 'west-cross-in',
        position: [-10, -4.8],
        neighbors: ['square-w', 'west-cross-out'],
      },
      {
        id: 'west-cross-out',
        position: [-14, -4.8],
        neighbors: ['west-cross-in', 'harbor'],
      },
      {
        id: 'harbor',
        position: [-16.2, -4.8],
        neighbors: ['west-cross-out', 'workshop', 'west-coast-gate'],
        tags: ['district-anchor'],
      },
      { id: 'workshop', position: [-16.4, -2.9], neighbors: ['harbor'] },
      {
        id: 'east-cross-in',
        position: [10, 4.8],
        neighbors: ['square-e', 'east-cross-out'],
      },
      {
        id: 'east-cross-out',
        position: [14, 4.8],
        neighbors: ['east-cross-in', 'garden'],
      },
      {
        id: 'garden',
        position: [16.2, 4.8],
        neighbors: ['east-cross-out', 'greenhouse', 'east-district-gate'],
        tags: ['district-anchor'],
      },
      { id: 'greenhouse', position: [16.2, 8.2], neighbors: ['garden'] },
      {
        id: 'east-district-gate',
        position: [28, 4.8],
        neighbors: ['garden', 'east-district-sw'],
      },
      {
        id: 'east-district-sw',
        position: [36.8, 9.8],
        neighbors: [
          'east-district-gate',
          'east-district-se',
          'east-district-west',
          'east-clinic',
          'southeast-garden-north-gate',
        ],
      },
      {
        id: 'east-district-se',
        position: [43.2, 9.8],
        neighbors: [
          'east-district-sw',
          'east-district-east',
          'east-residence',
          'east-district-square',
        ],
      },
      {
        id: 'east-district-east',
        position: [43.2, 0],
        neighbors: ['east-district-se', 'east-district-ne', 'east-district-west'],
      },
      {
        id: 'east-district-ne',
        position: [43.2, -9.8],
        neighbors: ['east-district-east', 'east-district-nw', 'east-library'],
      },
      {
        id: 'east-district-nw',
        position: [36.8, -9.8],
        neighbors: [
          'east-district-ne',
          'east-district-west',
          'east-cafe',
          'northeast-hillside-south-gate',
        ],
      },
      {
        id: 'east-district-west',
        position: [36.8, 0],
        neighbors: ['east-district-nw', 'east-district-sw', 'east-district-east'],
      },
      {
        id: 'east-district-square',
        position: [40, 8.2],
        neighbors: ['east-district-sw', 'east-district-se'],
        tags: ['district-anchor'],
      },
      { id: 'east-cafe', position: [36, -17.7], neighbors: ['east-district-nw'] },
      { id: 'east-library', position: [44, -17.7], neighbors: ['east-district-ne'] },
      { id: 'east-clinic', position: [36, 17.7], neighbors: ['east-district-sw'] },
      { id: 'east-residence', position: [44, 17.7], neighbors: ['east-district-se'] },
      {
        id: 'south-riverside-entry',
        position: [2.2, 10],
        neighbors: ['south-cross-out', 'south-riverside-gate'],
      },
      {
        id: 'south-riverside-gate',
        position: [2.2, 23],
        neighbors: ['south-riverside-entry', 'south-riverside-ne'],
      },
      {
        id: 'south-riverside-nw',
        position: [-8, 36],
        neighbors: ['south-riverside-ne', 'south-riverside-west', 'south-riverside-workshop'],
      },
      {
        id: 'south-riverside-ne',
        position: [8, 36],
        neighbors: [
          'south-riverside-gate',
          'south-riverside-nw',
          'south-riverside-east',
          'south-riverside-market',
        ],
      },
      {
        id: 'south-riverside-east',
        position: [8, 43],
        neighbors: [
          'south-riverside-ne',
          'south-riverside-se',
          'south-riverside-square',
          'southeast-garden-west-gate',
        ],
      },
      {
        id: 'south-riverside-se',
        position: [8, 50],
        neighbors: ['south-riverside-east', 'south-riverside-sw', 'south-riverside-residence'],
      },
      {
        id: 'south-riverside-sw',
        position: [-8, 50],
        neighbors: ['south-riverside-se', 'south-riverside-west', 'south-riverside-station'],
      },
      {
        id: 'south-riverside-west',
        position: [-8, 43],
        neighbors: ['south-riverside-sw', 'south-riverside-nw', 'south-riverside-square'],
      },
      {
        id: 'south-riverside-square',
        position: [0, 43],
        neighbors: ['south-riverside-west', 'south-riverside-east'],
        tags: ['district-anchor'],
      },
      {
        id: 'south-riverside-workshop',
        position: [-6, 31.5],
        neighbors: ['south-riverside-nw'],
      },
      {
        id: 'south-riverside-market',
        position: [6, 31.5],
        neighbors: ['south-riverside-ne'],
      },
      {
        id: 'south-riverside-station',
        position: [-6, 54.5],
        neighbors: ['south-riverside-sw'],
      },
      {
        id: 'south-riverside-residence',
        position: [6, 54.5],
        neighbors: ['south-riverside-se'],
      },
      {
        id: 'west-coast-gate',
        position: [-29, -4.8],
        neighbors: ['harbor', 'west-coast-ne'],
      },
      {
        id: 'west-coast-ne',
        position: [-40.8, -9.8],
        neighbors: [
          'west-coast-gate',
          'west-coast-nw',
          'west-coast-east',
          'west-coast-fish-market',
        ],
      },
      {
        id: 'west-coast-nw',
        position: [-47.2, -9.8],
        neighbors: ['west-coast-ne', 'west-coast-west', 'west-coast-ferry-terminal'],
      },
      {
        id: 'west-coast-west',
        position: [-47.2, 0],
        neighbors: ['west-coast-nw', 'west-coast-sw', 'west-coast-east', 'west-coast-square'],
      },
      {
        id: 'west-coast-sw',
        position: [-47.2, 9.8],
        neighbors: ['west-coast-west', 'west-coast-se', 'west-coast-boathouse'],
      },
      {
        id: 'west-coast-se',
        position: [-40.8, 9.8],
        neighbors: ['west-coast-sw', 'west-coast-east', 'west-coast-residence'],
      },
      {
        id: 'west-coast-east',
        position: [-40.8, 0],
        neighbors: ['west-coast-ne', 'west-coast-se', 'west-coast-west', 'west-coast-square'],
      },
      {
        id: 'west-coast-square',
        position: [-44, 0],
        neighbors: ['west-coast-west', 'west-coast-east'],
        tags: ['district-anchor'],
      },
      {
        id: 'west-coast-ferry-terminal',
        position: [-48, -17.7],
        neighbors: ['west-coast-nw'],
      },
      {
        id: 'west-coast-fish-market',
        position: [-40, -17.7],
        neighbors: ['west-coast-ne'],
      },
      {
        id: 'west-coast-boathouse',
        position: [-48, 17.7],
        neighbors: ['west-coast-sw'],
      },
      {
        id: 'west-coast-residence',
        position: [-40, 17.7],
        neighbors: ['west-coast-se'],
      },
      {
        id: 'north-old-town-gate',
        position: [0, -31],
        neighbors: ['north-cross-out', 'north-old-town-se', 'north-old-town-sw'],
      },
      {
        id: 'north-old-town-sw',
        position: [-8, -40],
        neighbors: [
          'north-old-town-gate',
          'north-old-town-west',
          'north-old-town-se',
          'north-bookshop',
        ],
      },
      {
        id: 'north-old-town-se',
        position: [8, -40],
        neighbors: [
          'north-old-town-gate',
          'north-old-town-east',
          'north-old-town-sw',
          'north-residence',
        ],
      },
      {
        id: 'north-old-town-east',
        position: [8, -47],
        neighbors: [
          'north-old-town-se',
          'north-old-town-ne',
          'north-old-town-square',
          'northeast-hillside-west-gate',
        ],
      },
      {
        id: 'north-old-town-ne',
        position: [8, -54],
        neighbors: ['north-old-town-east', 'north-old-town-nw', 'north-apartments'],
      },
      {
        id: 'north-old-town-nw',
        position: [-8, -54],
        neighbors: ['north-old-town-ne', 'north-old-town-west', 'north-teahouse'],
      },
      {
        id: 'north-old-town-west',
        position: [-8, -47],
        neighbors: ['north-old-town-nw', 'north-old-town-sw', 'north-old-town-square'],
      },
      {
        id: 'north-old-town-square',
        position: [0, -47],
        neighbors: ['north-old-town-west', 'north-old-town-east'],
        tags: ['district-anchor'],
      },
      { id: 'north-teahouse', position: [-7, -58.4], neighbors: ['north-old-town-nw'] },
      { id: 'north-apartments', position: [7, -58.4], neighbors: ['north-old-town-ne'] },
      { id: 'north-bookshop', position: [-7, -35.6], neighbors: ['north-old-town-sw'] },
      { id: 'north-residence', position: [7, -35.6], neighbors: ['north-old-town-se'] },
      {
        id: 'northeast-hillside-west-gate',
        position: [29, -47],
        neighbors: ['north-old-town-east', 'northeast-hillside-west'],
      },
      {
        id: 'northeast-hillside-south-gate',
        position: [40, -27],
        neighbors: ['east-district-nw', 'northeast-hillside-sw'],
      },
      {
        id: 'northeast-hillside-sw',
        position: [44, -40],
        neighbors: [
          'northeast-hillside-south-gate',
          'northeast-hillside-west',
          'northeast-hillside-se',
          'hillside-clinic',
        ],
      },
      {
        id: 'northeast-hillside-se',
        position: [56, -40],
        neighbors: ['northeast-hillside-sw', 'northeast-hillside-east', 'hillside-civic-hall'],
      },
      {
        id: 'northeast-hillside-east',
        position: [56, -47],
        neighbors: ['northeast-hillside-se', 'northeast-hillside-ne', 'northeast-hillside-square'],
      },
      {
        id: 'northeast-hillside-ne',
        position: [56, -54],
        neighbors: ['northeast-hillside-east', 'northeast-hillside-nw', 'hillside-school'],
      },
      {
        id: 'northeast-hillside-nw',
        position: [44, -54],
        neighbors: ['northeast-hillside-ne', 'northeast-hillside-west', 'hillside-observatory'],
      },
      {
        id: 'northeast-hillside-west',
        position: [44, -47],
        neighbors: [
          'northeast-hillside-nw',
          'northeast-hillside-sw',
          'northeast-hillside-square',
          'northeast-hillside-west-gate',
        ],
      },
      {
        id: 'northeast-hillside-square',
        position: [50, -47],
        neighbors: ['northeast-hillside-west', 'northeast-hillside-east'],
        tags: ['district-anchor'],
      },
      { id: 'hillside-observatory', position: [46, -58.4], neighbors: ['northeast-hillside-nw'] },
      { id: 'hillside-school', position: [57, -58.4], neighbors: ['northeast-hillside-ne'] },
      { id: 'hillside-clinic', position: [46, -35.6], neighbors: ['northeast-hillside-sw'] },
      { id: 'hillside-civic-hall', position: [57, -35.6], neighbors: ['northeast-hillside-se'] },
      {
        id: 'southeast-garden-west-gate',
        position: [28, 47],
        neighbors: ['south-riverside-east', 'southeast-garden-west'],
      },
      {
        id: 'southeast-garden-north-gate',
        position: [40, 27],
        neighbors: ['east-district-sw', 'southeast-garden-nw'],
      },
      {
        id: 'southeast-garden-nw',
        position: [44, 40],
        neighbors: [
          'southeast-garden-north-gate',
          'southeast-garden-west',
          'southeast-garden-ne',
          'garden-nursery',
        ],
      },
      {
        id: 'southeast-garden-ne',
        position: [56, 40],
        neighbors: ['southeast-garden-nw', 'southeast-garden-east', 'garden-cafe'],
      },
      {
        id: 'southeast-garden-east',
        position: [56, 47],
        neighbors: ['southeast-garden-ne', 'southeast-garden-se', 'southeast-garden-square'],
      },
      {
        id: 'southeast-garden-se',
        position: [56, 54],
        neighbors: ['southeast-garden-east', 'southeast-garden-sw', 'garden-residence'],
      },
      {
        id: 'southeast-garden-sw',
        position: [44, 54],
        neighbors: ['southeast-garden-se', 'southeast-garden-west', 'garden-workshop'],
      },
      {
        id: 'southeast-garden-west',
        position: [44, 47],
        neighbors: [
          'southeast-garden-nw',
          'southeast-garden-sw',
          'southeast-garden-square',
          'southeast-garden-west-gate',
        ],
      },
      {
        id: 'southeast-garden-square',
        position: [50, 47],
        neighbors: ['southeast-garden-west', 'southeast-garden-east'],
        tags: ['district-anchor'],
      },
      { id: 'garden-nursery', position: [46, 35.6], neighbors: ['southeast-garden-nw'] },
      { id: 'garden-cafe', position: [57, 35.6], neighbors: ['southeast-garden-ne'] },
      { id: 'garden-workshop', position: [46, 58.4], neighbors: ['southeast-garden-sw'] },
      { id: 'garden-residence', position: [57, 58.4], neighbors: ['southeast-garden-se'] },
    ],
  };

  const vehicleGraph: NavigationGraph = {
    nodes: [
      {
        id: 'road-nw',
        position: [-12, -8],
        neighbors: ['road-ne', 'road-west', 'road-north-old-town-connector'],
      },
      { id: 'road-ne', position: [12, -8], neighbors: ['road-nw', 'road-east'] },
      { id: 'road-se', position: [12, 8], neighbors: ['road-ne', 'road-south'] },
      {
        id: 'road-south',
        position: [0, 8],
        neighbors: ['road-se', 'road-sw', 'road-south-riverside-connector'],
      },
      { id: 'road-sw', position: [-12, 8], neighbors: ['road-south', 'road-west'] },
      { id: 'road-west', position: [-12, 0], neighbors: ['road-sw', 'road-nw', 'road-harbor'] },
      {
        id: 'road-harbor',
        position: [-23, 0],
        neighbors: ['road-west', 'road-west-coast-east'],
      },
      { id: 'road-east', position: [12, 0], neighbors: ['road-ne', 'road-se', 'road-garden'] },
      {
        id: 'road-garden',
        position: [23, 0],
        neighbors: ['road-east', 'road-east-district-west'],
      },
      {
        id: 'road-east-district-west',
        position: [34, 0],
        neighbors: ['road-garden', 'road-east-district-nw', 'road-east-district-sw'],
      },
      {
        id: 'road-east-district-nw',
        position: [34, -13.5],
        neighbors: [
          'road-east-district-west',
          'road-east-district-ne',
          'road-northeast-hillside-south-connector',
        ],
      },
      {
        id: 'road-east-district-ne',
        position: [46, -13.5],
        neighbors: ['road-east-district-nw', 'road-east-district-east'],
      },
      {
        id: 'road-east-district-east',
        position: [46, 0],
        neighbors: ['road-east-district-ne', 'road-east-district-se'],
      },
      {
        id: 'road-east-district-se',
        position: [46, 13.5],
        neighbors: ['road-east-district-east', 'road-east-district-south'],
      },
      {
        id: 'road-east-district-south',
        position: [34, 13.5],
        neighbors: [
          'road-east-district-se',
          'road-east-district-sw',
          'road-southeast-garden-north-connector',
        ],
      },
      {
        id: 'road-east-district-sw',
        position: [34, 6],
        neighbors: ['road-east-district-south', 'road-east-district-west'],
      },
      {
        id: 'road-south-riverside-connector',
        position: [0, 22],
        neighbors: ['road-south', 'road-south-riverside-north'],
      },
      {
        id: 'road-south-riverside-north',
        position: [0, 35],
        neighbors: [
          'road-south-riverside-connector',
          'road-south-riverside-west',
          'road-south-riverside-east',
        ],
      },
      {
        id: 'road-south-riverside-west',
        position: [-12, 43],
        neighbors: ['road-south-riverside-north', 'road-south-riverside-south'],
      },
      {
        id: 'road-south-riverside-south',
        position: [0, 51],
        neighbors: ['road-south-riverside-west', 'road-south-riverside-east'],
      },
      {
        id: 'road-south-riverside-east',
        position: [12, 43],
        neighbors: [
          'road-south-riverside-south',
          'road-south-riverside-north',
          'road-southeast-garden-west-connector',
        ],
      },
      {
        id: 'road-west-coast-east',
        position: [-38, 0],
        neighbors: ['road-harbor', 'road-west-coast-ne', 'road-west-coast-se'],
      },
      {
        id: 'road-west-coast-ne',
        position: [-38, -13.5],
        neighbors: ['road-west-coast-east', 'road-west-coast-north'],
      },
      {
        id: 'road-west-coast-north',
        position: [-50, -13.5],
        neighbors: ['road-west-coast-ne', 'road-west-coast-west'],
      },
      {
        id: 'road-west-coast-west',
        position: [-50, 0],
        neighbors: ['road-west-coast-north', 'road-west-coast-south'],
      },
      {
        id: 'road-west-coast-south',
        position: [-50, 13.5],
        neighbors: ['road-west-coast-west', 'road-west-coast-se'],
      },
      {
        id: 'road-west-coast-se',
        position: [-38, 13.5],
        neighbors: ['road-west-coast-south', 'road-west-coast-east'],
      },
      {
        id: 'road-north-old-town-connector',
        position: [0, -30],
        neighbors: ['road-nw', 'road-north-old-town-south'],
      },
      {
        id: 'road-north-old-town-south',
        position: [0, -38],
        neighbors: [
          'road-north-old-town-connector',
          'road-north-old-town-west',
          'road-north-old-town-east',
        ],
      },
      {
        id: 'road-north-old-town-west',
        position: [-12, -47],
        neighbors: ['road-north-old-town-south', 'road-north-old-town-north'],
      },
      {
        id: 'road-north-old-town-north',
        position: [0, -56],
        neighbors: ['road-north-old-town-west', 'road-north-old-town-east'],
      },
      {
        id: 'road-north-old-town-east',
        position: [12, -47],
        neighbors: [
          'road-north-old-town-north',
          'road-north-old-town-south',
          'road-northeast-hillside-west-connector',
        ],
      },
      {
        id: 'road-northeast-hillside-west-connector',
        position: [30, -47],
        neighbors: ['road-north-old-town-east', 'road-northeast-hillside-west'],
      },
      {
        id: 'road-northeast-hillside-south-connector',
        position: [40, -28],
        neighbors: ['road-east-district-nw', 'road-northeast-hillside-south'],
      },
      {
        id: 'road-northeast-hillside-south',
        position: [50, -38],
        neighbors: [
          'road-northeast-hillside-south-connector',
          'road-northeast-hillside-west',
          'road-northeast-hillside-east',
        ],
      },
      {
        id: 'road-northeast-hillside-west',
        position: [42, -47],
        neighbors: [
          'road-northeast-hillside-south',
          'road-northeast-hillside-north',
          'road-northeast-hillside-west-connector',
        ],
      },
      {
        id: 'road-northeast-hillside-north',
        position: [50, -56],
        neighbors: ['road-northeast-hillside-west', 'road-northeast-hillside-east'],
      },
      {
        id: 'road-northeast-hillside-east',
        position: [58, -47],
        neighbors: ['road-northeast-hillside-north', 'road-northeast-hillside-south'],
      },
      {
        id: 'road-southeast-garden-west-connector',
        position: [28, 47],
        neighbors: ['road-south-riverside-east', 'road-southeast-garden-west'],
      },
      {
        id: 'road-southeast-garden-north-connector',
        position: [40, 28],
        neighbors: ['road-east-district-south', 'road-southeast-garden-north'],
      },
      {
        id: 'road-southeast-garden-north',
        position: [50, 38],
        neighbors: [
          'road-southeast-garden-north-connector',
          'road-southeast-garden-west',
          'road-southeast-garden-east',
        ],
      },
      {
        id: 'road-southeast-garden-west',
        position: [42, 47],
        neighbors: [
          'road-southeast-garden-north',
          'road-southeast-garden-south',
          'road-southeast-garden-west-connector',
        ],
      },
      {
        id: 'road-southeast-garden-south',
        position: [50, 56],
        neighbors: ['road-southeast-garden-west', 'road-southeast-garden-east'],
      },
      {
        id: 'road-southeast-garden-east',
        position: [58, 47],
        neighbors: ['road-southeast-garden-south', 'road-southeast-garden-north'],
      },
    ],
  };

  const setQuality = (profile: QualityProfile) => markShadow(root, profile.shadows);
  const activity: TownActivitySnapshot = {
    craneRotation: 0,
    cargoHeight: craneCargo.position.y,
    plantGrowth: 1,
    lampIntensity: lampGlow.emissiveIntensity,
  };
  const scaledColliders = colliders.map((collider) => ({
    ...collider,
    center: scaleTownVec2(collider.center),
    halfSize: scaleTownVec2(collider.halfSize),
  }));
  const scaleGraph = (graph: NavigationGraph): NavigationGraph => ({
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: scaleTownVec2(node.position),
    })),
  });
  const scaledPedestrianGraph = createCollisionFreeNavigationGraph(
    scaleGraph(pedestrianGraph),
    scaledColliders,
    0.42,
  );
  const scaledVehicleGraph = scaleGraph(vehicleGraph);
  const scaledParkingSpots = parkingSpots.map((spot) => ({
    ...spot,
    position: scaleTownVec2(spot.position),
  }));
  root.updateMatrixWorld(true);

  return {
    root,
    colliders: scaledColliders,
    pedestrianGraph: scaledPedestrianGraph,
    vehicleGraph: scaledVehicleGraph,
    parkingSpots: scaledParkingSpots,
    setQuality,
    getActivitySnapshot: () => ({ ...activity }),
    update(signals, elapsed = 0) {
      roadMaterial.roughness = 0.74 - signals.wetness * 0.32;
      roadMaterial.metalness = 0.04 + signals.wetness * 0.14;
      grassMaterial.color.set(signals.snowCover > 0.35 ? '#aeb9a8' : '#6c885f');
      activity.craneRotation = Math.sin(elapsed * 0.22) * 0.28 * signals.motionScale;
      activity.cargoHeight = -2.3 + Math.sin(elapsed * 0.47) * 0.34 * signals.motionScale;
      activity.plantGrowth = 0.58 + signals.daylight * 0.42;
      activity.lampIntensity = 0.14 + signals.cabinLight * 1.72;
      craneBoom.rotation.y = activity.craneRotation;
      craneCargo.position.y = activity.cargoHeight;
      greenhouseCrops.scale.y = activity.plantGrowth;
      greenhouseCrops.rotation.z = Math.sin(elapsed * 0.8) * signals.plantSway * 0.1;
      lampGlow.emissiveIntensity = activity.lampIntensity;
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
