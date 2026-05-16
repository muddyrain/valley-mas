import { describe, expect, it } from 'vitest';
import { getTimeScaleSpeedFromKeyboardEvent, TimeScaleSystem } from './TimeScaleSystem';

describe('TimeScaleSystem', () => {
  it('cycles through 1x, 2x, 4x and pause', () => {
    const system = new TimeScaleSystem();

    expect(system.speed).toBe(1);
    expect(system.getLabel()).toBe('1x');
    expect(system.scaleDelta(100)).toBe(100);

    system.setSpeed(2);
    expect(system.getLabel()).toBe('2x');
    expect(system.scaleDelta(100)).toBe(200);

    system.setSpeed(4);
    expect(system.getLabel()).toBe('4x');
    expect(system.scaleDelta(100)).toBe(400);

    system.setSpeed(0);
    expect(system.getLabel()).toBe('暂停');
    expect(system.scaleDelta(100)).toBe(0);
  });

  it('ignores unsupported speeds', () => {
    const system = new TimeScaleSystem();

    system.setSpeed(3);

    expect(system.speed).toBe(1);
  });

  it('recognizes digit and numpad speed keys from browser keyboard events', () => {
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: '1', code: 'Digit1' })).toBe(1);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: '&', code: 'Digit1' })).toBe(1);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: 'Numpad2', code: 'Numpad2' })).toBe(2);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: '4', code: 'Digit4' })).toBe(4);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: 'p', code: 'KeyP' })).toBe(0);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: '0', code: 'Digit0' })).toBe(0);
    expect(getTimeScaleSpeedFromKeyboardEvent({ key: 'x', code: 'KeyX' })).toBeUndefined();
  });
});
