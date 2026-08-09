import { describe, expect, it } from 'vitest';
import {
  normalizeStartInputs,
  renameStartInput,
  workflowStartInputControlType,
  workflowStartInputProviderForControl,
} from './types';

describe('workflow start input contracts', () => {
  it('maps specialized controls to their stable type and provider', () => {
    expect(workflowStartInputControlType('markdown_file')).toBe('file');
    expect(workflowStartInputControlType('blog_tags')).toBe('string[]');
    expect(workflowStartInputControlType('default', 'number')).toBe('number');
    expect(workflowStartInputProviderForControl('blog_group')).toBe('blog.groups');
    expect(workflowStartInputProviderForControl('default')).toBeUndefined();
  });

  it('normalizes legacy names, rejects invalid entries, and keeps valid IDs', () => {
    expect(
      normalizeStartInputs({
        markdownFile: { id: ' input-file ', type: 'string', required: true },
        tagIds: { type: 'array', required: false },
        explicit: {
          type: 'number',
          required: true,
          control: 'default',
          provider: 'blog.groups',
        },
        badType: { type: 'date', required: true },
        '': { type: 'string', required: true },
        missing: null,
      }),
    ).toEqual({
      markdownFile: {
        id: ' input-file ',
        type: 'file',
        required: true,
        control: 'markdown_file',
      },
      tagIds: {
        type: 'string[]',
        required: false,
        control: 'blog_tags',
        provider: 'blog.tags',
      },
      explicit: {
        type: 'number',
        required: true,
        control: 'default',
        provider: 'blog.groups',
      },
    });
    expect(normalizeStartInputs(null)).toEqual({});
  });

  it('renames a field without mutating its definition', () => {
    const definition = { type: 'string' as const, required: true, control: 'default' as const };
    const renamed = renameStartInput(
      { topic: definition, untouched: definition },
      'topic',
      'brief',
    );

    expect(renamed).toEqual({ brief: definition, untouched: definition });
    expect(renamed.brief).toBe(definition);
  });
});
