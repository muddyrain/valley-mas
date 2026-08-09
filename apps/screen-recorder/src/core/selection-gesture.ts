export function canStartSelectionGesture(button: number, isPrimary: boolean): boolean {
  return button === 0 && isPrimary;
}
