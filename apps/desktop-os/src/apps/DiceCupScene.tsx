import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { DoubleSide, MathUtils } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { DicePlacement3D } from '../tools/miniGamesV2';

interface Point {
  x: number;
  y: number;
}

interface DiceCupSceneProps {
  dice: number[];
  isOpen: boolean;
  isShaking: boolean;
  lidOffset: Point;
  placements: DicePlacement3D[];
  reducedMotion: boolean;
}

const FACE_VALUES: Record<number, Record<DiceFaceName, number>> = {
  1: { back: 6, bottom: 6, front: 1, left: 4, right: 3, top: 2 },
  2: { back: 5, bottom: 5, front: 2, left: 5, right: 4, top: 3 },
  3: { back: 4, bottom: 4, front: 3, left: 1, right: 6, top: 5 },
  4: { back: 3, bottom: 3, front: 4, left: 2, right: 1, top: 6 },
  5: { back: 2, bottom: 2, front: 5, left: 6, right: 2, top: 1 },
  6: { back: 1, bottom: 1, front: 6, left: 3, right: 5, top: 4 },
};

type DiceFaceName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

export default function DiceCupScene({
  dice,
  isOpen,
  isShaking,
  lidOffset,
  placements,
  reducedMotion,
}: DiceCupSceneProps) {
  return (
    <Canvas
      camera={{ fov: 34, position: [0, 2.62, 9.55] }}
      className="dice-cup-scene"
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      shadows
    >
      <color attach="background" args={['#f6ead2']} />
      <ambientLight intensity={1.55} />
      <directionalLight castShadow intensity={2.15} position={[-3.8, 5.8, 4.8]} />
      <pointLight intensity={0.62} position={[3.2, 3.4, 2.4]} color="#b7ddeb" />
      <group position={[0, -1.92, 0]} rotation={[0, 0.08, 0]}>
        <group rotation={[0.42, 0, 0]}>
          <DiceTray />
          {dice.map((value, index) => (
            <DiceMesh
              key={`dice-3d-${index}`}
              index={index}
              isShaking={isShaking}
              placement={placements[index]}
              reducedMotion={reducedMotion}
              value={value}
            />
          ))}
        </group>
        <CupLid isOpen={isOpen} lidOffset={lidOffset} />
      </group>
    </Canvas>
  );
}

function DiceTray() {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.12, 0]}>
        <cylinderGeometry args={[2.36, 2.52, 0.36, 72]} />
        <meshStandardMaterial color="#d8a766" metalness={0.08} roughness={0.54} />
      </mesh>
      <mesh receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[2.08, 2.22, 0.16, 72]} />
        <meshStandardMaterial color="#f5d28d" metalness={0.06} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.08, 14, 96]} />
        <meshStandardMaterial color="#c08b54" metalness={0.08} roughness={0.44} />
      </mesh>
      <mesh receiveShadow position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.58, 72]} />
        <meshStandardMaterial color="#7a5a3a" transparent opacity={0.12} roughness={0.8} />
      </mesh>
    </group>
  );
}

function CupLid({ isOpen, lidOffset }: { isOpen: boolean; lidOffset: Point }) {
  const groupRef = useRef<Group>(null);
  const target = getLidTarget(isOpen, lidOffset);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.x = MathUtils.lerp(group.position.x, target.position[0], 0.22);
    group.position.y = MathUtils.lerp(group.position.y, target.position[1], 0.22);
    group.position.z = MathUtils.lerp(group.position.z, target.position[2], 0.22);
    group.rotation.x = MathUtils.lerp(group.rotation.x, target.rotation[0], 0.2);
    group.rotation.y = MathUtils.lerp(group.rotation.y, target.rotation[1], 0.2);
    group.rotation.z = MathUtils.lerp(group.rotation.z, target.rotation[2], 0.2);
  });

  return (
    <group ref={groupRef} position={[0, 1.34, 0.02]}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[1.74, 2.04, 2.32, 84, 1, true]} />
        <meshStandardMaterial color="#df846e" metalness={0.08} roughness={0.46} side={DoubleSide} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
        <sphereGeometry args={[1.74, 84, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ee9c7e" metalness={0.08} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, -1.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.03, 0.105, 16, 104]} />
        <meshStandardMaterial color="#bd6657" metalness={0.08} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.48, 0.5, 0.18, 48]} />
        <meshStandardMaterial color="#f0b172" metalness={0.06} roughness={0.38} />
      </mesh>
      <mesh position={[-0.54, 0.54, 1.44]} rotation={[-0.18, 0, -0.12]}>
        <circleGeometry args={[0.34, 36]} />
        <meshStandardMaterial color="#ffe5c0" transparent opacity={0.28} roughness={0.5} />
      </mesh>
    </group>
  );
}

