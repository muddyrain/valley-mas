type RestartableApplication = {
  relaunch(): void;
  exit(exitCode?: number): void;
};

export function restartApplication(
  application: RestartableApplication,
  markQuitting: () => void,
): void {
  markQuitting();
  application.relaunch();
  application.exit(0);
}
