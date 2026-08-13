import type { DisplayGeometry, Rectangle } from '../core/geometry';
import type { RecordingContainer } from '../core/mime';
import type {
  RecordingCapabilities,
  RecordingConfiguration,
  RecordingOptions,
} from '../core/recording-options';
import type { ScreenCapturePermissionStatus } from '../core/screen-capture-permission';
import type { ScreenshotMode, ScreenshotState } from '../core/screenshot-state';
import type { RecordingMode } from '../core/session';
import type { ShortcutSettings } from '../core/shortcuts';
import type { RecordingState } from '../core/state-machine';
import type { WindowTarget } from '../core/window-target';

export const IPC_CHANNELS = {
  snapshot: 'screen-recorder:snapshot',
  getSnapshot: 'screen-recorder:get-snapshot',
  start: 'screen-recorder:start',
  startScreenshot: 'screen-recorder:start-screenshot',
  startColorPicker: 'screen-recorder:start-color-picker',
  switchSelectionPurpose: 'screen-recorder:switch-selection-purpose',
  getScreenshotEditPlan: 'screen-recorder:get-screenshot-edit-plan',
  revealScreenshotEditor: 'screen-recorder:reveal-screenshot-editor',
  updateScreenshotSelection: 'screen-recorder:update-screenshot-selection',
  pinScreenshot: 'screen-recorder:pin-screenshot',
  getPinnedScreenshot: 'screen-recorder:get-pinned-screenshot',
  closePinnedScreenshot: 'screen-recorder:close-pinned-screenshot',
  saveScreenshot: 'screen-recorder:save-screenshot',
  saveScreenshotAs: 'screen-recorder:save-screenshot-as',
  startLongScreenshot: 'screen-recorder:start-long-screenshot',
  finishLongScreenshot: 'screen-recorder:finish-long-screenshot',
  cancelLongScreenshot: 'screen-recorder:cancel-long-screenshot',
  cancelScreenshotEdit: 'screen-recorder:cancel-screenshot-edit',
  updateConfiguredSelection: 'screen-recorder:update-configured-selection',
  startConfiguredRecording: 'screen-recorder:start-configured-recording',
  cancelConfiguredRecording: 'screen-recorder:cancel-configured-recording',
  hideSettings: 'screen-recorder:hide-settings',
  updateShortcuts: 'screen-recorder:update-shortcuts',
  setShortcutCaptureActive: 'screen-recorder:set-shortcut-capture-active',
  requestScreenCapturePermission: 'screen-recorder:request-screen-capture-permission',
  openScreenCaptureSettings: 'screen-recorder:open-screen-capture-settings',
  restartForScreenCapturePermission: 'screen-recorder:restart-for-screen-capture-permission',
  chooseRecordingDirectory: 'screen-recorder:choose-recording-directory',
  setAutoLaunch: 'screen-recorder:set-auto-launch',
  setNotificationsEnabled: 'screen-recorder:set-notifications-enabled',
  getWindowTargets: 'screen-recorder:get-window-targets',
  setSelectionGestureActive: 'screen-recorder:set-selection-gesture-active',
  selectionReady: 'screen-recorder:selection-ready',
  getColorPickerFrame: 'screen-recorder:get-color-picker-frame',
  completeColorPicker: 'screen-recorder:complete-color-picker',
  copyColor: 'screen-recorder:copy-color',
  confirmSelection: 'screen-recorder:confirm-selection',
  cancelSelection: 'screen-recorder:cancel-selection',
  prepareCapture: 'screen-recorder:prepare-capture',
  startWriting: 'screen-recorder:start-writing',
  appendChunk: 'screen-recorder:append-chunk',
  finish: 'screen-recorder:finish',
  abort: 'screen-recorder:abort',
  stop: 'screen-recorder:stop',
  openOutputFolder: 'screen-recorder:open-output-folder',
  openOutputFile: 'screen-recorder:open-output-file',
  closeCompletion: 'screen-recorder:close-completion',
} as const;

export type CapturePlan = {
  operationId: string;
  mode: RecordingMode;
  container: RecordingContainer;
  options: RecordingOptions;
  display: DisplayGeometry;
  selection?: Rectangle;
  countdownEndsAt: number;
};

export type ScreenshotEditPlan = {
  operationId: string;
  imageDataUrl: string;
  selection: Rectangle;
  pixelSize: { width: number; height: number };
};

export type ColorPickerFrame = {
  imageDataUrl: string;
  pixelSize: { width: number; height: number };
  displaySize: { width: number; height: number };
};

