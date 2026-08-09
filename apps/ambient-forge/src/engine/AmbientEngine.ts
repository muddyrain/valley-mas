import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { type AmbientInputs, clampAmbientInputs, type WeatherMode } from '../core/ambient-inputs';
import {
  type CameraOrbitState,
  DEFAULT_CAMERA_ORBIT,
  orbitCameraPosition,
  rotateCameraOrbit,
  zoomCameraOrbit,
} from '../core/camera-orbit';
import {
  advanceCameraTour,
  CAMERA_VIEW_PRESETS,
  type CameraTourState,
  type CameraViewId,
  DEFAULT_CAMERA_TOUR_STATE,
  getCameraTransitionEase,
  getCameraTransitionProgress,
  setCameraTourEnabled,
} from '../core/camera-tour';
import { getPhotoFilterStyle, type PhotoFilter } from '../core/photo-mode';
import { getQualityProfile, type QualityLevel, type QualityProfile } from '../core/quality';
import { shouldResizeRendererForQuality } from '../core/quality-runtime';
import { deriveSceneSignals } from '../core/scene-signals';
import {
  createSurfaceAccumulation,
  getWeatherTargets,
  type SurfaceAccumulation,
  stepSurfaceAccumulation,
  stepWeatherTransition,
  type WeatherTargets,
} from '../core/weather';
import { type ArchipelagoAssembly, createArchipelago } from './createArchipelago';
import { type CloudSeaAssembly, createCloudSea } from './createCloudSea';
import { createIsland, type IslandAssembly } from './createIsland';
import { createLifestyleIslands, type LifestyleIslandsAssembly } from './createLifestyleIslands';
import { createSky, type SkyAssembly } from './createSky';
import { createWorldExpansion, type WorldExpansionAssembly } from './createWorldExpansion';
import { releaseRenderer } from './dispose';
import { WeatherSystem } from './WeatherSystem';

export interface AmbientDebugStats {
  fps: number;
  dpr: number;
  particleCount: number;
  weather: WeatherMode;
  audioLow: number;
  audioMid: number;
  audioHigh: number;
  cameraView: CameraViewId;
  autoTour: boolean;
}

export interface AmbientEngineOptions {
  mount: HTMLElement;
  quality: QualityLevel;
  getInputs: () => AmbientInputs;
  onStats?: (stats: AmbientDebugStats) => void;
  onCameraState?: (state: CameraTourState) => void;
}

export interface AmbientSceneState {
  coordinateSystem: string;
  camera: {
    view: CameraViewId;
    autoTour: boolean;
    position: [number, number, number];
    target: [number, number, number];
    targetGoal: [number, number, number];
    distance: number;
  };
  landmarks: readonly CameraViewId[];
  weather: WeatherMode;
  quality: QualityLevel;
  surface: SurfaceAccumulation;
  photo: {
    enabled: boolean;
    depthOfField: boolean;
  };
}

interface ActiveCameraTransition {
  startedAt: number;
  duration: number;
  fromOrbit: CameraOrbitState;
  toOrbit: CameraOrbitState;
  fromTarget: Vector3;
  toTarget: Vector3;
}

const continuousKeys = [
  'timeOfDay',
  'weatherIntensity',
  'wind',
  'audioLow',
  'audioMid',
  'audioHigh',
  'pointerX',
  'pointerY',
] as const;

