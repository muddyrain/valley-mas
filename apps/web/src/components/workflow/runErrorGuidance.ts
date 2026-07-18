export function workflowRunErrorGuidance(code?: string) {
  switch (code) {
    case 'AI_CONFIGURATION_UNAVAILABLE':
    case 'ARK_NOT_CONFIGURED':
      return '检查 ARK_API_KEY 与 ARK_TEXT_MODEL 是否已配置。';
    case 'ARK_IMAGE_NOT_CONFIGURED':
      return '检查 ARK_API_KEY 与 ARK_IMAGE_MODEL 是否已配置。';
    case 'AI_UPSTREAM_TIMEOUT':
    case 'WORKFLOW_NODE_TIMEOUT':
      return '服务响应超时，可稍后重试并适当缩短输入。';
    case 'AI_UPSTREAM_FAILED':
      return '模型上游暂不可用，请稍后重试。';
    case 'AI_RESPONSE_INVALID':
      return '模型返回内容不符合要求，请调整提示词后重试。';
    case 'WORKFLOW_VARIABLE_RESOLUTION_FAILED':
      return '检查变量是否来自上游节点，以及字段类型是否匹配。';
    case 'WORKFLOW_CANCELLED':
      return '本次运行已停止，不会继续执行后续节点。';
    default:
      return '检查节点配置与输入后重试。';
  }
}
