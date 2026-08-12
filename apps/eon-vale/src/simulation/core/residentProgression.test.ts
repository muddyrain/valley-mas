import { describe, expect, it } from 'vitest';
import { Profession, ResidentRole } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('resident progression', () => {
  it('turns repeated work into experience, levels and contribution', () => {
    const simulation = createWorldSimulation({ seed: 'growth', initialHumans: 24 });
    const residentId = 0;
    simulation.state.entities.professions[residentId] = Profession.Builder;

    for (let tick = 0; tick < 1_500; tick += 1) simulation.step();

    expect(simulation.state.entities.experience[residentId]).toBeGreaterThan(0);
    expect(simulation.state.entities.levels[residentId]).toBeGreaterThanOrEqual(1);
    expect(simulation.state.entities.contribution[residentId]).toBeGreaterThan(0);
  });

  it('assigns visible leadership roles without marking every resident as a hero', () => {
    const simulation = createWorldSimulation({ seed: 'leaders', initialHumans: 72 });
    for (let tick = 0; tick < 1_200; tick += 1) simulation.step();

    const roles = Array.from(
      simulation.state.entities.roles.slice(0, simulation.state.entities.count),
    );
    expect(roles.some((role) => role >= ResidentRole.Leader)).toBe(true);
    expect(roles.filter((role) => role !== ResidentRole.Citizen).length).toBeLessThan(
      simulation.state.entities.count / 2,
    );
  });
});