export type RecorderSnapshot = {
  state: RecordingState;
  settingsVisible: boolean;
  platform: 'win32' | 'darwin' | 'other';
  recordingCapabilities: RecordingCapabilities;
  saveDirectory: string;
  autoLaunch: boolean;
  notificationsEnabled: boolean;
  shortcutCaptureActive: boolean;
  screenCapturePermission: ScreenCapturePermissionStatus;
  outputPath?: string;
  startedAt?: number;
  error?: string;
  warning?: string;
  shortcut: string;
  shortcuts: ShortcutSettings;
  screenshot: {
    state: ScreenshotState;
    saveDirectory: string;
    outputPath?: string;
    copiedToClipboard: boolean;
    longCapture?: {
      frames: number;
      pixelHeight: number;
      previewSlices: Array<{ dataUrl: string; pixelHeight: number }>;
      latestDirection: 'up' | 'down';
      startedAt: number;
      notice?: string;
      selectionFrame: Rectangle;
    };
  };
  completion?: {
    kind: 'recording' | 'screenshot';
    previewDataUrl?: string;
  };
  selectionPurpose?: 'recording' | 'screenshot' | 'color-picker';
  selectionDisplay?: DisplayGeometry;
  plan?: CapturePlan;
};

export type RecorderApi = {
  getSnapshot(): Promise<RecorderSnapshot>;
  start(mode: RecordingMode): Promise<void>;
  startScreenshot(mode: ScreenshotMode): Promise<void>;
  startColorPicker(): Promise<void>;
  switchSelectionPurpose(purpose: 'recording' | 'screenshot'): Promise<void>;
  getScreenshotEditPlan(): Promise<ScreenshotEditPlan>;
  revealScreenshotEditor(operationId: string): Promise<void>;
  updateScreenshotSelection(operationId: string, rect: Rectangle): Promise<ScreenshotEditPlan>;
  pinScreenshot(operationId: string, png: ArrayBuffer): Promise<void>;
  getPinnedScreenshot(): Promise<{ dataUrl: string }>;
  closePinnedScreenshot(): Promise<void>;
  saveScreenshot(operationId: string, png: ArrayBuffer): Promise<void>;
  saveScreenshotAs(operationId: string, png: ArrayBuffer): Promise<{ saved: boolean }>;
  startLongScreenshot(operationId: string, firstFrame: ArrayBuffer): Promise<void>;
  finishLongScreenshot(): Promise<void>;
  cancelLongScreenshot(): Promise<void>;
  cancelScreenshotEdit(operationId: string): Promise<void>;
  updateConfiguredSelection(rect: Rectangle): Promise<void>;
  startConfiguredRecording(configuration: RecordingConfiguration): Promise<void>;
  cancelConfiguredRecording(): Promise<void>;
  hideSettings(): Promise<void>;
  updateShortcuts(settings: ShortcutSettings): Promise<void>;
  setShortcutCaptureActive(active: boolean): Promise<void>;
  requestScreenCapturePermission(): Promise<ScreenCapturePermissionStatus>;
  openScreenCaptureSettings(): Promise<void>;
  restartForScreenCapturePermission(): void;
  chooseRecordingDirectory(): Promise<{ changed: boolean }>;
  setAutoLaunch(enabled: boolean): Promise<void>;
  setNotificationsEnabled(enabled: boolean): Promise<void>;
  getWindowTargets(): Promise<WindowTarget[]>;
  setSelectionGestureActive(active: boolean): void;
  selectionReady(): void;
  getColorPickerFrame(): Promise<ColorPickerFrame>;
  completeColorPicker(value: string): Promise<void>;
  copyColor(value: string): Promise<void>;
  confirmSelection(rect: Rectangle): Promise<void>;
  cancelSelection(): Promise<void>;
  prepareCapture(operationId: string): Promise<CapturePlan>;
  startWriting(mimeType: string): Promise<{ sessionId: string }>;
  appendChunk(sessionId: string, chunk: ArrayBuffer): Promise<void>;
  finish(sessionId: string): Promise<void>;
  abort(sessionId: string | undefined, message: string): Promise<void>;
  stop(): Promise<void>;
  openOutputFolder(kind: 'recording' | 'screenshot'): Promise<void>;
  openOutputFile(kind: 'recording' | 'screenshot'): Promise<void>;
  closeCompletion(): Promise<void>;
  onSnapshot(listener: (snapshot: RecorderSnapshot) => void): () => void;
};
