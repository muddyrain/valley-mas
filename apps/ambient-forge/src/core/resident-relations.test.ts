import { describe, expect, it } from 'vitest';
import {
  createResidentRelations,
  getResidentRelation,
  recordResidentCollaboration,
} from './resident-relations';

describe('resident relations', () => {
  it('以无方向的居民组合累计共同事件熟悉度', () => {
    const initial = createResidentRelations();
    const collaborated = recordResidentCollaboration(initial, {
      residentId: 'traveler',
      partnerId: 'gardener',
      collaborationId: 'greenhouse-water:handoff',
    });
    const repeated = recordResidentCollaboration(collaborated, {
      residentId: 'gardener',
      partnerId: 'traveler',
      collaborationId: 'greenhouse-water:handoff',
    });
    const second = recordResidentCollaboration(repeated, {
      residentId: 'traveler',
      partnerId: 'gardener',
      collaborationId: 'greenhouse-water:finish',
    });

    expect(initial.relations).toEqual({});
    expect(getResidentRelation(collaborated, 'gardener', 'traveler')).toMatchObject({
      familiarity: 1,
      collaborations: 1,
      label: '面熟',
    });
    expect(repeated).toBe(collaborated);
    expect(getResidentRelation(second, 'traveler', 'gardener')).toMatchObject({
      familiarity: 2,
      collaborations: 2,
      label: '熟人',
    });
  });

  it('不会为同一居民或无效组合创建关系', () => {
    const initial = createResidentRelations();
    const next = recordResidentCollaboration(initial, {
      residentId: 'traveler',
      partnerId: 'traveler',
      collaborationId: 'self',
    });

    expect(next).toBe(initial);
    expect(getResidentRelation(next, 'traveler', 'traveler')).toBeNull();
  });
});
