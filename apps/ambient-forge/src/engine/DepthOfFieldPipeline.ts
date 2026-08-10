import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export interface DepthOfFieldBackend {
  resize: (width: number, height: number, pixelRatio: number) => void;
  render: (focusDistance: number) => void;
  dispose: () => void;
}

export type DepthOfFieldLoader = () => Promise<DepthOfFieldBackend>;

const POSTPROCESSING_RESOLUTION_SCALE = 0.5;

export class LazyDepthOfFieldPipeline {
  private backend: DepthOfFieldBackend | null = null;
  private loading: Promise<void> | null = null;
  private enabled = false;
  private generation = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  constructor(private readonly loader: DepthOfFieldLoader) {}

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.max(0.5, pixelRatio * POSTPROCESSING_RESOLUTION_SCALE);
    this.backend?.resize(this.width, this.height, this.pixelRatio);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (!enabled) {
      this.enabled = false;
      this.generation += 1;
      this.backend?.dispose();
      this.backend = null;
      return;
    }

    if (!this.enabled) this.generation += 1;
    this.enabled = true;
    await this.ensureBackend();
  }

  render(focusDistance: number): boolean {
    if (!this.enabled || !this.backend) return false;
    this.backend.render(focusDistance);
    return true;
  }

  dispose(): void {
    this.enabled = false;
    this.generation += 1;
    this.backend?.dispose();
    this.backend = null;
  }

  private async ensureBackend(): Promise<void> {
    if (this.backend) return;
    if (this.loading) {
      await this.loading;
      if (this.enabled && !this.backend) await this.ensureBackend();
      return;
    }

    const generation = this.generation;
    this.loading = this.loader()
      .then((backend) => {
        if (!this.enabled || generation !== this.generation) {
          backend.dispose();
          return;
        }
        this.backend = backend;
        backend.resize(this.width, this.height, this.pixelRatio);
      })
      .finally(() => {
        this.loading = null;
      });
    await this.loading;
  }
}

export async function createThreeDepthOfFieldBackend(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): Promise<DepthOfFieldBackend> {
  const [{ EffectComposer }, { RenderPass }, { BokehPass }] = await Promise.all([
    import('three/examples/jsm/postprocessing/EffectComposer.js'),
    import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/BokehPass.js'),
  ]);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokehPass = new BokehPass(scene, camera, {
    focus: 24,
    aperture: 0.000035,
    maxblur: 0.008,
  });
  composer.addPass(bokehPass);

  return {
    resize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    render(focusDistance) {
      const uniforms = bokehPass.uniforms as { focus: { value: number } };
      uniforms.focus.value = focusDistance;
      composer.render();
    },
    dispose() {
      bokehPass.dispose();
      composer.dispose();
    },
  };
}
