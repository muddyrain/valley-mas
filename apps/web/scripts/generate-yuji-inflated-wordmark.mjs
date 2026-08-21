import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mesh, MeshBasicMaterial } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  : resolve(scriptDirectory, '../src/assets/yuji-stage/muddyrain-inflated.glb');
const fontPath = fileURLToPath(
  import.meta.resolve('three/examples/fonts/optimer_bold.typeface.json'),
);
const font = new FontLoader().parse(JSON.parse(await readFile(fontPath, 'utf8')));
const textGeometry = new TextGeometry('muddyrain', {
  bevelEnabled: true,
  bevelOffset: -0.018,
  bevelSegments: 2,
  bevelSize: 0.055,
  bevelThickness: 0.12,
  curveSegments: 4,
  depth: 0.32,
  font,
  size: 1.32,
});
const geometry = mergeVertices(textGeometry, 1e-4);
textGeometry.dispose();

geometry.center();
geometry.computeBoundingBox();
const bounds = geometry.boundingBox;
const width = bounds ? bounds.max.x - bounds.min.x : 1;
geometry.scale(7.4 / Math.max(width, 1), 1, 1);
geometry.computeVertexNormals();
geometry.computeBoundingBox();
geometry.computeBoundingSphere();

const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: 0xffffff }));
mesh.name = 'muddyrain_inflated_wordmark';
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
