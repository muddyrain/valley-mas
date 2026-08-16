import {
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { LiquidRainFrame } from './liquidRainProgress';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uProgress;
  uniform float uRefraction;
  uniform float uImageVisibility;
  uniform float uAtmosphere;
  uniform float uPortraitFrost;
  uniform float uTransitionBridge;
  uniform float uPaperReveal;
  uniform float uPointerStrength;
  uniform float uDark;
  uniform vec2 uPointer;
  uniform vec2 uResolution;
  uniform sampler2D uTexture0;
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform sampler2D uTexture3;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  float membraneHeight(vec2 uv) {
    float slowWave = sin(uv.x * 11.0 + uTime * 0.23) * 0.42;
    slowWave += sin(uv.y * 8.0 - uTime * 0.17) * 0.34;
    slowWave += (noise(uv * 5.0 + uTime * 0.035) - 0.5) * 1.1;
    float pointerDistance = distance(uv, uPointer);
    float indentation = exp(-pointerDistance * pointerDistance * 54.0) * uPointerStrength * 1.35;
    float pressureRing = sin(pointerDistance * 58.0 - uTime * 7.0)
      * exp(-pointerDistance * 9.0)
      * uPointerStrength
      * 0.34;
    return slowWave + indentation + pressureRing;
  }

  vec4 sampleBlurred(sampler2D image, vec2 uv, vec2 offset) {
    vec4 color = texture2D(image, uv) * 0.36;
    color += texture2D(image, uv + vec2(offset.x, 0.0)) * 0.16;
    color += texture2D(image, uv - vec2(offset.x, 0.0)) * 0.16;
    color += texture2D(image, uv + vec2(0.0, offset.y)) * 0.16;
    color += texture2D(image, uv - vec2(0.0, offset.y)) * 0.16;
    return color;
  }

  vec2 coverUv(vec2 uv) {
    float viewportAspect = uResolution.x / max(uResolution.y, 1.0);
    const float imageAspect = 1.7777778;
    vec2 scale = vec2(1.0);
    if (viewportAspect > imageAspect) {
      scale.y = imageAspect / viewportAspect;
    } else {
      scale.x = viewportAspect / imageAspect;
    }
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 pixel = 1.0 / max(uResolution, vec2(1.0));
    float height = membraneHeight(vUv);
    float heightX = membraneHeight(vUv + vec2(pixel.x * 3.0, 0.0));
    float heightY = membraneHeight(vUv + vec2(0.0, pixel.y * 3.0));
    vec2 normal = vec2(heightX - height, heightY - height) * 6.5;
    vec2 refractionOffset = normal
      * (mix(0.014, 0.058, uRefraction) + uPortraitFrost * 0.012 + uTransitionBridge * 0.024);
    vec2 refractedUv = clamp(coverUv(vUv + refractionOffset), 0.002, 0.998);
    float blurRadius = mix(10.0, 3.0, uRefraction)
      + uPortraitFrost * 6.0
      + uTransitionBridge * 8.0;
    vec2 blurOffset = pixel * blurRadius;

    vec4 image0 = sampleBlurred(uTexture0, refractedUv, blurOffset);
    vec4 image1 = sampleBlurred(uTexture1, refractedUv, blurOffset);
    vec4 image2 = sampleBlurred(uTexture2, refractedUv, blurOffset);
    vec4 image3 = sampleBlurred(uTexture3, refractedUv, blurOffset);
    vec4 image = mix(image0, image1, smoothstep(0.12, 0.34, uProgress));
    image = mix(image, image3, smoothstep(0.38, 0.58, uProgress));
    image = mix(image, image2, step(0.79, uProgress));

    vec3 deepInk = vec3(0.086, 0.106, 0.106);
    vec3 rain = vec3(0.612, 0.725, 0.702);
    float materialLight = smoothstep(-0.42, 0.72, height) * 0.11;
    float edge = pow(clamp(abs(normal.x) + abs(normal.y), 0.0, 1.0), 1.7);
    float pointerDistance = distance(vUv, uPointer);
    float pointerGlow = exp(-pointerDistance * 9.0) * uPointerStrength;
    float pointerRim = exp(-pow((pointerDistance - 0.105) * 32.0, 2.0)) * uPointerStrength;
    vec3 membrane = deepInk + rain * (edge * 0.28 + materialLight * 0.22 + pointerGlow * 0.16);
    float imageVisibility = uImageVisibility
      * (1.0 - uPortraitFrost * 0.38)
      * (1.0 - uTransitionBridge * 0.9);
    vec3 color = mix(membrane, image.rgb * vec3(0.9, 0.95, 0.96), imageVisibility);
    color += rain * edge * mix(0.08, 0.3, uRefraction);
    color += rain * pointerRim * 0.18;

    float rainCell = floor(vUv.x * 24.0);
    float rainSeed = hash(vec2(rainCell, 7.0));
    float rainDrift = noise(vec2(floor(vUv.y * 8.0), rainSeed * 11.0)) * 0.24;
    float rainLineX = abs(fract(vUv.x * 24.0 + rainDrift + rainSeed * 0.62) - 0.5);
    float rainLine = 1.0 - smoothstep(0.012, 0.055, rainLineX);
    float rainPulse = 0.06 + 0.94
      * pow(max(0.0, sin((vUv.y * 1.7 + uTime * 0.018 + rainSeed) * 6.28318)), 10.0);
    float lensDistance = distance(vUv, vec2(0.3 + sin(uTime * 0.09) * 0.025, 0.5));
    float lensRim = exp(-pow((lensDistance - 0.29) * 24.0, 2.0));
    color += rain * (rainLine * rainPulse * 0.07 + lensRim * 0.035) * uAtmosphere;

    vec3 frostTint = color * 0.78 + rain * 0.22;
    color = mix(color, frostTint, uPortraitFrost * (0.24 + noise(vUv * 3.2) * 0.08));

    float bridgePosition = mix(0.16, 0.84, smoothstep(0.68, 0.88, uProgress));
    float bridgeSweep = exp(-pow((vUv.x - bridgePosition) * 13.0, 2.0));
    color += rain * bridgeSweep * uTransitionBridge * 0.12;

    float opening = uPaperReveal * 0.44;
    float splitWobble = sin(vUv.y * 14.0 + uTime * 0.35) * 0.008 * uPaperReveal;
    float distanceFromSplit = abs(vUv.x - 0.5 + splitWobble);
    float reveal = (1.0 - smoothstep(opening - 0.024, opening + 0.014, distanceFromSplit))
      * uPaperReveal;
    float splitEdge = 1.0 - smoothstep(0.0, 0.018, abs(distanceFromSplit - opening));
    color += rain * splitEdge * uPaperReveal * 0.56;

    float alpha = 1.0 - reveal;
    alpha = max(alpha, splitEdge * uPaperReveal * 0.7);
    alpha = mix(alpha, alpha * 0.96, uDark);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createFallbackTexture() {
  const texture = new DataTexture(new Uint8Array([22, 27, 27, 255]), 1, 1);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class LiquidRainMaterial {
  readonly renderer: WebGLRenderer;
  private readonly material: ShaderMaterial;
  private readonly geometry: PlaneGeometry;
  private readonly fallbackTexture = createFallbackTexture();
  private textures: Texture[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;

    const uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uRefraction: { value: 0 },
      uImageVisibility: { value: 0.2 },
      uAtmosphere: { value: 0 },
      uPortraitFrost: { value: 0 },
      uTransitionBridge: { value: 0 },
      uPaperReveal: { value: 0 },
      uPointerStrength: { value: 0 },
      uDark: { value: 0 },
      uPointer: { value: new Vector2(0.5, 0.5) },
      uResolution: { value: new Vector2(1, 1) },
      uTexture0: { value: this.fallbackTexture },
      uTexture1: { value: this.fallbackTexture },
      uTexture2: { value: this.fallbackTexture },
      uTexture3: { value: this.fallbackTexture },
    };

    this.material = new ShaderMaterial({
      fragmentShader,
      transparent: true,
      uniforms,
      vertexShader,
    });
    this.geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    scene.add(new Mesh(this.geometry, this.material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer.setAnimationLoop(null);
    this.renderScene = () => this.renderer.render(scene, camera);
  }

  private readonly renderScene: (time: number) => void;

  async loadTextures(urls: readonly string[]) {
    const loader = new TextureLoader();
    const results = await Promise.allSettled(urls.slice(0, 4).map((url) => loader.loadAsync(url)));
    const textures = results.map((result) =>
      result.status === 'fulfilled' ? result.value : this.fallbackTexture,
    );

    textures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
    });
    this.textures = textures.filter((texture) => texture !== this.fallbackTexture);

    const uniforms = this.material.uniforms;
    uniforms.uTexture0.value = textures[0] ?? this.fallbackTexture;
    uniforms.uTexture1.value = textures[1] ?? textures[0] ?? this.fallbackTexture;
    uniforms.uTexture2.value = textures[2] ?? textures[0] ?? this.fallbackTexture;
    uniforms.uTexture3.value = textures[3] ?? textures[1] ?? this.fallbackTexture;
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.material.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
  }

  setFrame(frame: LiquidRainFrame) {
    const uniforms = this.material.uniforms;
    uniforms.uProgress.value = frame.progress;
    uniforms.uRefraction.value = frame.refraction;
    uniforms.uImageVisibility.value = frame.imageVisibility;
    uniforms.uAtmosphere.value = frame.atmosphere;
    uniforms.uPortraitFrost.value = frame.portraitFrost;
    uniforms.uTransitionBridge.value = frame.transitionBridge;
    uniforms.uPaperReveal.value = frame.paperReveal;
  }

  setPointer(x: number, y: number, strength: number) {
    this.material.uniforms.uPointer.value.set(x, y);
    this.material.uniforms.uPointerStrength.value = strength;
  }

  setDark(isDark: boolean) {
    this.material.uniforms.uDark.value = isDark ? 1 : 0;
  }

  render(time: number) {
    this.material.uniforms.uTime.value = time * 0.001;
    this.renderScene(time);
  }

  dispose() {
    this.textures.forEach((texture) => {
      texture.dispose();
    });
    this.fallbackTexture.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
