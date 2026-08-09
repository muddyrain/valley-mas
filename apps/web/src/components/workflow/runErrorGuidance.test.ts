import { describe, expect, it } from 'vitest';
import { workflowRunErrorGuidance } from './runErrorGuidance';

describe('workflowRunErrorGuidance', () => {
  it('does not ask users to restore removed ARK model environment variables', () => {
    expect(workflowRunErrorGuidance('ARK_NOT_CONFIGURED')).toBe(
      '该节点正在迁移到新的模型服务，请稍后再试。',
    );
    expect(workflowRunErrorGuidance('ARK_IMAGE_NOT_CONFIGURED')).toBe(
      '该节点正在迁移到新的模型服务，请稍后再试。',
    );
  });
});
