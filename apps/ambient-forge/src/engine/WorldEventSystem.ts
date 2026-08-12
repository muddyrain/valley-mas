import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { NpcId, NpcVec3 } from '../core/npc';
import type { VehicleId } from '../core/playable-world';
import {
  applyWorldEventStageOverride,
  type CurrentWorldEvent,
  cancelVehicleWorldEventParticipation,
  cancelWorldEventParticipation,
  chooseWorldEventBranch,
  createWorldEventSession,
  getCurrentWorldEvent,
  stepWorldEventSession,
  tryStartVehicleWorldEvent,
  tryStartWorldEvent,
  WORLD_EVENT_CATALOG,
  type WorldEventAction,
  type WorldEventId,
  type WorldEventSessionState,
  type WorldEventStageDefinition,
  type WorldEventStepContext,
} from '../core/world-events';
import { disposeObject3D } from './dispose';

export interface WorldEventSnapshot {
  sessionSize: number;
  cycle: number;
  completedTotal: number;
  completedStagesTotal: number;
  current: CurrentWorldEvent | null;
  eventIds: readonly WorldEventId[];
}

export interface WorldEventSystemAssembly {
  root: Group;
  getSnapshot: () => WorldEventSnapshot;
  tryInteract: (residentId: NpcId, position: NpcVec3) => boolean;
  tryInteractVehicle: (vehicleId: VehicleId, position: NpcVec3) => boolean;
  cancelParticipation: (residentId: NpcId) => boolean;
  cancelVehicleParticipation: (vehicleId: VehicleId) => boolean;
  chooseBranch: (optionId: string) => boolean;
  isParticipantNearby: (position: NpcVec3) => boolean;
  update: (elapsed: number, delta: number, context: WorldEventStepContext) => boolean;
  dispose: () => void;
}

interface StageVisual {
  root: Group;
  beacon: Mesh;
  outcome: Mesh;
  accentMaterial: MeshStandardMaterial;
  animatedParts: Mesh[];
  action: WorldEventAction;
  branchChoice: Mesh | null;
}

interface EventVisual {
  root: Group;
  stages: Map<string, StageVisual>;
}

const material = (color: string, roughness = 0.76, metalness = 0.04) =>
  new MeshStandardMaterial({ color, roughness, metalness });

const mesh = (
  name: string,
  geometry: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry | TorusGeometry,
  meshMaterial: MeshStandardMaterial,
  position: readonly [number, number, number],
): Mesh => {
  const result = new Mesh(geometry, meshMaterial);
  result.name = name;
  result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
};

