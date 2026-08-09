import { describe, expect, it } from 'vitest';
import {
  formatTypedVariableValue,
  normalizeTypedVariableValue,
  parseTypedVariableValue,
  toWorkflowValueType,
} from './TypedVariableValueEditor';

describe('typed workflow values', () => {
  it('normalizes declared workflow types and falls back to string', () => {
    expect(toWorkflowValueType('file')).toBe('file');
    expect(toWorkflowValueType('array')).toBe('array');
    expect(toWorkflowValueType('date')).toBe('string');
    expect(toWorkflowValueType(undefined)).toBe('string');
  });

  it('formats structured values for the fixed-value editor', () => {
    expect(formatTypedVariableValue(['a', 'b'], 'string[]')).toBe('["a","b"]');
    expect(formatTypedVariableValue({ enabled: true }, 'object')).toBe('{"enabled":true}');
    expect(formatTypedVariableValue(null, 'string')).toBe('');
  });

  it.each([
    ['["a","b"]', 'string[]', ['a', 'b']],
    ['', 'string[]', []],
    ['[1,2]', 'array', [1, 2]],
    ['', 'array', []],
    ['{"count":2}', 'object', { count: 2 }],
    ['2.5', 'number', 2.5],
    ['true', 'boolean', true],
    ['false', 'boolean', false],
  ] as const)('parses %s as %s', (raw, type, expected) => {
    expect(parseTypedVariableValue(raw, type)).toEqual(expected);
  });

  it('preserves invalid fixed values so the user can continue editing', () => {
    expect(parseTypedVariableValue('[1]', 'string[]')).toBe('[1]');
    expect(parseTypedVariableValue('{bad', 'object')).toBe('{bad');
    expect(parseTypedVariableValue('NaN', 'number')).toBe('NaN');
    expect(parseTypedVariableValue('yes', 'boolean')).toBe('yes');
    expect(normalizeTypedVariableValue(12, 'number')).toBe(12);
  });
});
