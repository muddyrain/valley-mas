import type { NpcId } from './npc';
import type { NpcRoutine } from './town-life';
import {
  findNavigationRoute,
  findNearestNavigationNode,
  type NavigationGraph,
  type TownVec2,
} from './town-navigation';

export interface ResidentDailyTask {
  label: string;
  location: string;
}

interface ResidentDailyPlan {
  workplace: string;
  work: string;
  leisure: string;
  home: string;
}

interface ResidentScheduleStops {
  work: string;
  leisure: string;
  home: string;
}

const RESIDENT_DAILY_PLANS: Readonly<Record<NpcId, ResidentDailyPlan>> = Object.freeze({
  traveler: {
    workplace: '中心广场',
    work: '整理溪谷镇见闻',
    leisure: '沿喷泉广场散步',
    home: '北街旅舍',
  },
  mechanic: {
    workplace: '港口工坊',
    work: '检修港口机械',
    leisure: '查看码头来船',
    home: '工坊宿舍',
  },
  gardener: {
    workplace: '玻璃温室',
    work: '照料温室作物',
    leisure: '打理广场花箱',
    home: '温室小屋',
  },
  baker: {
    workplace: '街角面包房',
    work: '准备今日面包',
    leisure: '采购广场香草',
    home: '面包房阁楼',
  },
  courier: {
    workplace: '镇区邮路',
    work: '投递镇区邮件',
    leisure: '整理下一轮邮袋',
    home: '南街住处',
  },
  student: {
    workplace: '溪谷学舍',
    work: '完成见习课程',
    leisure: '在广场温习笔记',
    home: '学舍宿舍',
  },
  harborhand: {
    workplace: '港口货场',
    work: '整理待运货箱',
    leisure: '检查泊位缆绳',
    home: '港口宿舍',
  },
  florist: {
    workplace: '花艺铺',
    work: '整理当季花束',
    leisure: '照看街角花圃',
    home: '花艺铺后院',
  },
  photographer: {
    workplace: '镇区街巷',
    work: '拍摄居民日常',
    leisure: '记录广场晚景',
    home: '南街暗房',
  },
  retiree: {
    workplace: '中心广场',
    work: '照看社区公告',
    leisure: '在喷泉旁休息',
    home: '西街住处',
  },
  barista: {
    workplace: '广场咖啡铺',
    work: '准备咖啡与茶点',
    leisure: '收集居民点单',
    home: '咖啡铺楼上',
  },
  ranger: {
    workplace: '溪谷镇环路',
    work: '巡查道路与围栏',
    leisure: '记录当天巡镇情况',
    home: '巡镇员住处',
  },
  shopkeeper: {
    workplace: '北部旧城书店',
    work: '整理旧城商铺货架',
    leisure: '在钟楼广场招呼邻居',
    home: '旧城公寓',
  },
  nurse: {
    workplace: '山地诊所',
    work: '准备诊所今日物资',
    leisure: '沿山地广场散步',
    home: '诊所宿舍',
  },
  teacher: {
    workplace: '山地学舍',
    work: '整理见习课程',
    leisure: '在观景台批阅笔记',
    home: '学舍宿舍',
  },
  fisher: {
    workplace: '西岸鱼市',
    work: '整理清晨渔获',
    leisure: '查看渡船靠岸',
    home: '船屋住处',
  },
  groundskeeper: {
    workplace: '东南花圃',
    work: '修整花圃和步道',
    leisure: '检查公园长椅',
    home: '园艺工坊',
  },
  musician: {
    workplace: '河岸广场',
    work: '准备今天的街头演奏',
    leisure: '沿河岸寻找新旋律',
    home: '南岸住处',
  },
});

const MOBILE_WORK_RESIDENTS = new Set<NpcId>(['courier', 'photographer', 'ranger']);

