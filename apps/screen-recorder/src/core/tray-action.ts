export function createTrayPrimaryAction(
  startRegionScreenshot: () => Promise<void>,
  reportError: (error: unknown) => void,
): () => void {
  return () => {
    void startRegionScreenshot().catch(reportError);
  };
}
