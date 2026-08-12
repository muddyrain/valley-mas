import { describe, expect, it } from 'vitest';
import {
  getResidentDailyTask,
  getResidentDestinationDwellSeconds,
  getResidentDestinationSlotOffset,
  getResidentRoutineDestinationStop,
  getResidentScheduleTime,
  planResidentRoutinePath,
  shouldResidentHoldAtDestination,
} from './resident-schedule';

describe('resident schedule', () => {
  it('不同职业在工作时段拥有不同且明确的日常任务', () => {
    expect(getResidentDailyTask('mechanic', 'work')).toMatchObject({
      label: '检修港口机械',
      location: '港口工坊',
    });
    expect(getResidentDailyTask('gardener', 'work')).toMatchObject({
      label: '照料温室作物',
      location: '玻璃温室',
    });
    expect(getResidentDailyTask('courier', 'work').label).toBe('投递镇区邮件');
  });

  it('通勤、休闲和休息时段会给出职业对应的目的地', () => {
    expect(getResidentDailyTask('baker', 'commute').label).toBe('前往街角面包房');
    expect(getResidentDailyTask('photographer', 'leisure').label).toBe('记录广场晚景');
    expect(getResidentDailyTask('ranger', 'rest').label).toBe('返回巡镇员住处');
  });

  it('抵达日程地点后保留可观察的停留时间，不在短路线端点立即折返', () => {
    const commute = getResidentDestinationDwellSeconds('mechanic', 'commute', 2.8, 'workshop');
    const wrongCommuteStop = getResidentDestinationDwellSeconds(
      'mechanic',
      'commute',
      2.8,
      'harbor',
    );
    const work = getResidentDestinationDwellSeconds('mechanic', 'work', 2.8, 'workshop');
    const mobileWork = getResidentDestinationDwellSeconds('ranger', 'work', 2.8);
    const mobileRouteStop = getResidentDestinationDwellSeconds(
      'ranger',
      'work',
      2.8,
      'east-clinic',
    );
    const wrongLeisureStop = getResidentDestinationDwellSeconds(
      'mechanic',
      'leisure',
      2.8,
      'workshop',
    );
    const leisure = getResidentDestinationDwellSeconds('mechanic', 'leisure', 2.8, 'harbor');
    const rest = getResidentDestinationDwellSeconds('mechanic', 'rest', 2.8);

    expect(commute).toBe(Number.POSITIVE_INFINITY);
    expect(wrongCommuteStop).toBe(0);
    expect(work).toBe(Number.POSITIVE_INFINITY);
    expect(mobileWork).toBeGreaterThanOrEqual(12);
    expect(mobileRouteStop).toBeGreaterThanOrEqual(12);
    expect(wrongLeisureStop).toBe(0);
    expect(leisure).toBe(Number.POSITIVE_INFINITY);
    expect(rest).toBeGreaterThan(mobileWork);
    expect(getResidentDestinationDwellSeconds('mechanic', 'commute', 20, 'workshop')).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('为通勤、休闲和回家提供居民自己的明确地点', () => {
    expect(getResidentRoutineDestinationStop('mechanic', 'commute')).toBe('workshop');
    expect(getResidentRoutineDestinationStop('mechanic', 'work')).toBe('workshop');
    expect(getResidentRoutineDestinationStop('mechanic', 'leisure')).toBe('harbor');
    expect(getResidentRoutineDestinationStop('mechanic', 'rest')).toBe('workshop');
    expect(getResidentRoutineDestinationStop('nurse', 'commute')).toBe('hillside-clinic');
    expect(getResidentRoutineDestinationStop('nurse', 'rest')).toBe('hillside-clinic');
  });

  it('居民日程直接采用玩家选定时刻，不经过环境光的中间插值时段', () => {
    expect(getResidentScheduleTime(18.5, 8.9)).toBe(18.5);
    expect(getResidentScheduleTime(25.25, 12)).toBe(1.25);
  });

  it('通勤到达后留在目的地，固定职业留岗，流动职业才继续巡行', () => {
    expect(shouldResidentHoldAtDestination('mechanic', 'commute')).toBe(true);
    expect(shouldResidentHoldAtDestination('mechanic', 'work')).toBe(true);
    expect(shouldResidentHoldAtDestination('courier', 'work')).toBe(false);
    expect(shouldResidentHoldAtDestination('photographer', 'work')).toBe(false);
    expect(shouldResidentHoldAtDestination('ranger', 'work')).toBe(false);
    expect(shouldResidentHoldAtDestination('mechanic', 'leisure')).toBe(true);
    expect(shouldResidentHoldAtDestination('courier', 'leisure')).toBe(true);
  });

  it('通勤按当前位置规划到职业目的地的最短人行路径，不再先绕完整巡逻环线', () => {
    const graph = {
      nodes: [
        { id: 'home', position: [0, 0] as const, neighbors: ['junction', 'scenic'] },
        { id: 'junction', position: [3, 0] as const, neighbors: ['home', 'workshop'] },
        { id: 'scenic', position: [0, 8] as const, neighbors: ['home', 'workshop'] },
        { id: 'workshop', position: [6, 0] as const, neighbors: ['junction', 'scenic'] },
      ],
    };

    expect(planResidentRoutinePath(graph, 'mechanic', 'commute', [0.2, 0])).toEqual([
      'home',
      'junction',
      'workshop',
    ]);
  });

  it('共享同一地点的居民拥有稳定且互不重叠的目的地站位槽', () => {
    const mechanic = getResidentDestinationSlotOffset('mechanic', 'leisure');
    const harborhand = getResidentDestinationSlotOffset('harborhand', 'leisure');
    expect(Math.hypot(mechanic[0] - harborhand[0], mechanic[1] - harborhand[1])).toBeGreaterThan(
      0.9,
    );

    const squareResidents = ['traveler', 'baker', 'photographer', 'retiree', 'barista'].map((id) =>
      getResidentDestinationSlotOffset(
        id as Parameters<typeof getResidentDestinationSlotOffset>[0],
        'leisure',
      ),
    );
    for (let left = 0; left < squareResidents.length; left += 1) {
      for (let right = left + 1; right < squareResidents.length; right += 1) {
        const a = squareResidents[left] ?? [0, 0];
        const b = squareResidents[right] ?? [0, 0];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(0.82);
      }
    }
  });

  it('单人目的地也使用路侧驻足槽，不站在人行导航节点正中央', () => {
    const courier = getResidentDestinationSlotOffset('courier', 'leisure');

    expect(Math.hypot(...courier)).toBeGreaterThan(0.9);
  });
});
