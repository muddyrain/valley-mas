import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CatmullRomCurve3,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

class NodeFileReader {
  result = null;
  onloadend = null;

  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }

  async readAsDataURL(blob) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
    this.onloadend?.();
  }
}

globalThis.FileReader ??= NodeFileReader;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(scriptDirectory, '../src/assets/yuji-stage/yuji-inflated.glb');

function tube(points, radius = 0.235) {
  const path = new CatmullRomCurve3(
    points.map(([x, y, z = 0]) => new Vector3(x, y, z)),
    false,
    'centripetal',
    0.45,
  );
  return new TubeGeometry(path, Math.max(48, points.length * 12), radius, 18, false);
}

function sphere(x, y, radius = 0.235, z = 0) {
  const geometry = new SphereGeometry(radius, 24, 18);
  geometry.translate(x, y, z);
  return geometry;
}

const yBowl = [
  [-2.65, 0.92],
  [-2.63, 0.42],
  [-2.56, 0.02],
  [-2.35, -0.2],
  [-2.08, -0.18],
  [-1.88, 0.08],
  [-1.78, 0.52],
  [-1.75, 0.92],
];
const yTail = [
  [-1.75, 0.92],
  [-1.73, 0.35],
  [-1.79, -0.18],
  [-1.95, -0.7],
  [-2.22, -1.03],
  [-2.54, -1.13],
];
const uStroke = [
  [-1.38, 0.88],
  [-1.37, 0.34],
  [-1.3, -0.06],
  [-1.08, -0.24],
  [-0.8, -0.19],
  [-0.62, 0.05],
  [-0.55, 0.47],
  [-0.52, 0.88],
];
const jStroke = [
  [0.12, 0.83],
  [0.11, 0.32],
  [0.09, -0.25],
  [0.01, -0.68],
  [-0.2, -0.9],
  [-0.47, -0.88],
];
const iStroke = [
  [0.82, 0.78],
  [0.82, 0.37],
  [0.84, -0.08],
  [0.96, -0.2],
  [1.12, -0.15],
];

const strokes = [yBowl, yTail, uStroke, jStroke, iStroke];
const parts = [
  ...strokes.map((stroke) => tube(stroke)),
  ...strokes.flatMap((stroke) => {
    const start = stroke[0];
    const end = stroke.at(-1);
    return [sphere(start[0], start[1]), sphere(end[0], end[1])];
  }),
  sphere(0.14, 1.3, 0.19, 0.02),
  sphere(0.82, 1.24, 0.18, 0.02),
];

const mergedGeometry = mergeGeometries(parts, false);
if (!mergedGeometry) throw new Error('Unable to merge the Yuji wordmark geometry.');
const geometry = mergeVertices(mergedGeometry, 1e-4);
mergedGeometry.dispose();
geometry.computeBoundingBox();
const bounds = geometry.boundingBox;
if (bounds) {
  geometry.translate(
    -(bounds.min.x + bounds.max.x) / 2,
    -(bounds.min.y + bounds.max.y) / 2,
    -(bounds.min.z + bounds.max.z) / 2,
  );
}
geometry.computeVertexNormals();
geometry.computeBoundingSphere();
parts.forEach((part) => {
  part.dispose();
});

const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: 0xffffff }));
mesh.name = 'yuji_inflated_wordmark';
const gltf = await new GLTFExporter().parseAsync(mesh, {
  binary: true,
  onlyVisible: true,
  trs: false,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(gltf));
geometry.dispose();
mesh.material.dispose();
console.log(`Generated ${outputPath}`);
