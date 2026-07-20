export function getWorkflowRunBranchHandle(
  nodeType: string | undefined,
  output: Record<string, unknown> | undefined,
) {
  if (!output) return null;
  if (nodeType === 'switch') {
    const matchedCaseID = String(output.matchedCaseId || 'default');
    return matchedCaseID === 'default' ? 'default' : `case:${matchedCaseID}`;
  }
  if (nodeType === 'condition') {
    return output.matched === true ? 'true' : 'false';
  }
  if (nodeType === 'intent') {
    return `intent:${String(output.intentId || 'other')}`;
  }
  return null;
}
