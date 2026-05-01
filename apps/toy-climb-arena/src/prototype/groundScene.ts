/**
 * groundScene.ts
 * 玩具房间地面场景：灯光、棋盘格地砖、背景墙、彩色条纹、散落积木装饰。
 * 通过 createGroundScene(scene, opts) 工厂函数创建，返回需要 dispose 的资源及待注册碰撞体。
 */
import {
  AmbientLight,
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from 'three';

export interface GroundSceneOptions {
  floorSurfaceY: number;
  floorVisualSize: number;
  skyColor: string;
  sunColor: string;
}

export interface GroundSceneResult {
  /** 需外部统一 dispose 的几何体 */
  geometries: BufferGeometry[];
  /** 需外部统一 dispose 的材质 */
  materials: MeshStandardMaterial[];
  /**
   * 装饰物 AABB 碰撞参数列表（pushCollider 在主文件定义后批量注册）
   */
  pendingDecoColliders: Array<{
    center: [number, number, number];
    size: [number, number, number];
  }>;
}

export function createGroundScene(scene: Scene, opts: GroundSceneOptions): GroundSceneResult {
  const { floorSurfaceY, floorVisualSize, skyColor, sunColor } = opts;

  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const pendingDecoColliders: Array<{
    center: [number, number, number];
    size: [number, number, number];
  }> = [];

  // ── 灯光 ─────────────────────────────────────────────────────────────────
  const ambient = new AmbientLight('#fff4e0', 0.55);
  const hemi = new HemisphereLight('#ffe8c0', '#b0d4ff', 0.35);
  const mainLight = new DirectionalLight(sunColor, 1.3);
  mainLight.position.set(11, 20, 8);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 80;
  mainLight.shadow.camera.left = -28;
  mainLight.shadow.camera.right = 28;
  mainLight.shadow.camera.top = 28;
  mainLight.shadow.camera.bottom = -28;
  const fillLight = new DirectionalLight('#c4d4ff', 0.28);
  fillLight.position.set(-8, 6, -12);
  scene.add(ambient, hemi, mainLight, fillLight);

  // 轻雾
  scene.fog = new FogExp2(skyColor, 0.012);

  // ── 地面底座（厚桌面，营造实体感）────────────────────────────────────────
  const tableBaseGeo = new BoxGeometry(1, 1, 1);
  const tableBaseMat = new MeshStandardMaterial({
    color: '#C8844A',
    roughness: 0.85,
    metalness: 0,
  });
  geometries.push(tableBaseGeo);
  materials.push(tableBaseMat);
  const tableBase = new Mesh(tableBaseGeo, tableBaseMat);
  tableBase.scale.set(floorVisualSize, 3.0, floorVisualSize);
  tableBase.position.set(0, floorSurfaceY - 1.5, 0);
  tableBase.receiveShadow = true;
  scene.add(tableBase);

  // ── 棋盘格地砖 ────────────────────────────────────────────────────────────
  const tileMatA = new MeshStandardMaterial({ color: '#FFF3DC', roughness: 0.72, metalness: 0 });
  const tileMatB = new MeshStandardMaterial({ color: '#FBBF24', roughness: 0.72, metalness: 0 });
  materials.push(tileMatA, tileMatB);
  const tileSingleGeo = new PlaneGeometry(1, 1);
  geometries.push(tileSingleGeo);
  const TILE_SIZE = 4;
  const TILE_RANGE = 9;
  for (let ix = -TILE_RANGE; ix <= TILE_RANGE; ix++) {
    for (let iz = -TILE_RANGE; iz <= TILE_RANGE; iz++) {
      const mat = (ix + iz) % 2 === 0 ? tileMatA : tileMatB;
      const tile = new Mesh(tileSingleGeo, mat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(ix * TILE_SIZE, floorSurfaceY + 0.005, iz * TILE_SIZE);
      tile.scale.set(TILE_SIZE - 0.06, TILE_SIZE - 0.06, 1);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }

  // ── 背景墙（后墙 + 左墙 + 右墙）─────────────────────────────────────────
  const wallMat = new MeshStandardMaterial({ color: '#FEF6EC', roughness: 0.95, metalness: 0 });
  materials.push(wallMat);
  const wallGeo = new PlaneGeometry(1, 1);
  geometries.push(wallGeo);
  const WALL_HALF = 55;
  const WALL_HEIGHT = 28;
  const WALL_Y = floorSurfaceY + WALL_HEIGHT / 2 - 1;

  const backWall = new Mesh(wallGeo, wallMat);
  backWall.scale.set(WALL_HALF * 2, WALL_HEIGHT, 1);
  backWall.position.set(0, WALL_Y, -WALL_HALF);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new Mesh(wallGeo, wallMat);
  leftWall.scale.set(WALL_HALF * 2, WALL_HEIGHT, 1);
  leftWall.position.set(-WALL_HALF, WALL_Y, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new Mesh(wallGeo, wallMat);
  rightWall.scale.set(WALL_HALF * 2, WALL_HEIGHT, 1);
  rightWall.position.set(WALL_HALF, WALL_Y, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // ── 后墙彩色竖条纹 ────────────────────────────────────────────────────────
  const wallStripeColors = ['#FECACA', '#FDE68A', '#BBF7D0', '#BAE6FD', '#E9D5FF', '#FBCFE8'];
  const stripeGeo = new PlaneGeometry(1, 1);
  geometries.push(stripeGeo);
  const STRIPE_WIDTH = 4.5;
  const STRIPE_HEIGHT = WALL_HEIGHT * 0.65;
  for (let i = 0; i < wallStripeColors.length; i++) {
    const stripeMat = new MeshStandardMaterial({
      color: wallStripeColors[i],
      roughness: 0.98,
      metalness: 0,
    });
    materials.push(stripeMat);
    const ox = (i - wallStripeColors.length / 2 + 0.5) * (STRIPE_WIDTH + 1.5);
    const stripe = new Mesh(stripeGeo, stripeMat);
    stripe.scale.set(STRIPE_WIDTH, STRIPE_HEIGHT, 1);
    stripe.position.set(ox, floorSurfaceY + STRIPE_HEIGHT / 2 + 0.5, -WALL_HALF + 0.04);
    scene.add(stripe);
  }

  // ── 散落积木装饰（box + 圆柱躺倒 + 堆叠层）──────────────────────────────
  const decoColors = [
    '#EF4444',
    '#3B82F6',
    '#22C55E',
    '#FBBF24',
    '#A855F7',
    '#F97316',
    '#EC4899',
    '#14B8A6',
    '#F59E0B',
  ];
  const decoBoxGeo = new BoxGeometry(1, 1, 1);
  const decoCylGeo = new CylinderGeometry(0.5, 0.5, 1, 12);
  geometries.push(decoBoxGeo, decoCylGeo);

  type DecoItem = {
    pos: [number, number, number];
    size: [number, number, number];
    yaw: number;
    ci: number;
    shape?: 'box' | 'cyl';
  };
  const FY = floorSurfaceY;
  const decoItems: DecoItem[] = [
    { pos: [-12, FY + 0.22, 8], size: [1.4, 0.44, 0.9], yaw: 0.3, ci: 0 },
    { pos: [14, FY + 0.18, 5], size: [0.9, 0.36, 1.8], yaw: -0.5, ci: 1 },
    { pos: [-8, FY + 0.22, 16], size: [1.1, 0.44, 1.1], yaw: 0.8, ci: 2 },
    { pos: [18, FY + 0.22, -6], size: [1.6, 0.44, 0.7], yaw: 1.1, ci: 3 },
    { pos: [-16, FY + 0.18, -4], size: [0.9, 0.36, 1.4], yaw: -0.2, ci: 4 },
    { pos: [6, FY + 0.22, -12], size: [1.1, 0.44, 0.9], yaw: 0.6, ci: 5 },
    { pos: [-14, FY + 0.22, -14], size: [1.4, 0.44, 1.4], yaw: -0.9, ci: 6 },
    { pos: [10, FY + 0.18, 18], size: [0.7, 0.36, 1.1], yaw: 0.4, ci: 7 },
    { pos: [-20, FY + 0.22, 2], size: [1.1, 0.44, 0.7], yaw: -0.7, ci: 8 },
    { pos: [16, FY + 0.22, -16], size: [0.9, 0.36, 0.9], yaw: 1.3, ci: 0 },
    { pos: [-4, FY + 0.22, 22], size: [1.8, 0.44, 0.7], yaw: 0.15, ci: 1 },
    { pos: [22, FY + 0.18, 10], size: [0.9, 0.36, 1.6], yaw: -0.4, ci: 2 },
    { pos: [-28, FY + 0.22, 12], size: [1.6, 0.44, 1.0], yaw: 0.7, ci: 3 },
    { pos: [26, FY + 0.22, -20], size: [1.2, 0.44, 1.2], yaw: -1.2, ci: 4 },
    { pos: [-24, FY + 0.22, -22], size: [2.0, 0.44, 0.8], yaw: 0.5, ci: 5 },
    { pos: [30, FY + 0.22, 18], size: [0.8, 0.44, 1.6], yaw: 1.0, ci: 6 },
    { pos: [8, FY + 0.22, -28], size: [1.4, 0.44, 1.0], yaw: -0.3, ci: 7 },
    { pos: [-30, FY + 0.22, 28], size: [1.0, 0.44, 1.8], yaw: 0.9, ci: 8 },
    { pos: [-10, FY + 0.35, 24], size: [0.7, 0.7, 3.2], yaw: -0.4, ci: 0, shape: 'cyl' },
    { pos: [20, FY + 0.28, -10], size: [0.6, 0.6, 2.6], yaw: 1.1, ci: 3, shape: 'cyl' },
    { pos: [-22, FY + 0.3, 18], size: [0.8, 0.8, 2.0], yaw: 0.6, ci: 5, shape: 'cyl' },
    { pos: [28, FY + 0.28, 8], size: [0.65, 0.65, 2.8], yaw: -0.8, ci: 2, shape: 'cyl' },
    { pos: [-12, FY + 0.64, 8], size: [1.0, 0.44, 0.7], yaw: 0.6, ci: 2 },
    { pos: [14, FY + 0.54, 5], size: [0.7, 0.36, 1.2], yaw: -0.2, ci: 5 },
    { pos: [18, FY + 0.64, -6], size: [1.0, 0.44, 0.5], yaw: 0.3, ci: 6 },
  ];

  for (const item of decoItems) {
    const ci = item.ci % decoColors.length;
    const mat = new MeshStandardMaterial({
      color: new Color(decoColors[ci]),
      roughness: 0.6,
      metalness: 0.05,
    });
    materials.push(mat);
    const geo = item.shape === 'cyl' ? decoCylGeo : decoBoxGeo;
    const mesh = new Mesh(geo, mat);
    mesh.position.set(item.pos[0], item.pos[1], item.pos[2]);
    if (item.shape === 'cyl') {
      mesh.rotation.set(0, item.yaw, Math.PI / 2);
      mesh.scale.set(item.size[0], item.size[2], item.size[1]);
      pendingDecoColliders.push({
        center: [item.pos[0], item.pos[1], item.pos[2]],
        size: [item.size[2], item.size[0], item.size[1]],
      });
    } else {
      mesh.rotation.y = item.yaw;
      mesh.scale.set(item.size[0], item.size[1], item.size[2]);
      pendingDecoColliders.push({
        center: [item.pos[0], item.pos[1], item.pos[2]],
        size: [item.size[0], item.size[1], item.size[2]],
      });
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  return { geometries, materials, pendingDecoColliders };
}