export class AmbientEngine {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 120);
  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bokehPass: BokehPass;
  private readonly hemisphere = new HemisphereLight('#aac6cf', '#32382e', 1);
  private readonly sunLight = new DirectionalLight('#ffe0ad', 1.2);
  private readonly rimLight = new DirectionalLight('#83a8c6', 0.42);
  private readonly island: IslandAssembly;
  private readonly archipelago: ArchipelagoAssembly;
  private readonly worldExpansion: WorldExpansionAssembly;
  private readonly lifestyleIslands: LifestyleIslandsAssembly;
  private readonly sky: SkyAssembly;
  private readonly clouds: CloudSeaAssembly;
  private readonly weather: WeatherSystem;
  private readonly resizeObserver: ResizeObserver;
  private readonly cameraTarget = new Vector3(0, -0.7, 0);
  private readonly cameraTargetGoal = new Vector3(0, -0.7, 0);
  private readonly cameraLookTarget = new Vector3(0, -0.7, 0);
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly handlePointerDown: (event: PointerEvent) => void;
  private readonly handlePointerMove: (event: PointerEvent) => void;
  private readonly handlePointerUp: (event: PointerEvent) => void;
  private readonly handlePointerLeave: () => void;
  private readonly handleWheel: (event: WheelEvent) => void;
  private readonly handleDoubleClick: () => void;
  private readonly handleVisibilityChange: () => void;
  private smoothedInputs: AmbientInputs;
  private weatherTransition: WeatherTargets;
  private surfaceAccumulation = createSurfaceAccumulation();
  private pointerX = 0;
  private pointerY = 0;
  private orbitTarget: CameraOrbitState = { ...DEFAULT_CAMERA_ORBIT };
  private orbitCurrent: CameraOrbitState = { ...DEFAULT_CAMERA_ORBIT };
  private orbitPointerId: number | null = null;
  private orbitPointerX = 0;
  private orbitPointerY = 0;
  private orbitDragDistance = 0;
  private cameraTourState: CameraTourState = { ...DEFAULT_CAMERA_TOUR_STATE };
  private cameraTransition: ActiveCameraTransition | null = null;
  private rafId: number | null = null;
  private disposed = false;
  private lastFrame = performance.now();
  private elapsed = 0;
  private lastStatsAt = 0;
  private fpsAverage = 60;
  private quality: QualityLevel;
  private profile: QualityProfile;
  private photoMode = false;
  private photoDepthOfField = false;

  constructor(private readonly options: AmbientEngineOptions) {
    this.quality = options.quality;
    this.profile = getQualityProfile(options.quality);
    this.renderer = new WebGLRenderer({
      antialias: this.profile.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.domElement.className = 'ambient-canvas';
    this.renderer.domElement.setAttribute('aria-label', '随时间、天气与音乐变化的浮空群岛场景');
    options.mount.appendChild(this.renderer.domElement);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 24,
      aperture: 0.000035,
      maxblur: 0.008,
    });
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);

    this.camera.position.set(12.4, 7.4, 21);
    this.camera.lookAt(this.cameraTarget);
    this.scene.background = new Color('#09131c');
    this.scene.fog = new FogExp2('#82979a', 0.004);
    this.scene.add(this.hemisphere, this.sunLight, this.rimLight);
    this.sunLight.position.set(-8, 14, 10);
    this.rimLight.position.set(12, 7, -10);
    this.sunLight.castShadow = this.profile.shadows;
    this.configureShadow(this.profile);

    this.sky = createSky(this.profile);
    this.clouds = createCloudSea(this.profile);
    this.island = createIsland(this.profile);
    this.island.root.userData.cameraView = 'overview';
    this.archipelago = createArchipelago(this.profile);
    this.worldExpansion = createWorldExpansion(this.profile);
    this.lifestyleIslands = createLifestyleIslands(this.profile);
    this.weather = new WeatherSystem(this.scene, this.profile);
    this.scene.add(
      this.sky.root,
      this.clouds.root,
      this.island.root,
      this.archipelago.root,
      this.worldExpansion.root,
      this.lifestyleIslands.root,
    );

    this.smoothedInputs = clampAmbientInputs(options.getInputs());
    this.weatherTransition = getWeatherTargets(
      this.smoothedInputs.weather,
      this.smoothedInputs.weatherIntensity,
    );
    const canvas = this.renderer.domElement;
    this.handlePointerDown = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.orbitPointerId = event.pointerId;
      this.orbitPointerX = event.clientX;
      this.orbitPointerY = event.clientY;
      this.orbitDragDistance = 0;
      this.pointerX = 0;
      this.pointerY = 0;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-orbiting');
    };
    this.handlePointerMove = (event) => {
      if (event.pointerId === this.orbitPointerId) {
        const deltaX = event.clientX - this.orbitPointerX;
        const deltaY = event.clientY - this.orbitPointerY;
        this.orbitPointerX = event.clientX;
        this.orbitPointerY = event.clientY;
        this.orbitDragDistance += Math.hypot(deltaX, deltaY);
        if (this.orbitDragDistance > 2) {
          this.cancelCameraTransition();
          this.disableAutoTour();
        }
        this.orbitTarget = rotateCameraOrbit(this.orbitTarget, deltaX, deltaY);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.pointerX = MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      this.pointerY = MathUtils.clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
    };
    this.handlePointerUp = (event) => {
      if (event.pointerId !== this.orbitPointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      this.orbitPointerId = null;
      canvas.classList.remove('is-orbiting');
      if (this.orbitDragDistance < 6) this.focusPickedLandmark(event.clientX, event.clientY);
    };
    this.handlePointerLeave = () => {
      if (this.orbitPointerId !== null) return;
      this.pointerX = 0;
      this.pointerY = 0;
    };
    this.handleWheel = (event) => {
      event.preventDefault();
      this.cancelCameraTransition();
      this.disableAutoTour();
      this.orbitTarget = zoomCameraOrbit(this.orbitTarget, event.deltaY);
    };
    this.handleDoubleClick = () => {
      this.focusCameraView('overview');
    };
    this.handleVisibilityChange = () => {
      if (document.hidden) this.stop();
      else {
        this.lastFrame = performance.now();
        this.start();
      }
    };
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.mount);
    this.resize();
    this.options.onCameraState?.({ ...this.cameraTourState });
    this.start();
  }

  private emitCameraState(): void {
    this.options.onCameraState?.({ ...this.cameraTourState });
  }

  private applyCameraView(view: CameraViewId): void {
    const preset = CAMERA_VIEW_PRESETS[view];
    this.orbitTarget = { ...preset.orbit };
    this.cameraTargetGoal.set(...preset.target);
    this.cameraTransition = {
      startedAt: performance.now(),
      duration: 1_200,
      fromOrbit: { ...this.orbitCurrent },
      toOrbit: { ...preset.orbit },
      fromTarget: this.cameraTarget.clone(),
      toTarget: this.cameraTargetGoal.clone(),
    };
    this.pointerX = 0;
    this.pointerY = 0;
  }

  private cancelCameraTransition(): void {
    if (!this.cameraTransition) return;
    this.cameraTransition = null;
    this.orbitTarget = { ...this.orbitCurrent };
    this.cameraTargetGoal.copy(this.cameraTarget);
  }

  private disableAutoTour(): void {
    if (!this.cameraTourState.enabled) return;
    this.cameraTourState = setCameraTourEnabled(this.cameraTourState, false);
    this.emitCameraState();
  }

  private focusPickedLandmark(clientX: number, clientY: number): void {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const intersections = this.raycaster.intersectObjects(
      [
        this.island.root,
        this.archipelago.root,
        this.worldExpansion.root,
        this.lifestyleIslands.root,
      ],
      true,
    );
    for (const intersection of intersections) {
      let object = intersection.object;
      while (object) {
        const view = object.userData.cameraView as CameraViewId | undefined;
        if (view && CAMERA_VIEW_PRESETS[view]) {
          this.focusCameraView(view);
          return;
        }
        if (!object.parent) break;
        object = object.parent;
      }
    }
  }

  private configureShadow(profile: QualityProfile): void {
    this.sunLight.shadow.mapSize.set(profile.shadowMapSize || 512, profile.shadowMapSize || 512);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 42;
    this.sunLight.shadow.camera.left = -15;
    this.sunLight.shadow.camera.right = 15;
    this.sunLight.shadow.camera.top = 15;
    this.sunLight.shadow.camera.bottom = -15;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.035;
  }

  private resize(): void {
    const width = Math.max(1, this.options.mount.clientWidth);
    const height = Math.max(1, this.options.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dprCap));
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dprCap));
    this.composer.setSize(width, height);
  }

  private start(): void {
    if (this.disposed || this.rafId !== null || document.hidden) return;
    this.rafId = window.requestAnimationFrame(this.renderFrame);
  }

  private stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readonly renderFrame = (timestamp: number): void => {
    this.rafId = null;
    if (this.disposed || document.hidden) return;
    const delta = Math.min(0.05, Math.max(0.001, (timestamp - this.lastFrame) / 1000));
    this.lastFrame = timestamp;
    this.elapsed += delta;
    const raw = clampAmbientInputs({
      ...this.options.getInputs(),
      pointerX: this.pointerX,
      pointerY: this.pointerY,
    });
    const smoothing = 1 - Math.exp(-delta * 3.2);
    for (const key of continuousKeys) {
      this.smoothedInputs[key] += (raw[key] - this.smoothedInputs[key]) * smoothing;
    }
    this.smoothedInputs.weather = raw.weather;
    this.smoothedInputs.reducedMotion = raw.reducedMotion;
    this.weatherTransition = stepWeatherTransition(
      this.weatherTransition,
      getWeatherTargets(raw.weather, raw.weatherIntensity),
      delta,
      1.1,
    );
    this.surfaceAccumulation = stepSurfaceAccumulation(
      this.surfaceAccumulation,
      this.weatherTransition,
      delta,
    );
    const signals = deriveSceneSignals(
      this.smoothedInputs,
      this.weatherTransition,
      this.surfaceAccumulation,
    );

    const nextTourState = advanceCameraTour(this.cameraTourState, delta);
    if (nextTourState.view !== this.cameraTourState.view) {
      this.cameraTourState = nextTourState;
      this.applyCameraView(nextTourState.view);
      this.emitCameraState();
    } else {
      this.cameraTourState = nextTourState;
    }

    this.sky.update(signals, this.smoothedInputs.timeOfDay);
    this.clouds.update(signals, this.elapsed, delta);
    this.island.update(signals, this.elapsed);
    this.archipelago.update(signals, this.elapsed);
    this.worldExpansion.update(signals, this.elapsed, delta);
    this.lifestyleIslands.update(signals, this.elapsed, delta);
    this.weather.update(signals, this.elapsed, delta);
    this.hemisphere.intensity = 0.18 + signals.ambientLight * 1.08;
    this.hemisphere.color.setRGB(...signals.horizonColor);
    this.hemisphere.groundColor.setRGB(0.12, 0.16, 0.14);
    this.sunLight.intensity = signals.sunLight * 1.35;
    this.sunLight.color.setRGB(...signals.sunColor);
    this.rimLight.intensity = 0.16 + signals.daylight * 0.34;
    this.rimLight.color.copy(this.hemisphere.color).lerp(this.sunLight.color, 0.18);

    if (this.cameraTransition) {
      const transition = this.cameraTransition;
      const progress = getCameraTransitionProgress(
        transition.startedAt,
        timestamp,
        transition.duration,
      );
      const eased = 1 - (1 - progress) ** 3;
      const azimuthDelta = Math.atan2(
        Math.sin(transition.toOrbit.azimuth - transition.fromOrbit.azimuth),
        Math.cos(transition.toOrbit.azimuth - transition.fromOrbit.azimuth),
      );
      this.orbitCurrent.azimuth = transition.fromOrbit.azimuth + azimuthDelta * eased;
      this.orbitCurrent.polar =
        transition.fromOrbit.polar +
        (transition.toOrbit.polar - transition.fromOrbit.polar) * eased;
      this.orbitCurrent.distance =
        transition.fromOrbit.distance +
        (transition.toOrbit.distance - transition.fromOrbit.distance) * eased;
      this.cameraTarget.lerpVectors(transition.fromTarget, transition.toTarget, eased);
      if (progress >= 1) this.cameraTransition = null;
    } else {
      const orbitEase = getCameraTransitionEase(delta, 10);
      const azimuthDelta = Math.atan2(
        Math.sin(this.orbitTarget.azimuth - this.orbitCurrent.azimuth),
        Math.cos(this.orbitTarget.azimuth - this.orbitCurrent.azimuth),
      );
      this.orbitCurrent.azimuth += azimuthDelta * orbitEase;
      this.orbitCurrent.polar += (this.orbitTarget.polar - this.orbitCurrent.polar) * orbitEase;
      this.orbitCurrent.distance +=
        (this.orbitTarget.distance - this.orbitCurrent.distance) * orbitEase;
      const targetEase = getCameraTransitionEase(delta, 8);
      this.cameraTarget.lerp(this.cameraTargetGoal, targetEase);
    }
    this.cameraLookTarget.set(
      this.cameraTarget.x + signals.pointerX * 0.12,
      this.cameraTarget.y + signals.pointerY * 0.08,
      this.cameraTarget.z,
    );
    const cameraPosition = orbitCameraPosition(this.orbitCurrent, [
      this.cameraLookTarget.x,
      this.cameraLookTarget.y,
      this.cameraLookTarget.z,
    ]);
    this.camera.position.set(...cameraPosition);
    this.camera.lookAt(this.cameraLookTarget);
    if (this.photoMode && this.photoDepthOfField) {
      const uniforms = this.bokehPass.uniforms as { focus: { value: number } };
      uniforms.focus.value = this.camera.position.distanceTo(this.cameraLookTarget);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    const frameFps = 1 / delta;
    this.fpsAverage += (frameFps - this.fpsAverage) * 0.06;
    if (this.options.onStats && timestamp - this.lastStatsAt >= 500) {
      this.lastStatsAt = timestamp;
      this.renderer.domElement.dataset.cameraView = this.cameraTourState.view;
      this.renderer.domElement.dataset.cameraTarget = [
        this.cameraLookTarget.x,
        this.cameraLookTarget.y,
        this.cameraLookTarget.z,
      ]
        .map((value) => value.toFixed(2))
        .join(',');
      this.renderer.domElement.dataset.cameraPosition = [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ]
        .map((value) => value.toFixed(2))
        .join(',');
      this.renderer.domElement.dataset.surfaceWetness = this.surfaceAccumulation.wetness.toFixed(3);
      this.renderer.domElement.dataset.snowCover = this.surfaceAccumulation.snowCover.toFixed(3);
      this.options.onStats({
        fps: Math.round(this.fpsAverage),
        dpr: this.renderer.getPixelRatio(),
        particleCount:
          this.weather.getParticleCount() +
          this.island.getEffectCount() +
          this.archipelago.getEffectCount() +
          this.worldExpansion.getEffectCount() +
          this.lifestyleIslands.getEffectCount() +
          this.clouds.getVisibleCount(),
        weather: raw.weather,
        audioLow: raw.audioLow,
        audioMid: raw.audioMid,
        audioHigh: raw.audioHigh,
        cameraView: this.cameraTourState.view,
        autoTour: this.cameraTourState.enabled,
      });
    }
    this.start();
  };

  setQuality(quality: QualityLevel): void {
    if (quality === this.quality) return;
    const startedAt = performance.now();
    this.quality = quality;
    this.profile = getQualityProfile(quality);
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.sunLight.castShadow = this.profile.shadows;
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.configureShadow(this.profile);
    this.sky.setQuality(this.profile);
    this.clouds.setQuality(this.profile);
    this.island.setQuality(this.profile);
    this.archipelago.setQuality(this.profile);
    this.worldExpansion.setQuality(this.profile);
    this.lifestyleIslands.setQuality(this.profile);
    this.weather.setQuality(this.profile);
    if (
      shouldResizeRendererForQuality(
        this.renderer.getPixelRatio(),
        window.devicePixelRatio || 1,
        this.profile,
      )
    ) {
      this.resize();
    }
    this.renderer.domElement.dataset.qualitySwitchMs = (performance.now() - startedAt).toFixed(1);
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setPhotoMode(enabled: boolean, depthOfField: boolean): void {
    this.photoMode = enabled;
    this.photoDepthOfField = enabled && depthOfField;
    this.bokehPass.enabled = this.photoDepthOfField;
    this.renderer.domElement.dataset.photoMode = enabled ? 'true' : 'false';
  }

  async capturePhoto(filter: PhotoFilter): Promise<Blob | null> {
    if (this.photoMode && this.photoDepthOfField) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    const source = this.renderer.domElement;
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d');
    if (!context) return null;
    context.filter = getPhotoFilterStyle(filter);
    context.drawImage(source, 0, 0, output.width, output.height);
    return await new Promise((resolve) => output.toBlob(resolve, 'image/png', 1));
  }

  getCameraTourState(): CameraTourState {
    return { ...this.cameraTourState };
  }

  getSceneState(): AmbientSceneState {
    return {
      coordinateSystem: '+X 向右，+Y 向上，+Z 朝默认镜头；单位为 Three.js 世界单位',
      camera: {
        view: this.cameraTourState.view,
        autoTour: this.cameraTourState.enabled,
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        target: [this.cameraLookTarget.x, this.cameraLookTarget.y, this.cameraLookTarget.z],
        targetGoal: [this.cameraTargetGoal.x, this.cameraTargetGoal.y, this.cameraTargetGoal.z],
        distance: this.orbitCurrent.distance,
      },
      landmarks: [
        'overview',
        'observatory',
        'cavern',
        'garden',
        'crystal',
        'ruins',
        'harbor',
        'greenhouse',
      ],
      weather: this.smoothedInputs.weather,
      quality: this.quality,
      surface: { ...this.surfaceAccumulation },
      photo: {
        enabled: this.photoMode,
        depthOfField: this.photoDepthOfField,
      },
    };
  }

  focusCameraView(view: CameraViewId): void {
    this.cameraTourState = { enabled: false, view, elapsed: 0 };
    this.applyCameraView(view);
    this.emitCameraState();
  }

  setAutoTour(enabled: boolean): void {
    const nextState = setCameraTourEnabled(this.cameraTourState, enabled);
    const viewChanged = nextState.view !== this.cameraTourState.view;
    this.cameraTourState = nextState;
    if (viewChanged) this.applyCameraView(nextState.view);
    this.emitCameraState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerUp);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('dblclick', this.handleDoubleClick);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.weather.dispose();
    this.sky.dispose();
    this.clouds.dispose();
    this.island.dispose();
    this.archipelago.dispose();
    this.worldExpansion.dispose();
    this.lifestyleIslands.dispose();
    this.composer.dispose();
    this.scene.clear();
    releaseRenderer(this.renderer);
    this.renderer.domElement.remove();
  }
}
