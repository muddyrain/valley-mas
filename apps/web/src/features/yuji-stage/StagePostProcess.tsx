import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  type ShaderMaterialParameters,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { PointerBus, ScrollBus } from './stageBus';
import { resolveFluidPassEnabled, resolveFluidSimulationSize } from './stageFluid';
import {
  dampCurlActivity,
  resolveCurlTarget,
  resolveFluidActivity,
  resolveHeroExitProgress,
} from './stageMotion';

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const curlFragmentShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
    gl_FragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
  }
`;

const impulseFragmentShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexelSize;
  uniform vec2 uViewportSize;
  uniform vec2 uPointer;
  uniform vec2 uPointerDelta;
  uniform float uCurlForce;
  uniform float uSplatRadius;
  uniform float uSplatForce;
  varying vec2 vUv;

  void main() {
    float left = abs(texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
    float right = abs(texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
    float bottom = abs(texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
    float top = abs(texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
    float center = texture2D(uCurl, vUv).x;

    vec2 curlGradient = vec2(top - bottom, right - left);
    float gradientLength = length(curlGradient);
    if (gradientLength > 0.0001) curlGradient /= gradientLength;
    curlGradient *= uCurlForce * center;
    curlGradient.y *= -1.0;

    vec2 velocity = texture2D(uVelocity, vUv).xy + curlGradient * 0.016;
    vec2 pointerUv = uPointer / max(uViewportSize, vec2(1.0));
    vec2 offset = vUv - pointerUv;
    offset.x *= uViewportSize.x / max(uViewportSize.y, 1.0);
    float splat = exp(-dot(offset, offset) / max(uSplatRadius, 0.0001));
    velocity += (uPointerDelta / max(uViewportSize, vec2(1.0))) * splat * uSplatForce;
    gl_FragColor = vec4(clamp(velocity, vec2(-1000.0), vec2(1000.0)), 0.0, 1.0);
  }
`;

const divergenceFragmentShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
    gl_FragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
  }
`;

const clearFragmentShader = /* glsl */ `
  void main() {
    gl_FragColor = vec4(0.0);
  }
`;

const pressureFragmentShader = /* glsl */ `
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float divergence = texture2D(uDivergence, vUv).x;
    gl_FragColor = vec4((left + right + bottom + top - divergence) * 0.25, 0.0, 0.0, 1.0);
  }
`;

const gradientFragmentShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(right - left, top - bottom) * 0.5;
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const advectionFragmentShader = /* glsl */ `
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 sourceUv = clamp(vUv - velocity * uTexelSize * 0.016, 0.0, 1.0);
    vec2 advected = texture2D(uVelocity, sourceUv).xy;
    advected /= 1.0 + uDissipation * 0.016;
    gl_FragColor = vec4(advected, 0.0, 1.0);
  }
