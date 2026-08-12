import type { NpcId, NpcVec3 } from './npc';
import type { VehicleId } from './playable-world';
import { scaleTownVec3 } from './town-layout';

export type WorldEventId =
  | 'harbor-cargo'
  | 'greenhouse-watering'
  | 'parcel-delivery'
  | 'roadside-repair'
  | 'plaza-escort';
export type WorldEventKind = 'cargo' | 'watering' | 'parcel' | 'repair' | 'escort';
export type WorldEventPhase = 'queued' | 'active' | 'participating' | 'choosing' | 'completed';
export type WorldEventActor = 'resident' | 'vehicle';
export type WorldEventAction =
  | 'carry'
  | 'water'
  | 'deliver'
  | 'repair'
  | 'guide'
  | 'receive'
  | 'drive'
  | 'tow';

export interface WorldEventStageDefinition {
  stageId: string;
  title: string;
  location: string;
  actionLabel: string;
  resultLabel: string;
  actor: WorldEventActor;
  action: WorldEventAction;
  assignedResidentId: NpcId | null;
  assignedVehicleId: VehicleId | null;
  position: NpcVec3;
  interactionRadius: number;
  automaticDuration: number;
  playerDuration: number;
}

export interface WorldEventBranchOption {
  id: string;
  label: string;
  outcomeLabel: string;
  stageOverrides: Readonly<Partial<Record<string, Partial<WorldEventStageDefinition>>>>;
}

export interface WorldEventBranchDefinition {
  afterStageId: string;
  prompt: string;
  timeoutSeconds: number;
  defaultOptionId: string;
  options: readonly WorldEventBranchOption[];
}

export interface WorldEventDefinition {
  id: WorldEventId;
  kind: WorldEventKind;
  title: string;
  stages: readonly WorldEventStageDefinition[];
  branch?: WorldEventBranchDefinition;
}

export interface WorldEventRuntime {
  id: WorldEventId;
  phase: WorldEventPhase;
  progress: number;
  stageIndex: number;
  completedStages: number;
  participantId: NpcId | null;
  vehicleParticipantId: VehicleId | null;
  completedBy: 'npc' | 'player' | null;
  branchId: string | null;
}

export interface WorldEventSessionState {
  seed: number;
  cycle: number;
  activeIndex: number;
  cooldownRemaining: number;
  completedTotal: number;
  completedStagesTotal: number;
  events: readonly WorldEventRuntime[];
}

export interface CurrentWorldEvent extends WorldEventRuntime, WorldEventStageDefinition {
  kind: WorldEventKind;
  chainTitle: string;
  stageCount: number;
  branchPrompt: string | null;
  branchOptions: readonly Pick<WorldEventBranchOption, 'id' | 'label' | 'outcomeLabel'>[];
  branchSecondsRemaining: number;
  selectedBranchLabel: string | null;
  selectedBranchOutcome: string | null;
}

export interface WorldEventStepContext {
  assignedNpcWorking: boolean;
  assignedVehicleWorking: boolean;
  participantNearby: boolean;
}

export interface WorldEventHudState {
  sessionSize: number;
  cycle: number;
  completedTotal: number;
  current: CurrentWorldEvent | null;
  nearby: boolean;
  controlledTask: string | null;
}

export const EMPTY_WORLD_EVENT_HUD_STATE: Readonly<WorldEventHudState> = Object.freeze({
  sessionSize: 0,
  cycle: 0,
  completedTotal: 0,
  current: null,
  nearby: false,
  controlledTask: null,
});

const residentStage = (
  stage: Omit<WorldEventStageDefinition, 'actor' | 'assignedVehicleId' | 'interactionRadius'> & {
    interactionRadius?: number;
  },
): WorldEventStageDefinition => ({
  ...stage,
  position: scaleTownVec3(stage.position),
  actor: 'resident',
  assignedVehicleId: null,
  interactionRadius: stage.interactionRadius ?? 2.1,
});

const vehicleStage = (
  stage: Omit<WorldEventStageDefinition, 'actor' | 'assignedResidentId' | 'interactionRadius'> & {
    interactionRadius?: number;
  },
): WorldEventStageDefinition => ({
  ...stage,
  position: scaleTownVec3(stage.position),
  actor: 'vehicle',
  assignedResidentId: null,
  interactionRadius: stage.interactionRadius ?? 3.2,
});

