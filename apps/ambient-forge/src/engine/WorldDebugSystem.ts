import {
  BoxGeometry,
  BufferGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from 'three';
import type { NavigationGraph, TownCollider } from '../core/town-navigation';
import { disposeObject3D } from './dispose';

export interface WorldDebugSystemAssembly {
  root: Group;
  dispose: () => void;
}

const routeLines = (
  name: string,
  graph: Readonly<NavigationGraph>,
  color: string,
): LineSegments => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const points: Vector3[] = [];
  const visited = new Set<string>();
  for (const node of graph.nodes) {
    for (const neighborId of node.neighbors) {
      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;
      const edgeId = [node.id, neighborId].sort().join(':');
      if (visited.has(edgeId)) continue;
      visited.add(edgeId);
      points.push(
        new Vector3(node.position[0], 0.34, node.position[1]),
        new Vector3(neighbor.position[0], 0.34, neighbor.position[1]),
      );
    }
  }
  const lines = new LineSegments(
    new BufferGeometry().setFromPoints(points),
    new LineBasicMaterial({ color, transparent: true, opacity: 0.82, depthTest: false }),
  );
  lines.name = name;
  lines.renderOrder = 20;
  return lines;
};

export function createWorldDebugSystem(
  colliders: readonly TownCollider[],
  pedestrianGraph: Readonly<NavigationGraph>,
  vehicleGraph: Readonly<NavigationGraph>,
): WorldDebugSystemAssembly {
  const root = new Group();
  root.name = 'world-debug-system';
  const colliderGroup = new Group();
  colliderGroup.name = 'debug-colliders';
  const material = new LineBasicMaterial({
    color: '#ff6b55',
    transparent: true,
    opacity: 0.72,
    depthTest: false,
  });
  for (const collider of colliders) {
    const lines = new LineSegments(
      new EdgesGeometry(
        new BoxGeometry(
          collider.halfSize[0] * 2,
          Math.max(0.15, collider.height),
          collider.halfSize[1] * 2,
        ),
      ),
      material,
    );
    lines.name = `debug-collider-${collider.id}`;
    lines.position.set(collider.center[0], collider.height * 0.5 + 0.2, collider.center[1]);
    lines.renderOrder = 21;
    colliderGroup.add(lines);
  }
  root.add(
    colliderGroup,
    routeLines('debug-pedestrian-routes', pedestrianGraph, '#67e8f9'),
    routeLines('debug-vehicle-routes', vehicleGraph, '#facc15'),
  );
  return {
    root,
    dispose() {
      disposeObject3D(root);
      root.clear();
    },
  };
}