`;

const compositeFragmentShader = /* glsl */ `
  uniform sampler2D uScene;
  uniform sampler2D uVelocity;
  uniform vec2 uResolution;
  uniform vec2 uSimulationSize;
  uniform float uFluidEnabled;
  uniform float uFluidStrength;
  uniform float uChromaticBoost;
  uniform float uCurl;
  uniform float uExit;
  uniform float uDark;
  varying vec2 vUv;

  vec4 sampleSoft(vec2 uv, vec2 radius) {
    vec4 color = texture2D(uScene, uv) * 0.2;
    color += texture2D(uScene, uv + vec2(radius.x, 0.0)) * 0.12;
    color += texture2D(uScene, uv - vec2(radius.x, 0.0)) * 0.12;
    color += texture2D(uScene, uv + vec2(0.0, radius.y)) * 0.12;
    color += texture2D(uScene, uv - vec2(0.0, radius.y)) * 0.12;
    color += texture2D(uScene, uv + radius) * 0.08;
    color += texture2D(uScene, uv - radius) * 0.08;
    color += texture2D(uScene, uv + vec2(radius.x, -radius.y)) * 0.08;
    color += texture2D(uScene, uv + vec2(-radius.x, radius.y)) * 0.08;
    return color;
  }

  vec4 sampleFluid(vec2 uv, out float energy) {
    if (uFluidEnabled < 0.5) {
      energy = 0.0;
      return texture2D(uScene, uv);
    }

    vec2 velocity = texture2D(uVelocity, uv).xy;
    vec2 normalizedVelocity = velocity / max(uSimulationSize, vec2(1.0));
    float magnitude = length(normalizedVelocity);
    vec2 displacement = normalizedVelocity * magnitude * uFluidStrength * 0.5;
    vec2 sampleA = clamp(uv - displacement * 1.35, 0.001, 0.999);
    vec2 sampleB = clamp(uv - displacement * 0.88, 0.001, 0.999);
    vec2 sampleC = clamp(uv - displacement * 0.48, 0.001, 0.999);
    vec2 sampleD = clamp(uv - displacement * 0.16, 0.001, 0.999);
    vec4 center = texture2D(uScene, sampleB);
    vec4 color = center;
    color.r = texture2D(uScene, sampleA).r;
    color.g = texture2D(uScene, sampleC).g;
    color.b = texture2D(uScene, sampleD).b;

    float objectEnergy = smoothstep(0.004, 0.09, magnitude);
    energy = smoothstep(0.0015, 0.05, magnitude);
    vec3 cold = mix(vec3(0.0, 0.5, 1.0), vec3(0.12, 0.38, 1.0), uDark);
    vec3 hot = mix(vec3(1.0, 0.4, 0.02), vec3(0.72, 0.24, 1.0), uDark);
    float directionMix = 0.5 + 0.5 * sin(atan(normalizedVelocity.y, normalizedVelocity.x) * 2.0);
    vec3 trailColor = mix(cold, hot, directionMix);
    color.rgb += trailColor * objectEnergy * uChromaticBoost * center.a;

    // The DOM-led page sits behind a transparent WebGL canvas. Preserve a
    // restrained amount of the simulated velocity as its own translucent
    // light so the trail remains visible while crossing otherwise empty DOM.
    float emptyCanvas = 1.0 - center.a;
    float trailAlpha = energy * mix(0.17, 0.15, uDark);
    float trailCoverage = emptyCanvas * smoothstep(0.02, 0.2, energy);
    color.rgb = mix(color.rgb, trailColor, trailCoverage);
    color.a = max(color.a, trailAlpha);
    return color;
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float radial = dot(centered, centered) * 3.2;
    vec2 uv = clamp(0.5 + centered * (1.0 + radial * uCurl * 0.06), 0.001, 0.999);
    float fluidEnergy = 0.0;
    vec4 source = sampleFluid(uv, fluidEnergy);

    float exitSoftness = smoothstep(0.06, 0.46, uExit) * (1.0 - smoothstep(0.9, 1.0, uExit));
    vec2 blurRadius = vec2(6.0 * exitSoftness) / max(uResolution, vec2(1.0));
    vec4 softSource = sampleSoft(uv, blurRadius);
    source = mix(source, softSource, exitSoftness * 0.84);

    vec2 cell = fract(gl_FragCoord.xy / 7.0) - 0.5;
    float dotMask = 1.0 - smoothstep(0.2, 0.48, length(cell));
    float breakup = exitSoftness * 0.58;
    source.a *= mix(1.0, 0.34 + dotMask * 0.66, breakup);
    vec3 signalTint = mix(vec3(0.72, 0.9, 1.0), vec3(0.12, 0.22, 0.78), uDark);
    source.rgb += signalTint * dotMask * exitSoftness * source.a * 0.035;
    source.rgb += signalTint * fluidEnergy * 0.025 * source.a;
    gl_FragColor = source;
    #include <colorspace_fragment>
  }
