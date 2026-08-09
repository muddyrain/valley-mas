import type { Material, Object3D, Texture, WebGLRenderer } from 'three';

const TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const;

export function disposeObject3D(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const candidate = object as Object3D & {
      geometry?: { dispose: () => void };
      material?: Material | Material[];
    };
    if (candidate.geometry) geometries.add(candidate.geometry);
    const objectMaterials = Array.isArray(candidate.material)
      ? candidate.material
      : candidate.material
        ? [candidate.material]
        : [];
    for (const material of objectMaterials) {
      materials.add(material);
      const materialRecord = material as unknown as Record<string, unknown>;
      for (const key of TEXTURE_KEYS) {
        const texture = materialRecord[key];
        if (texture && typeof texture === 'object' && 'dispose' in texture) {
          textures.add(texture as Texture);
        }
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

export function releaseRenderer(renderer: WebGLRenderer): void {
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
}
