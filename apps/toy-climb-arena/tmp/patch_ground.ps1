$file = "D:\my-code\valley-mas\apps\toy-climb-arena\src\createClimberPrototype.ts"
$lines = [System.IO.File]::ReadAllLines($file)
$before = $lines[0..365]
$after  = $lines[494..($lines.Count - 1)]

$newBlock = @"
  const floor = new Mesh(
    new PlaneGeometry(FLOOR_VISUAL_SIZE, FLOOR_VISUAL_SIZE),
    new MeshStandardMaterial({ color: floorColor, roughness: 0.9, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_SURFACE_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new GridHelper(FLOOR_VISUAL_SIZE, 110, gridPrimaryColor, gridSecondaryColor);
  grid.position.y = FLOOR_SURFACE_Y + 0.01;
  const gridMaterial = grid.material as Material | Material[];
  if (Array.isArray(gridMaterial)) {
    gridMaterial.forEach((material) => {
      const anyMaterial = material as Material & { opacity?: number; transparent?: boolean };
      anyMaterial.transparent = true;
      anyMaterial.opacity = 0.12;
    });
  }
  grid.visible = false;
  scene.add(grid);

  const sceneryMaterials: MeshStandardMaterial[] = [];
  const sceneryGeometries: BufferGeometry[] = [];

  // -- 桌面底座：给地面一个有厚度的实体感 -----------------------------------
  const tableBaseGeo = new BoxGeometry(1, 1, 1);
  const tableBaseMat = new MeshStandardMaterial({ color: '#C8844A', roughness: 0.85, metalness: 0.0 });
  sceneryGeometries.push(tableBaseGeo);
  sceneryMaterials.push(tableBaseMat);
  const tableBase = new Mesh(tableBaseGeo, tableBaseMat);
  tableBase.scale.set(FLOOR_VISUAL_SIZE, 3.0, FLOOR_VISUAL_SIZE);
  tableBase.position.set(0, FLOOR_SURFACE_Y - 1.5, 0);
  tableBase.receiveShadow = true;
  tableBase.castShadow = false;
  scene.add(tableBase);

  // -- 棋盘格地砖（玩具游戏垫风格）------------------------------------------
  const tileMatA = new MeshStandardMaterial({ color: '#FFF3DC', roughness: 0.72, metalness: 0.0 });
  const tileMatB = new MeshStandardMaterial({ color: '#FBBF24', roughness: 0.72, metalness: 0.0 });
  sceneryMaterials.push(tileMatA, tileMatB);
  const tileSingleGeo = new PlaneGeometry(1, 1);
  sceneryGeometries.push(tileSingleGeo);
  const TILE_SIZE = 4;
  const TILE_RANGE = 9;
  for (let ix = -TILE_RANGE; ix <= TILE_RANGE; ix++) {
    for (let iz = -TILE_RANGE; iz <= TILE_RANGE; iz++) {
      const mat = (ix + iz) % 2 === 0 ? tileMatA : tileMatB;
      const tile = new Mesh(tileSingleGeo, mat);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(ix * TILE_SIZE, FLOOR_SURFACE_Y + 0.005, iz * TILE_SIZE);
      tile.scale.set(TILE_SIZE - 0.06, TILE_SIZE - 0.06, 1);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }

  // -- 背景房间墙壁（营造玩具房间感）----------------------------------------
  const wallMat = new MeshStandardMaterial({ color: '#FEF6EC', roughness: 0.95, metalness: 0.0 });
  sceneryMaterials.push(wallMat);
  const wallGeo = new PlaneGeometry(1, 1);
  sceneryGeometries.push(wallGeo);
  const WALL_HALF = 55;
  const WALL_HEIGHT = 28;
  const WALL_Y = FLOOR_SURFACE_Y + WALL_HEIGHT / 2 - 1;
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

  // -- 墙面装饰：彩色竖条纹 --------------------------------------------------
  const wallStripeColors = ['#FECACA', '#FDE68A', '#BBF7D0', '#BAE6FD', '#E9D5FF', '#FBCFE8'];
  const stripeGeo = new PlaneGeometry(1, 1);
  sceneryGeometries.push(stripeGeo);
  const STRIPE_WIDTH = 4.5;
  const STRIPE_HEIGHT = WALL_HEIGHT * 0.65;
  for (let i = 0; i < wallStripeColors.length; i++) {
    const stripeMat = new MeshStandardMaterial({ color: wallStripeColors[i], roughness: 0.98, metalness: 0.0 });
    sceneryMaterials.push(stripeMat);
    const ox = (i - wallStripeColors.length / 2 + 0.5) * (STRIPE_WIDTH + 1.5);
    const s1 = new Mesh(stripeGeo, stripeMat);
    s1.scale.set(STRIPE_WIDTH, STRIPE_HEIGHT, 1);
    s1.position.set(ox, FLOOR_SURFACE_Y + STRIPE_HEIGHT / 2 + 0.5, -WALL_HALF + 0.04);
    scene.add(s1);
  }

  // -- 地面散落积木装饰（box + 圆柱 + 堆叠）---------------------------------
  const decoColors = ['#EF4444', '#3B82F6', '#22C55E', '#FBBF24', '#A855F7', '#F97316', '#EC4899', '#14B8A6', '#F59E0B'];
  const decoBoxGeo = new BoxGeometry(1, 1, 1);
  const decoCylGeo = new CylinderGeometry(0.5, 0.5, 1, 12);
  sceneryGeometries.push(decoBoxGeo, decoCylGeo);

  type DecoItem = { pos: [number, number, number]; size: [number, number, number]; yaw: number; ci: number; shape?: 'box' | 'cyl' };
  const decoItems: DecoItem[] = [
    { pos: [-12, FLOOR_SURFACE_Y + 0.22, 8],   size: [1.4, 0.44, 0.9],  yaw: 0.3,  ci: 0 },
    { pos: [14,  FLOOR_SURFACE_Y + 0.18, 5],   size: [0.9, 0.36, 1.8],  yaw: -0.5, ci: 1 },
    { pos: [-8,  FLOOR_SURFACE_Y + 0.22, 16],  size: [1.1, 0.44, 1.1],  yaw: 0.8,  ci: 2 },
    { pos: [18,  FLOOR_SURFACE_Y + 0.22, -6],  size: [1.6, 0.44, 0.7],  yaw: 1.1,  ci: 3 },
    { pos: [-16, FLOOR_SURFACE_Y + 0.18, -4],  size: [0.9, 0.36, 1.4],  yaw: -0.2, ci: 4 },
    { pos: [6,   FLOOR_SURFACE_Y + 0.22, -12], size: [1.1, 0.44, 0.9],  yaw: 0.6,  ci: 5 },
    { pos: [-14, FLOOR_SURFACE_Y + 0.22, -14], size: [1.4, 0.44, 1.4],  yaw: -0.9, ci: 6 },
    { pos: [10,  FLOOR_SURFACE_Y + 0.18, 18],  size: [0.7, 0.36, 1.1],  yaw: 0.4,  ci: 7 },
    { pos: [-20, FLOOR_SURFACE_Y + 0.22, 2],   size: [1.1, 0.44, 0.7],  yaw: -0.7, ci: 8 },
    { pos: [16,  FLOOR_SURFACE_Y + 0.22, -16], size: [0.9, 0.36, 0.9],  yaw: 1.3,  ci: 0 },
    { pos: [-4,  FLOOR_SURFACE_Y + 0.22, 22],  size: [1.8, 0.44, 0.7],  yaw: 0.15, ci: 1 },
    { pos: [22,  FLOOR_SURFACE_Y + 0.18, 10],  size: [0.9, 0.36, 1.6],  yaw: -0.4, ci: 2 },
    { pos: [-28, FLOOR_SURFACE_Y + 0.22, 12],  size: [1.6, 0.44, 1.0],  yaw: 0.7,  ci: 3 },
    { pos: [26,  FLOOR_SURFACE_Y + 0.22, -20], size: [1.2, 0.44, 1.2],  yaw: -1.2, ci: 4 },
    { pos: [-24, FLOOR_SURFACE_Y + 0.22, -22], size: [2.0, 0.44, 0.8],  yaw: 0.5,  ci: 5 },
    { pos: [30,  FLOOR_SURFACE_Y + 0.22, 18],  size: [0.8, 0.44, 1.6],  yaw: 1.0,  ci: 6 },
    { pos: [8,   FLOOR_SURFACE_Y + 0.22, -28], size: [1.4, 0.44, 1.0],  yaw: -0.3, ci: 7 },
    { pos: [-30, FLOOR_SURFACE_Y + 0.22, 28],  size: [1.0, 0.44, 1.8],  yaw: 0.9,  ci: 8 },
    { pos: [-10, FLOOR_SURFACE_Y + 0.35, 24],  size: [0.7, 0.7, 3.2],   yaw: -0.4, ci: 0, shape: 'cyl' },
    { pos: [20,  FLOOR_SURFACE_Y + 0.28, -10], size: [0.6, 0.6, 2.6],   yaw: 1.1,  ci: 3, shape: 'cyl' },
    { pos: [-22, FLOOR_SURFACE_Y + 0.3,  18],  size: [0.8, 0.8, 2.0],   yaw: 0.6,  ci: 5, shape: 'cyl' },
    { pos: [28,  FLOOR_SURFACE_Y + 0.28, 8],   size: [0.65, 0.65, 2.8], yaw: -0.8, ci: 2, shape: 'cyl' },
    { pos: [-12, FLOOR_SURFACE_Y + 0.64, 8],   size: [1.0, 0.44, 0.7],  yaw: 0.6,  ci: 2 },
    { pos: [14,  FLOOR_SURFACE_Y + 0.54, 5],   size: [0.7, 0.36, 1.2],  yaw: -0.2, ci: 5 },
    { pos: [18,  FLOOR_SURFACE_Y + 0.64, -6],  size: [1.0, 0.44, 0.5],  yaw: 0.3,  ci: 6 },
  ];

  for (const item of decoItems) {
    const ci = item.ci % decoColors.length;
    const mat = new MeshStandardMaterial({ color: decoColors[ci], roughness: 0.6, metalness: 0.05 });
    sceneryMaterials.push(mat);
    const geo = item.shape === 'cyl' ? decoCylGeo : decoBoxGeo;
    const mesh = new Mesh(geo, mat);
    mesh.position.set(item.pos[0], item.pos[1], item.pos[2]);
    if (item.shape === 'cyl') {
      mesh.rotation.set(0, item.yaw, Math.PI / 2);
      mesh.scale.set(item.size[0], item.size[2], item.size[1]);
    } else {
      mesh.rotation.y = item.yaw;
      mesh.scale.set(item.size[0], item.size[1], item.size[2]);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

"@

$newLines = $before + ($newBlock -split "`r?`n") + $after
[System.IO.File]::WriteAllLines($file, $newLines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. Total lines: $($newLines.Count)"
