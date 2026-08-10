import { contextBridge, ipcRenderer } from 'electron';
import type { Rectangle } from '../src/core/geometry';
import type { RecordingConfiguration } from '../src/core/recording-options';
import type { ScreenshotMode } from '../src/core/screenshot-state';
import type { RecordingMode } from '../src/core/session';
import type { ShortcutSettings } from '../src/core/shortcuts';
import { IPC_CHANNELS, type RecorderApi, type RecorderSnapshot } from '../src/shared/contracts';

const api: RecorderApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getSnapshot),
  start: (mode: RecordingMode) => ipcRenderer.invoke(IPC_CHANNELS.start, mode),
  startScreenshot: (mode: ScreenshotMode) => ipcRenderer.invoke(IPC_CHANNELS.startScreenshot, mode),
  startColorPicker: () => ipcRenderer.invoke(IPC_CHANNELS.startColorPicker),
  switchSelectionPurpose: (purpose: 'recording' | 'screenshot') =>
    ipcRenderer.invoke(IPC_CHANNELS.switchSelectionPurpose, purpose),
  getScreenshotEditPlan: () => ipcRenderer.invoke(IPC_CHANNELS.getScreenshotEditPlan),
  revealScreenshotEditor: (operationId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.revealScreenshotEditor, operationId),
  updateScreenshotSelection: (operationId: string, rect: Rectangle) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateScreenshotSelection, operationId, rect),
  pinScreenshot: (operationId: string, png: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.pinScreenshot, operationId, png),
  getPinnedScreenshot: () => ipcRenderer.invoke(IPC_CHANNELS.getPinnedScreenshot),
  closePinnedScreenshot: () => ipcRenderer.invoke(IPC_CHANNELS.closePinnedScreenshot),
  saveScreenshot: (operationId: string, png: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveScreenshot, operationId, png),
  saveScreenshotAs: (operationId: string, png: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveScreenshotAs, operationId, png),
  startLongScreenshot: (operationId: string, firstFrame: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.startLongScreenshot, operationId, firstFrame),
  finishLongScreenshot: () => ipcRenderer.invoke(IPC_CHANNELS.finishLongScreenshot),
  cancelLongScreenshot: () => ipcRenderer.invoke(IPC_CHANNELS.cancelLongScreenshot),
  cancelScreenshotEdit: (operationId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelScreenshotEdit, operationId),
  updateConfiguredSelection: (rect: Rectangle) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateConfiguredSelection, rect),
  startConfiguredRecording: (configuration: RecordingConfiguration) =>
    ipcRenderer.invoke(IPC_CHANNELS.startConfiguredRecording, configuration),
  cancelConfiguredRecording: () => ipcRenderer.invoke(IPC_CHANNELS.cancelConfiguredRecording),
  hideSettings: () => ipcRenderer.invoke(IPC_CHANNELS.hideSettings),
  updateShortcuts: (settings: ShortcutSettings) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateShortcuts, settings),
  setShortcutCaptureActive: (active: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.setShortcutCaptureActive, active),
  chooseRecordingDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.chooseRecordingDirectory),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.setAutoLaunch, enabled),
  setNotificationsEnabled: (enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.setNotificationsEnabled, enabled),
  getWindowTargets: () => ipcRenderer.invoke(IPC_CHANNELS.getWindowTargets),
  selectionReady: () => ipcRenderer.send(IPC_CHANNELS.selectionReady),
  getColorPickerFrame: () => ipcRenderer.invoke(IPC_CHANNELS.getColorPickerFrame),
  completeColorPicker: (value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.completeColorPicker, value),
  copyColor: (value: string) => ipcRenderer.invoke(IPC_CHANNELS.copyColor, value),
  confirmSelection: (rect: Rectangle) => ipcRenderer.invoke(IPC_CHANNELS.confirmSelection, rect),
  cancelSelection: () => ipcRenderer.invoke(IPC_CHANNELS.cancelSelection),
  prepareCapture: (operationId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.prepareCapture, operationId),
  startWriting: (mimeType: string) => ipcRenderer.invoke(IPC_CHANNELS.startWriting, mimeType),
  appendChunk: (sessionId: string, chunk: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.appendChunk, sessionId, chunk),
  finish: (sessionId: string) => ipcRenderer.invoke(IPC_CHANNELS.finish, sessionId),
  abort: (sessionId: string | undefined, message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.abort, sessionId, message),
  stop: () => ipcRenderer.invoke(IPC_CHANNELS.stop),
  openOutputFolder: (kind: 'recording' | 'screenshot') =>
    ipcRenderer.invoke(IPC_CHANNELS.openOutputFolder, kind),
  openOutputFile: (kind: 'recording' | 'screenshot') =>
    ipcRenderer.invoke(IPC_CHANNELS.openOutputFile, kind),
  closeCompletion: () => ipcRenderer.invoke(IPC_CHANNELS.closeCompletion),
  onSnapshot: (listener: (snapshot: RecorderSnapshot) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: RecorderSnapshot) =>
      listener(snapshot);
    ipcRenderer.on(IPC_CHANNELS.snapshot, wrapped);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.snapshot, wrapped);
  },
};

contextBridge.exposeInMainWorld('screenRecorder', api);
