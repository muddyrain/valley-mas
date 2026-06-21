const MAX_TITLE_LENGTH = 28;

export function deriveAICommandTitle(input: string) {
  const firstLine = input
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return '新对话';
  return firstLine.length > MAX_TITLE_LENGTH
    ? `${firstLine.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : firstLine;
}
