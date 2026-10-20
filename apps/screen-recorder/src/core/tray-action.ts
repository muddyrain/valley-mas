export function createTrayPrimaryAction(
  startRegionScreenshot: () => Promise<void>,
  reportError: (error: unknown) => void,
  busy?: { isBusy(): boolean; showMenu(): void },
): () => void {
  return () => {
    if (busy?.isBusy()) {
      busy.showMenu();
      return;
    }
    void startRegionScreenshot().catch(reportError);
  };
}