function createStageVisual(
  eventId: WorldEventId,
  stage: WorldEventStageDefinition,
  hasBranchChoice: boolean,
): StageVisual {
  const root = new Group();
  root.name = `${eventId}-${stage.stageId}`;
  root.position.set(...stage.position);
  root.userData.worldEventId = eventId;
  root.userData.worldEventStageId = stage.stageId;
  root.userData.worldEventAction = stage.action;
  const accentMaterial = material(stage.actor === 'vehicle' ? '#85bdd0' : '#f0c77c', 0.52, 0.12);
  accentMaterial.emissive.set(stage.actor === 'vehicle' ? '#285b6b' : '#8a5a23');
  accentMaterial.emissiveIntensity = 0.16;
  const darkMaterial = material('#3b4b49', 0.82, 0.08);
  const woodMaterial = material('#8b6040', 0.88);
  const greenMaterial = material('#7eaa72', 0.9);
  const animatedParts: Mesh[] = [];
  const beacon = mesh(
    `${eventId}-${stage.stageId}-beacon`,
    new TorusGeometry(stage.actor === 'vehicle' ? 1.12 : 0.78, 0.055, 8, 36),
    accentMaterial,
    [0, 0.08, 0],
  );
  beacon.rotation.x = Math.PI / 2;
  root.add(beacon);

  if (stage.action === 'carry' || stage.action === 'deliver' || stage.action === 'receive') {
    const parcel = mesh(
      `${eventId}-${stage.stageId}-parcel`,
      new BoxGeometry(0.82, 0.58, 0.68),
      woodMaterial,
      [0, 0.32, 0],
    );
    const ribbon = mesh(
      `${eventId}-${stage.stageId}-ribbon`,
      new BoxGeometry(0.14, 0.61, 0.72),
      accentMaterial,
      [0, 0.34, 0],
    );
    animatedParts.push(parcel, ribbon);
    root.add(parcel, ribbon);
  } else if (stage.action === 'water') {
    const valve = mesh(
      `${eventId}-${stage.stageId}-valve`,
      new TorusGeometry(0.28, 0.045, 8, 20),
      accentMaterial,
      [0, 0.72, 0],
    );
    valve.rotation.y = Math.PI / 2;
    const droplet = mesh(
      `${eventId}-${stage.stageId}-water`,
      new SphereGeometry(0.12, 10, 8),
      material('#6fb8cc', 0.22, 0.08),
      [0.42, 0.36, 0],
    );
    animatedParts.push(valve, droplet);
    root.add(
      mesh(
        `${eventId}-${stage.stageId}-pipe`,
        new CylinderGeometry(0.09, 0.12, 0.78, 10),
        darkMaterial,
        [0, 0.4, 0],
      ),
      valve,
      droplet,
      mesh(
        `${eventId}-${stage.stageId}-sprout`,
        new ConeGeometry(0.25, 0.58, 7),
        greenMaterial,
        [0.66, 0.31, 0.1],
      ),
    );
  } else if (stage.action === 'repair') {
    const wheel = mesh(
      `${eventId}-${stage.stageId}-wheel`,
      new TorusGeometry(0.42, 0.14, 10, 22),
      darkMaterial,
      [-0.34, 0.45, 0],
    );
    wheel.rotation.y = Math.PI / 2;
    animatedParts.push(wheel);
    root.add(
      wheel,
      mesh(
        `${eventId}-${stage.stageId}-toolbox`,
        new BoxGeometry(0.72, 0.32, 0.38),
        material('#b55d45', 0.7, 0.12),
        [0.45, 0.2, 0.15],
      ),
    );
  } else if (stage.action === 'guide') {
    const arrow = mesh(
      `${eventId}-${stage.stageId}-arrow`,
      new ConeGeometry(0.24, 0.52, 3),
      accentMaterial,
      [0.62, 1.28, 0],
    );
    animatedParts.push(arrow);
    root.add(
      mesh(
        `${eventId}-${stage.stageId}-suitcase`,
        new BoxGeometry(0.64, 0.72, 0.28),
        material('#6c7d8d', 0.74, 0.08),
        [0, 0.38, 0],
      ),
      mesh(
        `${eventId}-${stage.stageId}-sign`,
        new BoxGeometry(0.1, 1.15, 0.1),
        darkMaterial,
        [0.62, 0.58, 0],
      ),
      arrow,
    );
  } else {
    const flag = mesh(
      `${eventId}-${stage.stageId}-flag`,
      new BoxGeometry(0.62, 0.4, 0.08),
      accentMaterial,
      [0.48, 0.95, 0],
    );
    const wheel = mesh(
      `${eventId}-${stage.stageId}-mission-wheel`,
      new TorusGeometry(0.4, 0.12, 10, 22),
      darkMaterial,
      [-0.42, 0.44, 0],
    );
    wheel.rotation.y = Math.PI / 2;
    animatedParts.push(flag, wheel);
    root.add(
      mesh(
        `${eventId}-${stage.stageId}-flag-pole`,
        new CylinderGeometry(0.045, 0.055, 1.4, 8),
        darkMaterial,
        [0.18, 0.7, 0],
      ),
      flag,
      wheel,
    );
  }

  const outcomeMaterial = material('#9cc68e', 0.5, 0.08);
  outcomeMaterial.emissive.set('#416f3f');
  outcomeMaterial.emissiveIntensity = 0.34;
  const outcome = mesh(
    `${eventId}-${stage.stageId}-outcome`,
    new CylinderGeometry(0.34, 0.34, 0.1, 18),
    outcomeMaterial,
    [0, 0.08, 0],
  );
  outcome.visible = false;
  root.add(outcome);
  const branchChoice = hasBranchChoice
    ? mesh(
        `${eventId}-${stage.stageId}-branch-choice`,
        new BoxGeometry(0.9, 0.48, 0.12),
        material('#c2a6dd', 0.46, 0.12),
        [0, 1.5, 0],
      )
    : null;
  if (branchChoice) {
    branchChoice.visible = false;
    root.add(branchChoice);
  }
  animatedParts.forEach((part) => {
    part.userData.eventBaseY = part.position.y;
  });
  return {
    root,
    beacon,
    outcome,
    accentMaterial,
    animatedParts,
    action: stage.action,
    branchChoice,
  };
}

