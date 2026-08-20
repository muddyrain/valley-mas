import type { LifePopulationFacts } from './lifeFacts';

export function selectLifeIntents(population: LifePopulationFacts, tick: number): void {
  for (const human of population.life) {
    if (!human.active || !human.decisionRequested) continue;
    if (human.nutritionStage !== 'healthy') {
      human.intent = { kind: 'find-food', reason: 'nutrition-critical', selectedTick: tick };
    } else if (human.energyStage !== 'rested') {
      human.intent = { kind: 'rest', reason: 'energy-critical', selectedTick: tick };
    } else if (human.settlementId === null) {
      human.intent = {
        kind: 'establish-settlement',
        reason: 'unsettled-adult',
        selectedTick: tick,
      };
    } else {
      human.intent = { kind: 'idle', reason: 'no-urgent-need', selectedTick: tick };
    }
    human.decisionRequested = false;
  }
}
