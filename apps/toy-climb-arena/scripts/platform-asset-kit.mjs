import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoxGeometry, Color, CylinderGeometry, Mesh, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const outputDir = resolve(appRoot, 'assets/models/platforms');

class NodeFileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      this.onloadend?.();
    });
  }
}

if (!globalThis.FileReader) {
  globalThis.FileReader = NodeFileReader;
}

export function material(color, roughness = 0.46, metalness = 0.06) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness,
    metalness,
  });
}

export function addMesh(group, geometry, mat, position, rotation = [0, 0, 0], options = {}) {
  const mesh = new Mesh(geometry, mat);
  mesh.name = options.name ?? `solid_${group.children.length + 1}`;
  mesh.userData = {
    collisionShape: options.collisionShape ?? 'box',
  };
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function addBox(group, size, mat, position, rotation = [0, 0, 0], options = {}) {
  return addMesh(
    group,
    new BoxGeometry(size[0], size[1], size[2]),
    mat,
    position,
    rotation,
    options,
  );
}

export function addDecorBox(group, size, mat, position, rotation = [0, 0, 0], options = {}) {
  return addBox(group, size, mat, position, rotation, {
    collisionShape: 'none',
    ...options,
  });
}

export function addCylinder(
  group,
  radius,
  height,
  segments,
  mat,
  position,
  rotation = [0, 0, 0],
  options = {},
) {
  return addMesh(
    group,
    new CylinderGeometry(radius, radius, height, segments),
    mat,
    position,
    rotation,
    { collisionShape: 'cylinder', ...options },
  );
}

export function addDecorCylinder(
  group,
  radius,
  height,
  segments,
  mat,
  position,
  rotation = [0, 0, 0],
  options = {},
) {
  return addCylinder(group, radius, height, segments, mat, position, rotation, {
    collisionShape: 'none',
    ...options,
  });
}

export async function exportGlb(group, fileName) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(group, {
    binary: true,
    trs: false,
    onlyVisible: true,
  });
  const outputPath = resolve(outputDir, fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`generated ${outputPath}`);
}
