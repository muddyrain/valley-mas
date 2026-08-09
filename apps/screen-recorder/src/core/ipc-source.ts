export function isAllowedIpcSender(
  senderId: number,
  allowedWindowIds: Array<number | undefined>,
): boolean {
  return allowedWindowIds.some((windowId) => windowId !== undefined && windowId === senderId);
}