function DiceMesh({
  index,
  isShaking,
  placement,
  reducedMotion,
  value,
}: {
  index: number;
  isShaking: boolean;
  placement?: DicePlacement3D;
  reducedMotion: boolean;
  value: number;
}) {
  const groupRef = useRef<Group>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(0.72, 0.72, 0.72, 6, 0.11), []);
  const target = placement ?? {
    rotation: [0, 0, 0] as [number, number, number],
    spin: [1, 1, 1] as [number, number, number],
    x: 0,
    y: 0.38,
    z: 0,
  };
  const faceValues = FACE_VALUES[value] ?? FACE_VALUES[1];

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const elapsed = clock.elapsedTime + index * 0.18;
    const bob = isShaking && !reducedMotion ? Math.sin(elapsed * 18) * 0.12 : 0;
    group.position.set(target.x, target.y + bob, target.z);
    if (isShaking && !reducedMotion) {
      group.rotation.set(
        target.rotation[0] + elapsed * target.spin[0],
        target.rotation[1] + elapsed * target.spin[1],
        target.rotation[2] + elapsed * target.spin[2],
      );
    } else {
      group.rotation.set(target.rotation[0], target.rotation[1], target.rotation[2]);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow geometry={geometry}>
        <meshStandardMaterial color="#fffdf7" metalness={0.03} roughness={0.26} />
      </mesh>
      {Object.entries(FACE_TRANSFORMS).map(([face, transform]) => (
        <PipFace
          key={face}
          color={face === 'front' || face === 'left' ? '#e46d59' : '#4d4038'}
          transform={transform}
          value={faceValues[face as DiceFaceName]}
        />
      ))}
    </group>
  );
}

const FACE_TRANSFORMS: Record<
  DiceFaceName,
  { position: [number, number, number]; rotation: [number, number, number] }
> = {
  back: { position: [0, 0, -0.366], rotation: [0, Math.PI, 0] },
  bottom: { position: [0, -0.366, 0], rotation: [Math.PI / 2, 0, 0] },
  front: { position: [0, 0, 0.366], rotation: [0, 0, 0] },
  left: { position: [-0.366, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  right: { position: [0.366, 0, 0], rotation: [0, Math.PI / 2, 0] },
  top: { position: [0, 0.366, 0], rotation: [-Math.PI / 2, 0, 0] },
};

function PipFace({
  color,
  transform,
  value,
}: {
  color: string;
  transform: { position: [number, number, number]; rotation: [number, number, number] };
  value: number;
}) {
  return (
    <group position={transform.position} rotation={transform.rotation}>
      {getPipPositions(value).map(([x, y], index) => (
        <mesh key={`pip-${value}-${index}`} position={[x, y, 0.003]}>
          <circleGeometry args={[0.048, 22]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function getLidTarget(isOpen: boolean, lidOffset: Point) {
  const dragX = lidOffset.x / 76;
  const dragY = -lidOffset.y / 70;
  const openAmount = MathUtils.clamp((Math.abs(dragX) + Math.max(0, dragY)) / 2.1, 0, 1);
  const baseOpen = isOpen ? 1 : openAmount;
  return {
    position: [
      MathUtils.lerp(0, 2.02, baseOpen) + dragX * 0.12,
      MathUtils.lerp(1.34, 2.16, baseOpen),
      MathUtils.lerp(0.02, -1.3, baseOpen),
    ] as [number, number, number],
    rotation: [
      MathUtils.lerp(0, -0.36, baseOpen),
      MathUtils.lerp(0, -0.34, baseOpen),
      MathUtils.lerp(0, -0.3, baseOpen),
    ] as [number, number, number],
  };
}

function getPipPositions(value: number) {
  const p = 0.18;
  if (value === 1) return [[0, 0]];
  if (value === 2)
    return [
      [-p, p],
      [p, -p],
    ];
  if (value === 3)
    return [
      [-p, p],
      [0, 0],
      [p, -p],
    ];
  if (value === 4)
    return [
      [-p, p],
      [p, p],
      [-p, -p],
      [p, -p],
    ];
  if (value === 5)
    return [
      [-p, p],
      [p, p],
      [0, 0],
      [-p, -p],
      [p, -p],
    ];
  return [
    [-p, p],
    [p, p],
    [-p, 0],
    [p, 0],
    [-p, -p],
    [p, -p],
  ];
}
