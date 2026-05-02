import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  TorusGeometry,
} from 'three';
import type { ResolvedToyPlatformProfile } from '../platformCatalog';

interface ToyPlatformVisualOptions {
  scene: Scene;
  platformId: string;
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  isGoal: boolean;
  isIcy: boolean;
  isCrumble: boolean;
  isConveyor: boolean;
  isBouncy: boolean;
  isUnstable: boolean;
  isBlink: boolean;
  isRotating: boolean;
  profile: ResolvedToyPlatformProfile;
}

export interface ToyPlatformVisualResult {
  detailMeshes: Mesh[];
  materials: MeshStandardMaterial[];
  geometries: BufferGeometry[];
}

function mixColor(color: string, target: string, ratio: number): Color {
  return new Color(color).lerp(new Color(target), ratio);
}

function resolveZoneTint(themeZone: ResolvedToyPlatformProfile['themeZone']): {
  top: string;
  trim: string;
  accent: string;
} {
  switch (themeZone) {
    case 'barn':
      return { top: '#FFF7ED', trim: '#7C2D12', accent: '#F97316' };
    case 'castle':
      return { top: '#F8FAFC', trim: '#334155', accent: '#38BDF8' };
    case 'sky_island':
      return { top: '#ECFEFF', trim: '#3730A3', accent: '#A78BFA' };
    case 'olympus':
      return { top: '#FFF7ED', trim: '#92400E', accent: '#FACC15' };
    case 'workshop':
      return { top: '#FEF3C7', trim: '#3F3F46', accent: '#22C55E' };
  }
}

function makeMaterial(params: {
  color: Color | string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissive?: Color | string;
  emissiveIntensity?: number;
}): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: params.color,
    roughness: params.roughness ?? 0.48,
    metalness: params.metalness ?? 0.08,
    emissive: params.emissive ?? new Color(0),
    emissiveIntensity: params.emissiveIntensity ?? 0,
  });
  if (params.opacity != null && params.opacity < 1) {
    material.transparent = true;
    material.opacity = params.opacity;
    material.depthWrite = false;
  }
  return material;
}

