import { describe, expect, it } from 'vitest';
import {
  compareSubworkflowContracts,
  normalizeSubworkflowSchema,
  publishedWorkflowContract,
} from './subworkflowContract';

describe('subworkflow contracts', () => {
  it('normalizes supported field types only', () => {
    expect(
      normalizeSubworkflowSchema({
        title: 'string',
        attachment: 'file',
        list: 'array',
        bad: 'date',
      }),
    ).toEqual({ title: 'string', attachment: 'file' });
    expect(normalizeSubworkflowSchema('invalid')).toEqual({});
  });

  it('extracts published start inputs and typed end outputs from Graph v4 JSON', () => {
    const graph = JSON.stringify({
      nodes: [
        {
          type: 'start',
          config: {
            inputs: {
              topic: { type: 'string', required: true },
              optional: { type: 'number', required: false },
              ignored: { type: 'array', required: true },
            },
          },
        },
        {
          type: 'end',
          config: {
            outputs: { title: '{{writer.output.text}}', ignored: 'x' },
            outputTypes: { title: 'string', ignored: 'array' },
          },
        },
      ],
    });

    expect(publishedWorkflowContract(graph)).toEqual({
      inputSchema: { topic: 'string', optional: 'number' },
      outputSchema: { title: 'string' },
      requiredInputs: ['topic'],
    });
    expect(publishedWorkflowContract('{bad json')).toEqual({
      inputSchema: {},
      outputSchema: {},
      requiredInputs: [],
    });
  });

  it('detects removed fields, changed types, and newly required inputs', () => {
    expect(
      compareSubworkflowContracts(
        {
          inputSchema: { topic: 'string', count: 'number' },
          outputSchema: { title: 'string', score: 'number' },
          requiredInputs: ['topic'],
        },
        {
          inputSchema: { topic: 'number', added: 'boolean' },
          outputSchema: { title: 'number' },
          requiredInputs: ['topic', 'added'],
        },
      ),
    ).toEqual([
      { scope: 'input', name: 'topic', reason: 'type_changed' },
      { scope: 'input', name: 'count', reason: 'removed' },
      { scope: 'input', name: 'added', reason: 'required_added' },
      { scope: 'output', name: 'title', reason: 'type_changed' },
      { scope: 'output', name: 'score', reason: 'removed' },
    ]);
  });
});