`;

function createPassMaterial(
  fragmentShader: string,
  uniforms: ShaderMaterialParameters['uniforms'],
) {
  return new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    toneMapped: false,
    uniforms,
    vertexShader: fullscreenVertexShader,
  });
}

function createFluidTarget(name: string) {
  const target = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    stencilBuffer: false,
    type: HalfFloatType,
  });
  target.texture.name = name;
  return target;
}

function clearTargets(renderer: WebGLRenderer, targets: WebGLRenderTarget[]) {
  for (const target of targets) {
    renderer.setRenderTarget(target);
    renderer.clear();
  }
  renderer.setRenderTarget(null);
}

export function StagePostProcess({
  mode,
  pointerBus,
  scrollBus,
  theme,
}: {
  mode: 'articles' | 'home';
  pointerBus: PointerBus;
  scrollBus: ScrollBus;
  theme: 'dark' | 'light';
}) {
  const curlRef = useRef(0);
  const lastPointerSequenceRef = useRef(pointerBus.frame.sequence);
  const velocityReadIndexRef = useRef(0);
  const drawingBufferSize = useMemo(() => new Vector2(), []);
  const pointerPixels = useMemo(() => new Vector2(), []);
  const pointerDeltaPixels = useMemo(() => new Vector2(), []);
  const simulationSizeRef = useRef(new Vector2());
  const resources = useMemo(() => {
    const sceneTarget = new WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      format: RGBAFormat,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      stencilBuffer: false,
    });
    sceneTarget.texture.name = 'YujiStage.Scene';

    const velocityTargets = [
      createFluidTarget('YujiFluid.VelocityA'),
      createFluidTarget('YujiFluid.VelocityB'),
    ] as const;
    const curlTarget = createFluidTarget('YujiFluid.Curl');
    const impulseTarget = createFluidTarget('YujiFluid.Impulse');
    const divergenceTarget = createFluidTarget('YujiFluid.Divergence');
    const pressureTargets = [
      createFluidTarget('YujiFluid.PressureA'),
      createFluidTarget('YujiFluid.PressureB'),
    ] as const;
    const projectedVelocityTarget = createFluidTarget('YujiFluid.ProjectedVelocity');
    const texelSize = new Vector2(1, 1);
    const viewportSize = new Vector2(1, 1);

    const materials = {
      advect: createPassMaterial(advectionFragmentShader, {
        uDissipation: { value: 3 },
        uTexelSize: { value: texelSize },
        uVelocity: { value: projectedVelocityTarget.texture },
      }),
      clear: createPassMaterial(clearFragmentShader, {}),
      composite: createPassMaterial(compositeFragmentShader, {
        uChromaticBoost: { value: 0.24 },
        uCurl: { value: 0 },
        uDark: { value: 0 },
        uExit: { value: 0 },
        uFluidEnabled: { value: 0 },
        uFluidStrength: { value: 0.08 },
        uResolution: { value: new Vector2(1, 1) },
        uScene: { value: sceneTarget.texture },
        uSimulationSize: { value: new Vector2(1, 1) },
        uVelocity: { value: velocityTargets[0].texture },
      }),
      curl: createPassMaterial(curlFragmentShader, {
        uTexelSize: { value: texelSize },
        uVelocity: { value: velocityTargets[0].texture },
      }),
      divergence: createPassMaterial(divergenceFragmentShader, {
        uTexelSize: { value: texelSize },
        uVelocity: { value: impulseTarget.texture },
      }),
      gradient: createPassMaterial(gradientFragmentShader, {
        uPressure: { value: pressureTargets[0].texture },
        uTexelSize: { value: texelSize },
        uVelocity: { value: impulseTarget.texture },
      }),
      impulse: createPassMaterial(impulseFragmentShader, {
        uCurl: { value: curlTarget.texture },
        uCurlForce: { value: 0 },
        uPointer: { value: pointerPixels },
        uPointerDelta: { value: pointerDeltaPixels },
        uSplatForce: { value: 3_000 },
        uSplatRadius: { value: 0.003 },
        uTexelSize: { value: texelSize },
        uVelocity: { value: velocityTargets[0].texture },
        uViewportSize: { value: viewportSize },
      }),
      pressure: createPassMaterial(pressureFragmentShader, {
        uDivergence: { value: divergenceTarget.texture },
        uPressure: { value: pressureTargets[0].texture },
        uTexelSize: { value: texelSize },
      }),
    };
    const geometry = new PlaneGeometry(2, 2);
    const passMesh = new Mesh(geometry, materials.clear);
    const passScene = new Scene();
    passScene.add(passMesh);

    return {
      camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      curlTarget,
      divergenceTarget,
      fluidTargets: [
        ...velocityTargets,
        curlTarget,
        impulseTarget,
        divergenceTarget,
        ...pressureTargets,
        projectedVelocityTarget,
      ],
      geometry,
      impulseTarget,
      materials,
      passMesh,
      passScene,
      pressureTargets,
      projectedVelocityTarget,
      sceneTarget,
      texelSize,
      velocityTargets,
      viewportSize,
    };
  }, [pointerDeltaPixels, pointerPixels]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.sceneTarget.dispose();
      for (const target of resources.fluidTargets) target.dispose();
      for (const material of Object.values(resources.materials)) material.dispose();
    },
    [resources],
  );

  useFrame((state, deltaSeconds) => {
    const { gl } = state;
    gl.getDrawingBufferSize(drawingBufferSize);
    const width = Math.max(1, Math.round(drawingBufferSize.x));
    const height = Math.max(1, Math.round(drawingBufferSize.y));
    if (resources.sceneTarget.width !== width || resources.sceneTarget.height !== height) {
      resources.sceneTarget.setSize(width, height);
    }

    const nextSimulationSize = resolveFluidSimulationSize(width, height);
    if (
      simulationSizeRef.current.x !== nextSimulationSize.width ||
      simulationSizeRef.current.y !== nextSimulationSize.height
    ) {
      simulationSizeRef.current.set(nextSimulationSize.width, nextSimulationSize.height);
      for (const target of resources.fluidTargets) {
        target.setSize(nextSimulationSize.width, nextSimulationSize.height);
      }
      resources.texelSize.set(1 / nextSimulationSize.width, 1 / nextSimulationSize.height);
      resources.viewportSize.set(width, height);
      resources.materials.composite.uniforms.uSimulationSize.value.set(
        nextSimulationSize.width,
        nextSimulationSize.height,
      );
      velocityReadIndexRef.current = 0;
      clearTargets(gl, resources.fluidTargets);
    } else {
      resources.viewportSize.set(width, height);
    }

    const scroll = scrollBus.frame;
    const heroExit =
      mode === 'home' ? resolveHeroExitProgress(scroll.scroll, scroll.viewportHeight) : 0;
    const targetCurl = resolveCurlTarget(scroll.velocity);
    curlRef.current = dampCurlActivity(curlRef.current, targetCurl, deltaSeconds);

    const pointer = pointerBus.frame;
    const activity = resolveFluidActivity(pointer.inside, pointer.lastMoveAt, performance.now());
    const fluidEnabled = resolveFluidPassEnabled(mode, activity, heroExit);
    const hasPointerImpulse =
      fluidEnabled && pointer.sequence !== lastPointerSequenceRef.current && pointer.inside;
    lastPointerSequenceRef.current = pointer.sequence;
    pointerPixels.set(pointer.x * width, (1 - pointer.y) * height);
    if (hasPointerImpulse) {
      pointerDeltaPixels.set(pointer.deltaX * width, -pointer.deltaY * height);
    } else {
      pointerDeltaPixels.set(0, 0);
    }

    gl.setRenderTarget(resources.sceneTarget);
    gl.clear();
    gl.render(state.scene, state.camera);

    const renderPass = (material: ShaderMaterial, target: WebGLRenderTarget, clear = true) => {
      resources.passMesh.material = material;
      gl.setRenderTarget(target);
      if (clear) gl.clear();
      gl.render(resources.passScene, resources.camera);
    };

    if (fluidEnabled) {
      const readVelocity = resources.velocityTargets[velocityReadIndexRef.current];
      const writeVelocity = resources.velocityTargets[1 - velocityReadIndexRef.current];
      resources.materials.curl.uniforms.uVelocity.value = readVelocity.texture;
      renderPass(resources.materials.curl, resources.curlTarget);

      resources.materials.impulse.uniforms.uVelocity.value = readVelocity.texture;
      renderPass(resources.materials.impulse, resources.impulseTarget);
      renderPass(resources.materials.divergence, resources.divergenceTarget);
      renderPass(resources.materials.clear, resources.pressureTargets[0]);

      let pressureRead = resources.pressureTargets[0];
      let pressureWrite = resources.pressureTargets[1];
      for (let iteration = 0; iteration < 4; iteration += 1) {
        resources.materials.pressure.uniforms.uPressure.value = pressureRead.texture;
        renderPass(resources.materials.pressure, pressureWrite);
        [pressureRead, pressureWrite] = [pressureWrite, pressureRead];
      }

      resources.materials.gradient.uniforms.uPressure.value = pressureRead.texture;
      renderPass(resources.materials.gradient, resources.projectedVelocityTarget);
      renderPass(resources.materials.advect, writeVelocity);
      velocityReadIndexRef.current = 1 - velocityReadIndexRef.current;
    }

    const currentVelocity = resources.velocityTargets[velocityReadIndexRef.current];
    const composite = resources.materials.composite;
    composite.uniforms.uVelocity.value = currentVelocity.texture;
    composite.uniforms.uFluidEnabled.value = fluidEnabled ? 1 : 0;
    composite.uniforms.uChromaticBoost.value = theme === 'dark' ? 0.29 : 0.22;
    composite.uniforms.uCurl.value = curlRef.current;
    composite.uniforms.uDark.value = theme === 'dark' ? 1 : 0;
    composite.uniforms.uExit.value = heroExit;
    composite.uniforms.uResolution.value.set(width, height);
    resources.passMesh.material = composite;
    gl.setRenderTarget(null);
    gl.clear();
    gl.render(resources.passScene, resources.camera);
  }, 1);

  return null;
}