function rememberOrigin(mesh: Mesh): void {
  mesh.userData = {
    ...mesh.userData,
    bumpOriginX: mesh.position.x,
    bumpOriginY: mesh.position.y,
    bumpOriginZ: mesh.position.z,
    bumpOriginRotationY: mesh.rotation.y,
    bumpOriginRotationZ: mesh.rotation.z,
  };
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function createToyPlatformVisuals(
  options: ToyPlatformVisualOptions,
): ToyPlatformVisualResult {
  const { scene, size, position, color } = options;
  const { profile } = options;
  const variantSeed = hashText(profile.visualVariant);
  const [width, height, depth] = size;
  const [x, y, z] = position;
  const topY = y + height / 2;
  const isStartPlatform = options.platformId === 'start';
  const isSquareSurface =
    (profile.kind === 'square_plate' || profile.kind === 'stacked_steps') && !isStartPlatform;
  const isRoundSurface = profile.kind === 'round_disc' || profile.kind === 'balance_pole';
  const isNarrowSurface = profile.kind === 'narrow_plank';
  const usesDedicatedStaticSurface = isSquareSurface || isRoundSurface || isNarrowSurface;
  const detailMeshes: Mesh[] = [];
  const materials: MeshStandardMaterial[] = [];
  const geometries: BufferGeometry[] = [];

  const addMaterial = (material: MeshStandardMaterial) => {
    materials.push(material);
    return material;
  };

  const addMesh = (
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    px: number,
    py: number,
    pz: number,
  ) => {
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rememberOrigin(mesh);
    scene.add(mesh);
    detailMeshes.push(mesh);
    return mesh;
  };

  const baseColor = new Color(color);
  const zoneTint = resolveZoneTint(profile.themeZone);
  const trimColor = options.isGoal
    ? new Color('#F97316')
    : options.isIcy
      ? new Color('#7DD3FC')
      : mixColor(color, zoneTint.trim, 0.2);
  const topColor = options.isGoal
    ? new Color('#FDE68A')
    : options.isIcy
      ? new Color('#DBEAFE')
      : mixColor(color, zoneTint.top, 0.26);
  const accentColor = options.isConveyor
    ? new Color('#FACC15')
    : options.isCrumble
      ? new Color('#78350F')
      : options.isUnstable
        ? new Color('#FB7185')
        : options.isBlink
          ? new Color('#A78BFA')
          : options.isRotating
            ? new Color('#38BDF8')
            : mixColor(color, zoneTint.accent, 0.44);

  const topMat = addMaterial(
    makeMaterial({
      color: topColor,
      roughness: options.isIcy ? 0.08 : 0.42,
      metalness: options.isIcy ? 0.38 : 0.06,
      opacity: options.isBlink ? 0.88 : 1,
    }),
  );
  const trimMat = addMaterial(
    makeMaterial({
      color: trimColor,
      roughness: 0.5,
      metalness: options.isConveyor || options.isRotating ? 0.22 : 0.08,
    }),
  );
  const studMat = addMaterial(
    makeMaterial({
      color: mixColor(color, options.isIcy ? '#FFFFFF' : '#111827', options.isIcy ? 0.18 : 0.12),
      roughness: 0.38,
      metalness: options.isIcy ? 0.22 : 0.06,
    }),
  );
  const accentMat = addMaterial(
    makeMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: options.isConveyor || options.isRotating ? 0.32 : 0.08,
      emissive: options.isGoal ? '#F59E0B' : options.isBlink ? '#7C3AED' : new Color(0),
      emissiveIntensity: options.isGoal ? 0.22 : options.isBlink ? 0.08 : 0,
    }),
  );
  const softHighlightMat = addMaterial(
    makeMaterial({
      color: mixColor(color, zoneTint.top, 0.5),
      roughness: 0.5,
      metalness: 0.04,
      opacity: 0.78,
    }),
  );

  const insetW = Math.max(0.8, width - 0.45);
  const insetD = Math.max(0.8, depth - 0.45);
  if (!usesDedicatedStaticSurface && !isStartPlatform) {
    addMesh(new BoxGeometry(insetW, 0.045, insetD), topMat, x, topY + 0.034, z);
  }

  const railH = Math.min(0.22, Math.max(0.11, height * 0.18));
  const railT = 0.18;
  if (!usesDedicatedStaticSurface && !isStartPlatform) {
    addMesh(
      new BoxGeometry(width + 0.08, railH, railT),
      trimMat,
      x,
      topY + railH * 0.5,
      z - depth / 2 + railT * 0.5,
    );
    addMesh(
      new BoxGeometry(width + 0.08, railH, railT),
      trimMat,
      x,
      topY + railH * 0.5,
      z + depth / 2 - railT * 0.5,
    );
    addMesh(
      new BoxGeometry(railT, railH, depth + 0.08),
      trimMat,
      x - width / 2 + railT * 0.5,
      topY + railH * 0.5,
      z,
    );
    addMesh(
      new BoxGeometry(railT, railH, depth + 0.08),
      trimMat,
      x + width / 2 - railT * 0.5,
      topY + railH * 0.5,
      z,
    );
  }

  const studRadius = Math.min(0.26, Math.max(0.16, Math.min(width, depth) * 0.045));
  if (!usesDedicatedStaticSurface && !isStartPlatform) {
    const studCols = Math.min(6, Math.max(2, Math.floor(width / 3)));
    const studRows = Math.min(5, Math.max(2, Math.floor(depth / 3)));
    const usableW = Math.max(0.1, width - 1.35);
    const usableD = Math.max(0.1, depth - 1.35);
    const startX = x - usableW / 2;
    const startZ = z - usableD / 2;
    const stepX = studCols > 1 ? usableW / (studCols - 1) : 0;
    const stepZ = studRows > 1 ? usableD / (studRows - 1) : 0;
    for (let col = 0; col < studCols; col += 1) {
      for (let row = 0; row < studRows; row += 1) {
        addMesh(
          new CylinderGeometry(studRadius, studRadius, 0.13, 12),
          studMat,
          studCols > 1 ? startX + stepX * col : x,
          topY + 0.12,
          studRows > 1 ? startZ + stepZ * row : z,
        );
      }
    }
  }

  if (!usesDedicatedStaticSurface && !isStartPlatform) {
    const sidePanelCount = Math.min(5, Math.max(2, Math.floor(width / 4)));
    for (let i = 0; i < sidePanelCount; i += 1) {
      const px = x - width / 2 + ((i + 0.5) * width) / sidePanelCount;
      addMesh(
        new BoxGeometry(Math.max(0.46, width / sidePanelCount - 0.22), 0.12, 0.055),
        accentMat,
        px,
        y,
        z + depth / 2 + 0.036,
      );
      addMesh(
        new BoxGeometry(Math.max(0.46, width / sidePanelCount - 0.22), 0.12, 0.055),
        accentMat,
        px,
        y,
        z - depth / 2 - 0.036,
      );
    }
  }

  if (isSquareSurface) {
    addMesh(new BoxGeometry(width * 0.92, 0.075, depth * 0.92), topMat, x, topY + 0.078, z);

    const panelCols = Math.min(4, Math.max(1, Math.floor(width / 5)));
    const panelRows = Math.min(3, Math.max(1, Math.floor(depth / 5)));
    const panelW = Math.max(0.5, (width - 1.1) / panelCols);
    const panelD = Math.max(0.5, (depth - 1.1) / panelRows);
    for (let col = 0; col < panelCols; col += 1) {
      for (let row = 0; row < panelRows; row += 1) {
        const isRaised = (col + row + variantSeed) % 2 === 0;
        const panel = addMesh(
          new BoxGeometry(panelW * 0.82, 0.032, panelD * 0.82),
          isRaised ? softHighlightMat : accentMat,
          x - (width - 1.1) / 2 + panelW * (col + 0.5),
          topY + 0.205 + (isRaised ? 0.006 : 0),
          z - (depth - 1.1) / 2 + panelD * (row + 0.5),
        );
        panel.rotation.y = (((variantSeed + col * 3 + row) % 3) - 1) * 0.015;
        rememberOrigin(panel);
      }
    }

    const cornerInset = 0.46;
    const cornerRadius = 0.14;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addMesh(
          new CylinderGeometry(cornerRadius, cornerRadius, 0.08, 10),
          accentMat,
          x + sx * (width / 2 - cornerInset),
          topY + 0.245,
          z + sz * (depth / 2 - cornerInset),
        );
      }
    }
  }

  if (options.isConveyor) {
    const arrowCount = Math.min(4, Math.max(2, Math.floor(Math.max(width, depth) / 5)));
    for (let i = 0; i < arrowCount; i += 1) {
      const offset = (i - (arrowCount - 1) / 2) * 1.25;
      const barA = addMesh(
        new BoxGeometry(0.72, 0.05, 0.16),
        accentMat,
        x + offset,
        topY + 0.18,
        z,
      );
      const barB = addMesh(
        new BoxGeometry(0.72, 0.05, 0.16),
        accentMat,
        x + offset,
        topY + 0.18,
        z,
      );
      barA.rotation.y = Math.PI * 0.25;
      barB.rotation.y = -Math.PI * 0.25;
      rememberOrigin(barA);
      rememberOrigin(barB);
    }
  }

  if (options.isCrumble) {
    for (let i = 0; i < 4; i += 1) {
      const crack = addMesh(
        new BoxGeometry(Math.min(width * 0.62, 2.2), 0.035, 0.055),
        accentMat,
        x + (i - 1.5) * 0.32,
        topY + 0.19 + i * 0.002,
        z + (i % 2 === 0 ? -0.32 : 0.28),
      );
      crack.rotation.y = (i % 2 === 0 ? 0.28 : -0.42) + i * 0.12;
      rememberOrigin(crack);
    }
  }

  if (options.isRotating) {
    addMesh(new CylinderGeometry(0.38, 0.38, 0.16, 18), accentMat, x, topY + 0.23, z);
    const armLength = Math.min(Math.max(width, depth) * 0.38, 2.6);
    addMesh(new BoxGeometry(armLength, 0.07, 0.16), accentMat, x, topY + 0.25, z);
    const armB = addMesh(new BoxGeometry(armLength, 0.07, 0.16), accentMat, x, topY + 0.25, z);
    armB.rotation.y = Math.PI / 2;
    rememberOrigin(armB);
  }

  if (isRoundSurface) {
    const discRadius = Math.min(width, depth) * 0.42;
    const discTop = addMesh(
      new CylinderGeometry(discRadius, discRadius, 0.11, 32),
      softHighlightMat,
      x,
      topY + 0.215,
      z,
    );
    discTop.rotation.y = (variantSeed % 8) * (Math.PI / 16);
    rememberOrigin(discTop);
    addMesh(new TorusGeometry(discRadius * 0.86, 0.055, 8, 32), accentMat, x, topY + 0.28, z);
    addMesh(new CylinderGeometry(0.22, 0.22, 0.1, 18), accentMat, x, topY + 0.33, z);
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6 + (variantSeed % 4) * 0.08;
      addMesh(
        new CylinderGeometry(0.055, 0.055, 0.075, 8),
        studMat,
        x + Math.cos(angle) * discRadius * 0.58,
        topY + 0.35,
        z + Math.sin(angle) * discRadius * 0.58,
      );
    }
  }

  if (isNarrowSurface) {
    const rungCount = Math.min(6, Math.max(2, Math.floor(Math.max(width, depth) / 2)));
    const alongX = width >= depth;
    const railLength = Math.max(width, depth) * 0.94;
    const railOffset = Math.min(width, depth) * 0.34;
    addMesh(
      new BoxGeometry(
        alongX ? railLength : Math.min(width * 0.72, 0.9),
        0.07,
        alongX ? Math.min(depth * 0.72, 0.9) : railLength,
      ),
      topMat,
      x,
      topY + 0.08,
      z,
    );
    addMesh(
      new BoxGeometry(alongX ? railLength : 0.075, 0.08, alongX ? 0.075 : railLength),
      trimMat,
      x + (alongX ? 0 : -railOffset),
      topY + 0.25,
      z + (alongX ? -railOffset : 0),
    );
    addMesh(
      new BoxGeometry(alongX ? railLength : 0.075, 0.08, alongX ? 0.075 : railLength),
      trimMat,
      x + (alongX ? 0 : railOffset),
      topY + 0.25,
      z + (alongX ? railOffset : 0),
    );
    for (let i = 0; i < rungCount; i += 1) {
      const offset = (i - (rungCount - 1) / 2) * 0.75;
      addMesh(
        new BoxGeometry(
          alongX ? 0.08 : Math.min(width * 0.72, 0.9),
          0.055,
          alongX ? Math.min(depth * 0.72, 0.9) : 0.08,
        ),
        accentMat,
        x + (alongX ? offset : 0),
        topY + 0.22,
        z + (alongX ? 0 : offset),
      );
    }
    const markerCount = Math.min(5, Math.max(2, Math.floor(Math.max(width, depth) / 3)));
    for (let i = 0; i < markerCount; i += 1) {
      const offset = (i - (markerCount - 1) / 2) * 1.05;
      addMesh(
        new CylinderGeometry(0.07, 0.07, 0.05, 8),
        softHighlightMat,
        x + (alongX ? offset : 0),
        topY + 0.31,
        z + (alongX ? 0 : offset),
      );
    }
  }

  if (profile.kind === 'irregular_fragment') {
    for (let i = 0; i < 3; i += 1) {
      const shard = addMesh(
        new BoxGeometry(Math.min(width * 0.34, 1.3), 0.06, 0.12),
        accentMat,
        x + (i - 1) * Math.min(width * 0.18, 0.8),
        topY + 0.23,
        z + (i % 2 === 0 ? -0.34 : 0.3),
      );
      shard.rotation.y = 0.35 + i * 0.42;
      rememberOrigin(shard);
    }
  }

  if (options.isBouncy) {
    const ringCount = 3;
    for (let i = 0; i < ringCount; i += 1) {
      const ring = addMesh(
        new TorusGeometry(0.46 + i * 0.06, 0.035, 8, 22),
        accentMat,
        x,
        topY + 0.17 + i * 0.12,
        z,
      );
      ring.rotation.x = Math.PI / 2;
      rememberOrigin(ring);
    }
  }

  if (options.isGoal) {
    const crownBase = addMesh(
      new CylinderGeometry(0.9, 0.9, 0.16, 24),
      accentMat,
      x,
      topY + 0.25,
      z,
    );
    crownBase.rotation.y = Math.PI / 8;
    rememberOrigin(crownBase);
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      addMesh(
        new CylinderGeometry(0.11, 0.16, 0.34, 10),
        accentMat,
        x + Math.cos(angle) * 0.72,
        topY + 0.48,
        z + Math.sin(angle) * 0.72,
      );
    }
  }

  if (options.isIcy) {
    const glossMat = addMaterial(
      makeMaterial({
        color: new Color('#FFFFFF'),
        roughness: 0.02,
        metalness: 0.15,
        opacity: 0.28,
      }),
    );
    const streakCount = Math.min(5, Math.max(2, Math.floor(width / 4)));
    for (let i = 0; i < streakCount; i += 1) {
      const streak = addMesh(
        new BoxGeometry(Math.min(width * 0.38, 2.4), 0.025, 0.04),
        glossMat,
        x - width * 0.28 + (i * width * 0.56) / Math.max(1, streakCount - 1),
        topY + 0.205,
        z + (i % 2 === 0 ? -depth * 0.18 : depth * 0.16),
      );
      streak.rotation.y = -0.25;
      rememberOrigin(streak);
    }
  }

  if (isStartPlatform) {
    const startMat = addMaterial(
      makeMaterial({
        color: mixColor(color, '#22C55E', 0.45),
        roughness: 0.55,
        metalness: 0.04,
      }),
    );
    addMesh(
      new BoxGeometry(Math.min(width * 0.5, 8), 0.052, Math.min(depth * 0.28, 3.4)),
      startMat,
      x,
      topY + 0.078,
      z,
    );
  }

  // Make very large surfaces feel like assembled toy plates instead of flat slabs.
  if ((width > 8 || depth > 8) && !usesDedicatedStaticSurface && !isStartPlatform) {
    const seamMat = addMaterial(
      makeMaterial({
        color: mixColor(color, '#000000', 0.22),
        roughness: 0.62,
        metalness: 0.04,
      }),
    );
    const seamW = Math.max(1, width - 1.2);
    const seamD = Math.max(1, depth - 1.2);
    if (depth > 8) addMesh(new BoxGeometry(seamW, 0.028, 0.035), seamMat, x, topY + 0.215, z);
    if (width > 8) addMesh(new BoxGeometry(0.035, 0.028, seamD), seamMat, x, topY + 0.216, z);
  }

  // Slight underside lip gives the platform a molded-toy silhouette.
  const undersideMat = addMaterial(
    makeMaterial({
      color: baseColor.clone().lerp(new Color('#111827'), 0.32),
      roughness: 0.58,
      metalness: 0.08,
    }),
  );
  addMesh(
    new BoxGeometry(width * 0.94, 0.08, depth * 0.94),
    undersideMat,
    x,
    y - height / 2 + 0.05,
    z,
  );

  return { detailMeshes, materials, geometries };
}
