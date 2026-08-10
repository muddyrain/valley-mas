import type { Rectangle } from './geometry';

const MIN_AUTOMATIC_LABEL_WIDTH = 160;
const MIN_AUTOMATIC_LABEL_HEIGHT = 48;

export function shouldShowSelectionLabel(
  selection: Rectangle,
  isAutomaticTarget: boolean,
): boolean {
  if (!isAutomaticTarget) return true;
  return (
    selection.width >= MIN_AUTOMATIC_LABEL_WIDTH && selection.height >= MIN_AUTOMATIC_LABEL_HEIGHT
  );
}