const cloneCurrent = (event: CurrentWorldEvent | null): CurrentWorldEvent | null =>
  event ? { ...event, position: [...event.position] } : null;

export function createWorldEventSystem(seed = Date.now()): WorldEventSystemAssembly {
  const root = new Group();
  root.name = 'world-events';
  let state: WorldEventSessionState = createWorldEventSession(seed);
  const visuals = new Map<WorldEventId, EventVisual>();

  for (const runtime of state.events) {
    const definition = WORLD_EVENT_CATALOG.find((event) => event.id === runtime.id);
    if (!definition) continue;
    const eventRoot = new Group();
    eventRoot.name = `world-event-${runtime.id}`;
    const stageVisuals = new Map<string, StageVisual>();
    for (const stage of definition.stages) {
      const visual = createStageVisual(
        runtime.id,
        stage,
        definition.branch?.afterStageId === stage.stageId,
      );
      stageVisuals.set(stage.stageId, visual);
      eventRoot.add(visual.root);
    }
    visuals.set(runtime.id, { root: eventRoot, stages: stageVisuals });
    root.add(eventRoot);
  }

  const updateVisuals = (elapsed: number) => {
    const current = getCurrentWorldEvent(state);
    for (const runtime of state.events) {
      const eventVisual = visuals.get(runtime.id);
      const definition = WORLD_EVENT_CATALOG.find((event) => event.id === runtime.id);
      if (!eventVisual || !definition) continue;
      const selectedBranch = definition.branch?.options.find(
        (option) => option.id === runtime.branchId,
      );
      eventVisual.root.userData.branchId = runtime.branchId ?? 'none';
      definition.stages.forEach((stage, stageIndex) => {
        const visual = eventVisual.stages.get(stage.stageId);
        if (!visual) return;
        const effectiveStage = applyWorldEventStageOverride(
          stage,
          selectedBranch?.stageOverrides[stage.stageId],
        );
        visual.root.position.set(...effectiveStage.position);
        visual.action = effectiveStage.action;
        visual.root.userData.worldEventAction = effectiveStage.action;
        const isCurrent = current?.id === runtime.id && current.stageIndex === stageIndex;
        const completed = runtime.completedStages > stageIndex;
        const activeProgress = isCurrent ? current.progress : completed ? 1 : 0;
        visual.beacon.visible = isCurrent && current.phase !== 'completed';
        if (visual.branchChoice) {
          visual.branchChoice.visible = isCurrent && current.phase === 'choosing';
          visual.branchChoice.rotation.y = Math.sin(elapsed * 1.8) * 0.16;
        }
        visual.outcome.visible = completed;
        visual.outcome.scale.setScalar(completed ? 1 + Math.sin(elapsed * 2.2) * 0.08 : 0.01);
        visual.beacon.rotation.z = elapsed * 0.72;
        const pulse = 1 + Math.sin(elapsed * 3.4) * 0.1;
        visual.beacon.scale.setScalar(pulse);
        visual.accentMaterial.emissiveIntensity = isCurrent ? 0.58 : completed ? 0.08 : 0.16;
        visual.animatedParts.forEach((part, index) => {
          if (visual.action === 'water') {
            part.rotation.z = elapsed * (index === 0 ? 1.2 : 0.4) * activeProgress;
            if (index > 0) part.position.y = 0.24 + ((elapsed * 0.7) % 0.42);
          } else if (visual.action === 'repair' || visual.action === 'tow') {
            part.rotation.x = elapsed * 1.4 * activeProgress;
          } else if (visual.action === 'guide' || visual.action === 'drive') {
            part.rotation.y = Math.sin(elapsed * 1.8) * 0.22 * activeProgress;
          } else {
            part.position.y =
              Number(part.userData.eventBaseY ?? part.position.y) +
              Math.sin(elapsed * 2.1 + index) * 0.025 * activeProgress;
          }
        });
      });
    }
  };
  updateVisuals(0);

  const getSnapshot = (): WorldEventSnapshot => ({
    sessionSize: state.events.length,
    cycle: state.cycle,
    completedTotal: state.completedTotal,
    completedStagesTotal: state.completedStagesTotal,
    current: cloneCurrent(getCurrentWorldEvent(state)),
    eventIds: state.events.map((event) => event.id),
  });

  return {
    root,
    getSnapshot,
    tryInteract(residentId, position) {
      const next = tryStartWorldEvent(state, residentId, position);
      if (next === state) return false;
      state = next;
      updateVisuals(0);
      return true;
    },
    tryInteractVehicle(vehicleId, position) {
      const next = tryStartVehicleWorldEvent(state, vehicleId, position);
      if (next === state) return false;
      state = next;
      updateVisuals(0);
      return true;
    },
    cancelParticipation(residentId) {
      const next = cancelWorldEventParticipation(state, residentId);
      if (next === state) return false;
      state = next;
      return true;
    },
    cancelVehicleParticipation(vehicleId) {
      const next = cancelVehicleWorldEventParticipation(state, vehicleId);
      if (next === state) return false;
      state = next;
      return true;
    },
    chooseBranch(optionId) {
      const next = chooseWorldEventBranch(state, optionId);
      if (next === state) return false;
      state = next;
      updateVisuals(0);
      return true;
    },
    isParticipantNearby(position) {
      const current = getCurrentWorldEvent(state);
      if (!current) return false;
      return (
        Math.hypot(position[0] - current.position[0], position[2] - current.position[2]) <=
        current.interactionRadius + 0.35
      );
    },
    update(elapsed, delta, context) {
      const before = getCurrentWorldEvent(state);
      const beforeBucket = Math.floor((before?.progress ?? 0) * 10);
      const beforeChoiceSecond = Math.ceil(before?.branchSecondsRemaining ?? 0);
      state = stepWorldEventSession(state, delta, context);
      updateVisuals(elapsed);
      const after = getCurrentWorldEvent(state);
      const afterBucket = Math.floor((after?.progress ?? 0) * 10);
      const afterChoiceSecond = Math.ceil(after?.branchSecondsRemaining ?? 0);
      return (
        before?.id !== after?.id ||
        before?.stageIndex !== after?.stageIndex ||
        before?.phase !== after?.phase ||
        before?.participantId !== after?.participantId ||
        before?.vehicleParticipantId !== after?.vehicleParticipantId ||
        before?.completedStages !== after?.completedStages ||
        beforeBucket !== afterBucket ||
        before?.completedBy !== after?.completedBy ||
        before?.branchId !== after?.branchId ||
        beforeChoiceSecond !== afterChoiceSecond
      );
    },
    dispose() {
      disposeObject3D(root);
      root.clear();
      visuals.clear();
    },
  };
}