export function applyWorldEventStageOverride(
  stage: Readonly<WorldEventStageDefinition>,
  override: Readonly<Partial<WorldEventStageDefinition>> | undefined,
): WorldEventStageDefinition {
  if (!override) return { ...stage, position: [...stage.position] };
  return {
    ...stage,
    ...override,
    position: override.position ? scaleTownVec3(override.position) : [...stage.position],
  };
}

export const WORLD_EVENT_CATALOG: readonly WorldEventDefinition[] = Object.freeze([
  {
    id: 'harbor-cargo',
    kind: 'cargo',
    title: '港口补给线',
    branch: {
      afterStageId: 'van-loading',
      prompt: '这批补给先送去哪里？',
      timeoutSeconds: 6,
      defaultOptionId: 'cargo-greenhouse',
      options: [
        {
          id: 'cargo-greenhouse',
          label: '优先温室',
          outcomeLabel: '温室获得整批补给',
          stageOverrides: {
            'greenhouse-transfer': { title: '优先运往温室' },
          },
        },
        {
          id: 'cargo-market',
          label: '分给街区',
          outcomeLabel: '补给转交中心集市',
          stageOverrides: {
            'greenhouse-transfer': {
              title: '运往中心集市',
              location: '中心广场车位',
              resultLabel: '补给抵达集市',
              position: [4.7, 0.38, -5.05],
            },
            'supply-receive': {
              title: '街区接收补给',
              location: '中心集市',
              resultLabel: '街区补给入库',
              assignedResidentId: 'baker',
              position: [4.7, 0.22, -4.4],
            },
          },
        },
      ],
    },
    stages: [
      residentStage({
        stageId: 'dock-unload',
        title: '飞艇货物卸船',
        location: '港口货场',
        actionLabel: '协助卸货',
        resultLabel: '货箱已落地',
        action: 'carry',
        assignedResidentId: 'harborhand',
        position: [-22.4, 0.22, 6.1],
        automaticDuration: 10,
        playerDuration: 2.8,
      }),
      residentStage({
        stageId: 'van-loading',
        title: '补给装车',
        location: '港口支路',
        actionLabel: '抬箱装车',
        resultLabel: '补给已装车',
        action: 'carry',
        assignedResidentId: 'harborhand',
        position: [-20.5, 0.22, 2.8],
        automaticDuration: 9,
        playerDuration: 2.6,
      }),
      vehicleStage({
        stageId: 'greenhouse-transfer',
        title: '运往温室',
        location: '温室车位',
        actionLabel: '确认交货',
        resultLabel: '补给抵达温室',
        action: 'drive',
        assignedVehicleId: 'cream',
        position: [16, 0.38, 0],
        automaticDuration: 3.6,
        playerDuration: 2.2,
      }),
      residentStage({
        stageId: 'supply-receive',
        title: '温室接收补给',
        location: '玻璃温室',
        actionLabel: '清点物资',
        resultLabel: '温室补给入库',
        action: 'receive',
        assignedResidentId: 'gardener',
        position: [16.2, 0.22, 9.5],
        automaticDuration: 8,
        playerDuration: 2.4,
      }),
    ],
  },
  {
    id: 'greenhouse-watering',
    kind: 'watering',
    title: '温室灌溉恢复',
    branch: {
      afterStageId: 'valve-inspection',
      prompt: '用什么方式恢复供水？',
      timeoutSeconds: 6,
      defaultOptionId: 'watering-tanker',
      options: [
        {
          id: 'watering-tanker',
          label: '调备用水箱',
          outcomeLabel: '备用水箱接入管网',
          stageOverrides: {
            'water-delivery': { title: '调来备用水箱' },
          },
        },
        {
          id: 'watering-cistern',
          label: '接雨水储罐',
          outcomeLabel: '雨水储罐接入管网',
          stageOverrides: {
            'water-delivery': {
              title: '接通雨水储罐',
              location: '温室蓄水区',
              actionLabel: '接通储罐',
              resultLabel: '储罐管线就位',
              actor: 'resident',
              action: 'repair',
              assignedResidentId: 'gardener',
              assignedVehicleId: null,
              position: [21, 0.22, 3.9],
              interactionRadius: 2.1,
            },
            'crop-watering': { resultLabel: '苗床启用雨水灌溉' },
          },
        },
      ],
    },
    stages: [
      residentStage({
        stageId: 'valve-inspection',
        title: '检查灌溉阀',
        location: '玻璃温室',
        actionLabel: '检查阀门',
        resultLabel: '阀门故障已定位',
        action: 'repair',
        assignedResidentId: 'gardener',
        position: [16.2, 0.22, 9.5],
        automaticDuration: 8,
        playerDuration: 2.4,
      }),
      vehicleStage({
        stageId: 'water-delivery',
        title: '送达备用水箱',
        location: '温室车位',
        actionLabel: '连接水箱',
        resultLabel: '备用水箱就位',
        action: 'drive',
        assignedVehicleId: 'sage',
        position: [19, 0.38, -1.1],
        automaticDuration: 3.2,
        playerDuration: 2.1,
      }),
      residentStage({
        stageId: 'crop-watering',
        title: '恢复作物灌溉',
        location: '温室苗床',
        actionLabel: '打开灌溉',
        resultLabel: '苗床恢复供水',
        action: 'water',
        assignedResidentId: 'gardener',
        position: [16.1, 0.22, 10.8],
        automaticDuration: 10,
        playerDuration: 2.8,
      }),
    ],
  },
  {
    id: 'parcel-delivery',
    kind: 'parcel',
    title: '北街加急件',
    branch: {
      afterStageId: 'parcel-sort',
      prompt: '加急件怎么送？',
      timeoutSeconds: 6,
      defaultOptionId: 'parcel-van',
      options: [
        {
          id: 'parcel-van',
          label: '车辆快送',
          outcomeLabel: '配送车接下加急件',
          stageOverrides: {
            'north-street-drive': { title: '车辆快送北街' },
          },
        },
        {
          id: 'parcel-walk',
          label: '邮差抄近路',
          outcomeLabel: '邮差从步行支路穿过',
          stageOverrides: {
            'north-street-drive': {
              title: '邮差穿街送件',
              location: '北街步行支路',
              actionLabel: '穿过支路',
              resultLabel: '邮差抵达北街',
              actor: 'resident',
              action: 'carry',
              assignedResidentId: 'courier',
              assignedVehicleId: null,
              position: [7.2, 0.22, 10.8],
              interactionRadius: 2.1,
            },
          },
        },
      ],
    },
    stages: [
      residentStage({
        stageId: 'parcel-sort',
        title: '分拣加急包裹',
        location: '镇政厅门廊',
        actionLabel: '核对标签',
        resultLabel: '包裹完成分拣',
        action: 'carry',
        assignedResidentId: 'courier',
        position: [-5.2, 0.22, 11.2],
        automaticDuration: 8,
        playerDuration: 2.3,
      }),
      vehicleStage({
        stageId: 'north-street-drive',
        title: '送往北街住区',
        location: '北街路口',
        actionLabel: '确认到达',
        resultLabel: '配送车抵达北街',
        action: 'drive',
        assignedVehicleId: 'amber',
        position: [9.3, 0.38, 4.5],
        automaticDuration: 3.2,
        playerDuration: 2,
      }),
      residentStage({
        stageId: 'doorstep-delivery',
        title: '递交迟到的包裹',
        location: '北街住区',
        actionLabel: '递交包裹',
        resultLabel: '住户已签收',
        action: 'deliver',
        assignedResidentId: 'courier',
        position: [7.2, 0.22, 10.8],
        automaticDuration: 9,
        playerDuration: 2.4,
      }),
    ],
  },
  {
    id: 'roadside-repair',
    kind: 'repair',
    title: '港口支路救援',
    branch: {
      afterStageId: 'breakdown-check',
      prompt: '这辆车怎么处理？',
      timeoutSeconds: 6,
      defaultOptionId: 'roadside-tow',
      options: [
        {
          id: 'roadside-tow',
          label: '拖回工坊',
          outcomeLabel: '故障车将转入工坊',
          stageOverrides: {
            'workshop-tow': { title: '拖回港口工坊' },
          },
        },
        {
          id: 'roadside-fix',
          label: '就地维修',
          outcomeLabel: '技师决定现场抢修',
          stageOverrides: {
            'workshop-tow': {
              title: '就地修复传动轴',
              location: '港口支路',
              actionLabel: '递交维修工具',
              resultLabel: '传动轴完成抢修',
              actor: 'resident',
              action: 'repair',
              assignedResidentId: 'mechanic',
              assignedVehicleId: null,
              position: [-16.8, 0.22, 2.8],
              interactionRadius: 2.1,
            },
            'wheel-repair': {
              title: '完成道路安全复检',
              location: '港口支路',
              actionLabel: '复检车辆',
              resultLabel: '车辆可以继续上路',
              assignedResidentId: 'ranger',
              position: [-16.2, 0.22, 2.8],
            },
          },
        },
      ],
    },
    stages: [
      residentStage({
        stageId: 'breakdown-check',
        title: '检查抛锚车辆',
        location: '港口支路',
        actionLabel: '诊断故障',
        resultLabel: '故障原因已确认',
        action: 'repair',
        assignedResidentId: 'mechanic',
        position: [-16.8, 0.22, 2.8],
        automaticDuration: 10,
        playerDuration: 3,
      }),
      vehicleStage({
        stageId: 'workshop-tow',
        title: '拖离港口主路',
        location: '港口路口',
        actionLabel: '固定拖车',
        resultLabel: '故障车转入维修支路',
        action: 'tow',
        assignedVehicleId: 'sage',
        position: [-14, 0.38, 0],
        automaticDuration: 3.8,
        playerDuration: 2.5,
      }),
      residentStage({
        stageId: 'wheel-repair',
        title: '更换受损轮毂',
        location: '港口工坊',
        actionLabel: '拧紧轮毂',
        resultLabel: '车辆恢复可用',
        action: 'repair',
        assignedResidentId: 'mechanic',
        position: [-20.5, 0.22, 2.8],
        automaticDuration: 11,
        playerDuration: 3,
      }),
    ],
  },
  {
    id: 'plaza-escort',
    kind: 'escort',
    title: '访客入镇接力',
    branch: {
      afterStageId: 'visitor-welcome',
      prompt: '怎么带访客熟悉小镇？',
      timeoutSeconds: 6,
      defaultOptionId: 'escort-taxi',
      options: [
        {
          id: 'escort-taxi',
          label: '乘车去花园',
          outcomeLabel: '出租车前来接送访客',
          stageOverrides: {
            'visitor-taxi': { title: '乘车前往花园' },
          },
        },
        {
          id: 'escort-walk',
          label: '步行看街景',
          outcomeLabel: '访客选择沿街步行',
          stageOverrides: {
            'visitor-taxi': {
              title: '陪访客步行看街景',
              location: '中心街区',
              actionLabel: '继续带路',
              resultLabel: '访客走到花园路口',
              actor: 'resident',
              action: 'guide',
              assignedResidentId: 'photographer',
              assignedVehicleId: null,
              position: [9.3, 0.22, 4.5],
              interactionRadius: 2.1,
            },
          },
        },
      ],
    },
    stages: [
      residentStage({
        stageId: 'visitor-welcome',
        title: '接到迷路访客',
        location: '中心广场',
        actionLabel: '确认目的地',
        resultLabel: '访客找到向导',
        action: 'guide',
        assignedResidentId: 'ranger',
        position: [4.7, 0.22, -5.05],
        automaticDuration: 8,
        playerDuration: 2.2,
      }),
      vehicleStage({
        stageId: 'visitor-taxi',
        title: '载访客前往花园',
        location: '花园路口',
        actionLabel: '让访客下车',
        resultLabel: '访客抵达花园',
        action: 'drive',
        assignedVehicleId: 'navy',
        position: [9.3, 0.38, 4.5],
        automaticDuration: 3.4,
        playerDuration: 2.2,
      }),
      residentStage({
        stageId: 'garden-guide',
        title: '指引温室方向',
        location: '花园入口',
        actionLabel: '指引路线',
        resultLabel: '访客顺利入园',
        action: 'guide',
        assignedResidentId: 'ranger',
        position: [16.2, 0.22, 3.2],
        automaticDuration: 9,
        playerDuration: 2.3,
      }),
    ],
  },
]);

