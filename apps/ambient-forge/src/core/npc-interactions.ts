import type { WeatherMode } from './ambient-inputs';
import type { NpcId, NpcReaction } from './npc';
import type { ResidentRelationLabel } from './resident-relations';
import type { NpcRoutine } from './town-life';

export interface RelationshipSummary {
  familiarity: number;
  label: ResidentRelationLabel;
}

export interface NpcConversationContext {
  npcId: NpcId;
  npcName: string;
  role: string;
  task: string;
  routine: NpcRoutine;
  weather: WeatherMode;
  timeOfDay: number;
  relation: RelationshipSummary | null;
}

export interface NpcConversation {
  npcId: NpcId;
  npcName: string;
  role: string;
  relationLabel: ResidentRelationLabel | '初次见面';
  line: string;
  gesture: Extract<NpcReaction, 'nod' | 'wave' | 'approach' | 'follow'>;
  duration: number;
}

export interface NpcInteractionHudState {
  current: NpcConversation | null;
}

export const EMPTY_NPC_INTERACTION_HUD_STATE: Readonly<NpcInteractionHudState> = Object.freeze({
  current: null,
});

export function getRelationshipReaction(
  relation: Readonly<RelationshipSummary> | null,
): NpcConversation['gesture'] {
  const familiarity = relation?.familiarity ?? 0;
  if (familiarity >= 4) return 'follow';
  if (familiarity >= 2) return 'approach';
  if (familiarity >= 1) return 'wave';
  return 'nod';
}

export function createNpcConversation(context: Readonly<NpcConversationContext>): NpcConversation {
  const normalizedTime = ((context.timeOfDay % 24) + 24) % 24;
  let line: string;
  if (normalizedTime >= 21 || normalizedTime < 5) {
    line = `夜里风凉，走到亮着灯的路上会更安心。`;
  } else if (context.weather === 'rain') {
    line = `雨把石板路打湿了，转弯时慢一点。`;
  } else if (context.weather === 'snow') {
    line = `雪正在积起来，屋檐和路缘都容易打滑。`;
  } else if (context.weather === 'fog') {
    line = `雾里看不远，沿着路灯走就不会迷路。`;
  } else if (context.routine === 'work') {
    line = `我正忙着${context.task}，忙完再去广场转一圈。`;
  } else if (context.routine === 'rest') {
    line = `今天的事差不多了，我正准备回去休息。`;
  } else {
    line = `镇上今天很平静，我刚刚在${context.task}。`;
  }
  return {
    npcId: context.npcId,
    npcName: context.npcName,
    role: context.role,
    relationLabel: context.relation?.label ?? '初次见面',
    line,
    gesture: getRelationshipReaction(context.relation),
    duration: context.relation?.familiarity && context.relation.familiarity >= 4 ? 6 : 4.6,
  };
}