const RESIDENT_SCHEDULE_STOPS: Readonly<Record<NpcId, ResidentScheduleStops>> = Object.freeze({
  traveler: { work: 'square-n', leisure: 'square-s', home: 'square-n' },
  mechanic: { work: 'workshop', leisure: 'harbor', home: 'workshop' },
  gardener: { work: 'greenhouse', leisure: 'garden', home: 'greenhouse' },
  baker: { work: 'bakery', leisure: 'square-s', home: 'bakery' },
  courier: { work: 'town-hall', leisure: 'east-library', home: 'bakery' },
  student: { work: 'blue-home', leisure: 'square-n', home: 'blue-home' },
  harborhand: { work: 'workshop', leisure: 'harbor', home: 'workshop' },
  florist: { work: 'garden', leisure: 'east-district-square', home: 'garden' },
  photographer: { work: 'square-n', leisure: 'square-s', home: 'square-s' },
  retiree: { work: 'square-w', leisure: 'square-s', home: 'square-w' },
  barista: { work: 'sage-home', leisure: 'square-s', home: 'sage-home' },
  ranger: { work: 'town-hall', leisure: 'east-clinic', home: 'town-hall' },
  shopkeeper: {
    work: 'north-bookshop',
    leisure: 'north-old-town-square',
    home: 'north-apartments',
  },
  nurse: {
    work: 'hillside-clinic',
    leisure: 'northeast-hillside-square',
    home: 'hillside-clinic',
  },
  teacher: {
    work: 'hillside-school',
    leisure: 'northeast-hillside-square',
    home: 'hillside-school',
  },
  fisher: {
    work: 'west-coast-fish-market',
    leisure: 'west-coast-square',
    home: 'west-coast-ferry-terminal',
  },
  groundskeeper: {
    work: 'garden-nursery',
    leisure: 'southeast-garden-square',
    home: 'garden-workshop',
  },
  musician: {
    work: 'south-riverside-square',
    leisure: 'square-e',
    home: 'south-riverside-square',
  },
});

export function getResidentScheduleTime(
  selectedTimeOfDay: number,
  _smoothedEnvironmentTimeOfDay: number,
): number {
  return ((selectedTimeOfDay % 24) + 24) % 24;
}

export function getResidentRoutineDestinationStop(id: NpcId, routine: NpcRoutine): string {
  const stops = RESIDENT_SCHEDULE_STOPS[id];
  if (routine === 'commute' || routine === 'work') return stops.work;
  if (routine === 'leisure') return stops.leisure;
  return stops.home;
}

export function getResidentDestinationSlotOffset(id: NpcId, routine: NpcRoutine): [number, number] {
  const destination = getResidentRoutineDestinationStop(id, routine);
  const residents = (Object.keys(RESIDENT_SCHEDULE_STOPS) as NpcId[]).filter(
    (residentId) => getResidentRoutineDestinationStop(residentId, routine) === destination,
  );
  const index = Math.max(0, residents.indexOf(id));
  const radius =
    residents.length >= 5
      ? 1.35
      : residents.length === 4
        ? 1.25
        : residents.length === 3
          ? 1.18
          : residents.length === 2
            ? 1.1
            : 0.96;
  const destinationPhase =
    ([...destination].reduce((total, character) => total + character.charCodeAt(0), 0) % 24) *
    (Math.PI / 12);
  const angle = destinationPhase + (index / residents.length) * Math.PI * 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function planResidentRoutinePath(
  graph: Readonly<NavigationGraph>,
  id: NpcId,
  routine: NpcRoutine,
  currentPosition: TownVec2,
): string[] {
  const start = findNearestNavigationNode(graph, currentPosition);
  if (!start) return [];
  return findNavigationRoute(graph, start.id, getResidentRoutineDestinationStop(id, routine));
}

export function isResidentRoutineDestination(
  id: NpcId,
  routine: NpcRoutine,
  stopId?: string,
): boolean {
  return stopId === undefined || stopId === getResidentRoutineDestinationStop(id, routine);
}

export function shouldResidentHoldAtDestination(id: NpcId, routine: NpcRoutine): boolean {
  if (routine === 'commute' || routine === 'leisure') return true;
  if (routine === 'work') return !MOBILE_WORK_RESIDENTS.has(id);
  return false;
}

export function getResidentDailyTask(id: NpcId, routine: NpcRoutine): ResidentDailyTask {
  const plan = RESIDENT_DAILY_PLANS[id];
  if (routine === 'commute') {
    return { label: `前往${plan.workplace}`, location: plan.workplace };
  }
  if (routine === 'work') return { label: plan.work, location: plan.workplace };
  if (routine === 'leisure') return { label: plan.leisure, location: plan.workplace };
  return { label: `返回${plan.home}`, location: plan.home };
}

export function getResidentDestinationDwellSeconds(
  id: NpcId,
  routine: NpcRoutine,
  authoredSeconds: number,
  stopId?: string,
): number {
  const atRoutineDestination = isResidentRoutineDestination(id, routine, stopId);
  const followsMobileWorkRoute = routine === 'work' && MOBILE_WORK_RESIDENTS.has(id);
  if (!atRoutineDestination && !followsMobileWorkRoute) return 0;
  if (shouldResidentHoldAtDestination(id, routine) && atRoutineDestination) {
    return Number.POSITIVE_INFINITY;
  }
  const routineMinimum: Readonly<Record<NpcRoutine, number>> = {
    commute: 8,
    work: 12,
    leisure: 7,
    rest: 18,
  };
  const residentOffset =
    [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % 4;
  return Math.max(Math.max(0, authoredSeconds), routineMinimum[routine] + residentOffset * 0.65);
}