const getDefinition = (id: WorldEventId): WorldEventDefinition =>
  WORLD_EVENT_CATALOG.find((event) => event.id === id) ?? WORLD_EVENT_CATALOG[0];

const randomSequence = (seed: number): (() => number) => {
  let value = (Math.floor(seed) || 1) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const createRuntime = (id: WorldEventId, phase: WorldEventPhase): WorldEventRuntime => ({
  id,
  phase,
  progress: 0,
  stageIndex: 0,
  completedStages: 0,
  participantId: null,
  vehicleParticipantId: null,
  completedBy: null,
  branchId: null,
});

export function createWorldEventSession(seed: number): WorldEventSessionState {
  const random = randomSequence(seed);
  const shuffled = [...WORLD_EVENT_CATALOG];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const count = 3 + Math.floor(random() * 3);
  return {
    seed,
    cycle: 0,
    activeIndex: 0,
    cooldownRemaining: 0,
    completedTotal: 0,
    completedStagesTotal: 0,
    events: shuffled
      .slice(0, count)
      .map((event, index) => createRuntime(event.id, index === 0 ? 'active' : 'queued')),
  };
}

export function getCurrentWorldEvent(
  state: Readonly<WorldEventSessionState>,
): CurrentWorldEvent | null {
  const runtime = state.events[state.activeIndex];
  if (!runtime) return null;
  const definition = getDefinition(runtime.id);
  const baseStage = definition.stages[runtime.stageIndex];
  const selectedBranch = definition.branch?.options.find(
    (option) => option.id === runtime.branchId,
  );
  const stage = baseStage
    ? applyWorldEventStageOverride(baseStage, selectedBranch?.stageOverrides[baseStage.stageId])
    : null;
  if (!stage) return null;
  return {
    ...stage,
    ...runtime,
    kind: definition.kind,
    chainTitle: definition.title,
    stageCount: definition.stages.length,
    branchPrompt: definition.branch?.prompt ?? null,
    branchOptions:
      definition.branch?.options.map(({ id, label, outcomeLabel }) => ({
        id,
        label,
        outcomeLabel,
      })) ?? [],
    branchSecondsRemaining: runtime.phase === 'choosing' ? state.cooldownRemaining : 0,
    selectedBranchLabel: selectedBranch?.label ?? null,
    selectedBranchOutcome: selectedBranch?.outcomeLabel ?? null,
  };
}

export function chooseWorldEventBranch(
  state: Readonly<WorldEventSessionState>,
  optionId: string,
): WorldEventSessionState {
  const current = getCurrentWorldEvent(state);
  if (!current || current.phase !== 'choosing') return state as WorldEventSessionState;
  const definition = getDefinition(current.id);
  const option = definition.branch?.options.find((candidate) => candidate.id === optionId);
  if (!option) return state as WorldEventSessionState;
  return {
    ...state,
    cooldownRemaining: 0,
    events: state.events.map((event, index) =>
      index === state.activeIndex ? { ...event, phase: 'completed', branchId: option.id } : event,
    ),
  };
}

export function didWorldEventStageComplete(
  before: Readonly<CurrentWorldEvent> | null,
  after: Readonly<CurrentWorldEvent> | null,
): boolean {
  return Boolean(
    before &&
      after?.id === before.id &&
      after.stageId === before.stageId &&
      (before.phase === 'active' || before.phase === 'participating') &&
      (after.phase === 'completed' || after.phase === 'choosing'),
  );
}

const distanceToEvent = (position: NpcVec3, event: CurrentWorldEvent): number =>
  Math.hypot(position[0] - event.position[0], position[2] - event.position[2]);

export function tryStartWorldEvent(
  state: Readonly<WorldEventSessionState>,
  residentId: NpcId,
  position: NpcVec3,
): WorldEventSessionState {
  const current = getCurrentWorldEvent(state);
  if (
    !current ||
    current.actor !== 'resident' ||
    current.phase !== 'active' ||
    distanceToEvent(position, current) > current.interactionRadius
  ) {
    return state as WorldEventSessionState;
  }
  return {
    ...state,
    events: state.events.map((event, index) =>
      index === state.activeIndex
        ? { ...event, phase: 'participating', participantId: residentId }
        : event,
    ),
  };
}

export function tryStartVehicleWorldEvent(
  state: Readonly<WorldEventSessionState>,
  vehicleId: VehicleId,
  position: NpcVec3,
): WorldEventSessionState {
  const current = getCurrentWorldEvent(state);
  if (
    !current ||
    current.actor !== 'vehicle' ||
    current.phase !== 'active' ||
    distanceToEvent(position, current) > current.interactionRadius
  ) {
    return state as WorldEventSessionState;
  }
  return {
    ...state,
    events: state.events.map((event, index) =>
      index === state.activeIndex
        ? { ...event, phase: 'participating', vehicleParticipantId: vehicleId }
        : event,
    ),
  };
}

export function cancelWorldEventParticipation(
  state: Readonly<WorldEventSessionState>,
  residentId: NpcId,
): WorldEventSessionState {
  const current = getCurrentWorldEvent(state);
  if (current?.phase !== 'participating' || current.participantId !== residentId) {
    return state as WorldEventSessionState;
  }
  return {
    ...state,
    events: state.events.map((event, index) =>
      index === state.activeIndex ? { ...event, phase: 'active', participantId: null } : event,
    ),
  };
}

export function cancelVehicleWorldEventParticipation(
  state: Readonly<WorldEventSessionState>,
  vehicleId: VehicleId,
): WorldEventSessionState {
  const current = getCurrentWorldEvent(state);
  if (current?.phase !== 'participating' || current.vehicleParticipantId !== vehicleId) {
    return state as WorldEventSessionState;
  }
  return {
    ...state,
    events: state.events.map((event, index) =>
      index === state.activeIndex
        ? { ...event, phase: 'active', vehicleParticipantId: null }
        : event,
    ),
  };
}

const activateNextStageOrEvent = (
  state: Readonly<WorldEventSessionState>,
): WorldEventSessionState => {
  const runtime = state.events[state.activeIndex];
  if (!runtime) return state as WorldEventSessionState;
  const definition = getDefinition(runtime.id);
  if (runtime.stageIndex + 1 < definition.stages.length) {
    return {
      ...state,
      cooldownRemaining: 0,
      events: state.events.map((event, index) =>
        index === state.activeIndex
          ? {
              ...event,
              stageIndex: event.stageIndex + 1,
              phase: 'active',
              progress: 0,
              participantId: null,
              vehicleParticipantId: null,
              completedBy: null,
            }
          : event,
      ),
    };
  }

  const nextIndex = state.activeIndex + 1;
  if (nextIndex < state.events.length) {
    return {
      ...state,
      activeIndex: nextIndex,
      cooldownRemaining: 0,
      events: state.events.map((event, index) =>
        index === nextIndex ? { ...event, phase: 'active' } : event,
      ),
    };
  }
  const rotated = [...state.events.slice(1), state.events[0]].map((event, index) =>
    createRuntime(event.id, index === 0 ? 'active' : 'queued'),
  );
  return {
    ...state,
    cycle: state.cycle + 1,
    activeIndex: 0,
    cooldownRemaining: 0,
    events: rotated,
  };
};

export function stepWorldEventSession(
  state: Readonly<WorldEventSessionState>,
  deltaSeconds: number,
  context: Readonly<WorldEventStepContext>,
): WorldEventSessionState {
  const delta = Math.max(0, deltaSeconds);
  const current = getCurrentWorldEvent(state);
  if (!current || delta <= 0) return state as WorldEventSessionState;
  if (current.phase === 'choosing') {
    const cooldownRemaining = Math.max(0, state.cooldownRemaining - delta);
    if (cooldownRemaining > 0) return { ...state, cooldownRemaining };
    const definition = getDefinition(current.id);
    const selected = chooseWorldEventBranch(
      { ...state, cooldownRemaining: 0 },
      definition.branch?.defaultOptionId ?? '',
    );
    return activateNextStageOrEvent(selected);
  }
  if (current.phase === 'completed') {
    const cooldownRemaining = Math.max(0, state.cooldownRemaining - delta);
    if (cooldownRemaining > 0) return { ...state, cooldownRemaining };
    return activateNextStageOrEvent({ ...state, cooldownRemaining: 0 });
  }

  const assignedWorkerReady =
    current.actor === 'resident' ? context.assignedNpcWorking : context.assignedVehicleWorking;
  const canProgress =
    (current.phase === 'active' && assignedWorkerReady) ||
    (current.phase === 'participating' && context.participantNearby);
  if (!canProgress) return state as WorldEventSessionState;
  const duration =
    current.phase === 'participating' ? current.playerDuration : current.automaticDuration;
  const progress = Math.min(1, current.progress + delta / duration);
  const completed = progress >= 1;
  const finalStage = current.stageIndex >= current.stageCount - 1;
  const definition = getDefinition(current.id);
  const branch = definition.branch;
  const awaitingChoice = completed && !current.branchId && branch?.afterStageId === current.stageId;
  return {
    ...state,
    completedTotal: state.completedTotal + (completed && finalStage ? 1 : 0),
    completedStagesTotal: state.completedStagesTotal + (completed ? 1 : 0),
    cooldownRemaining: awaitingChoice
      ? branch.timeoutSeconds
      : completed
        ? finalStage
          ? 4
          : 2.4
        : state.cooldownRemaining,
    events: state.events.map((event, index) =>
      index === state.activeIndex
        ? {
            ...event,
            phase: completed ? (awaitingChoice ? 'choosing' : 'completed') : event.phase,
            progress,
            completedStages: completed
              ? Math.max(event.completedStages, event.stageIndex + 1)
              : event.completedStages,
            participantId: completed ? null : event.participantId,
            vehicleParticipantId: completed ? null : event.vehicleParticipantId,
            completedBy: completed ? (current.phase === 'participating' ? 'player' : 'npc') : null,
          }
        : event,
    ),
  };
}
