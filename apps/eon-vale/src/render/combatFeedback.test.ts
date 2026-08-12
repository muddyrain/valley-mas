import { describe, expect, it } from 'vitest';
import { AgentState, EntityKind, Profession } from '@/shared/gameTypes';
import {
  attackThrustFrame,
  combatHealthBar,
  shouldEmitDeathPuff,
  shouldFlashFromDamage,
} from './combatFeedback';

describe('combat feedback', () => {
  it('animates attacks as a deterministic two-frame thrust', () => {
    expect(attackThrustFrame(AgentState.Attack, 0, 0)).toBe(0);
    expect(attackThrustFrame(AgentState.Attack, 4, 0)).toBe(1);
    expect(attackThrustFrame(AgentState.Wander, 4, 0)).toBe(0);
  });

  it('shows a thin health bar only for guards participating in combat', () => {
    expect(combatHealthBar(Profession.Guard, AgentState.Attack, 750)).toEqual({
      visible: true,
      ratio: 0.75,
    });
    expect(combatHealthBar(Profession.Forager, AgentState.Attack, 750).visible).toBe(false);
    expect(combatHealthBar(Profession.Guard, AgentState.Wander, 1_000).visible).toBe(false);
  });

  it('emits hit flash and death puff only on actual state transitions', () => {
    expect(shouldFlashFromDamage(1_000, 900)).toBe(true);
    expect(shouldFlashFromDamage(900, 900)).toBe(false);
    expect(shouldEmitDeathPuff(1, 0, EntityKind.Human)).toBe(true);
    expect(shouldEmitDeathPuff(0, 0, EntityKind.Human)).toBe(false);
  });
});
