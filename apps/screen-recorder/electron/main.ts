import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  type Display,
  desktopCapturer,
  dialog,
  globalShortcut,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  type NativeImage,
  Notification,
  nativeImage,
  screen,
  session,
  shell,
  systemPreferences,
  Tray,
} from 'electron';
import { getLoginItemTarget, parsePersistedAppSettings } from '../src/core/app-settings';
import { isSupportedColorText } from '../src/core/color';
import { createScreenshotFilename, ensurePngExtension } from '../src/core/filename';
import {
  clampRectToBounds,
  dipRectToVideoPixels,
  findDisplayForPoint,
  matchDisplaySource,
  normalizeSelection,
  type Rectangle,
  validateSelection,
} from '../src/core/geometry';
import { shouldHandleGlobalShortcut } from '../src/core/global-shortcut';
import { isAllowedIpcSender } from '../src/core/ipc-source';
import {
  type BitmapFrame,
  composeLongScreenshot,
  detectVerticalShift,
  extractAppendedFrame,
  type LongScreenshotSlice,
} from '../src/core/long-screenshot';
import { getLongScreenshotSelectionFrame } from '../src/core/long-screenshot-view';
import { RECORDING_MIME_CANDIDATES, type RecordingContainer } from '../src/core/mime';
import { getDisplayOverlayWindowOptions } from '../src/core/overlay-window';
import { getPinnedScreenshotWindowBounds } from '../src/core/pinned-screenshot';
import { isValidPng } from '../src/core/png';
import { PreparedWindowSlot } from '../src/core/prepared-window';
import {
  getDefaultRecordingOptions,
  getRecordingCapabilities,
  parseRecordingConfiguration,
  type RecordingConfiguration,
} from '../src/core/recording-options';
import {
  createSingleFlightScreenCapturePermissionRequest,
  requestScreenCapturePermissionStatus,
  resolveScreenCapturePermissionStatus,
  runAfterScreenCapturePermission,
  type ScreenCapturePermissionStatus,
} from '../src/core/screen-capture-permission';
import { canRevealScreenshotEditor } from '../src/core/screenshot-handoff';
import { type ScreenshotMode, ScreenshotSession } from '../src/core/screenshot-state';
import { findSelectionDisplayChange } from '../src/core/selection-display';
import { RecordingSession } from '../src/core/session';
import {
  DEFAULT_SHORTCUTS,
  type ShortcutSettings,
  validateShortcutSettings,
} from '../src/core/shortcuts';
import { createSecondInstanceActivation } from '../src/core/single-instance';
import { createTrayPrimaryAction } from '../src/core/tray-action';
import { shouldProtectWindowContent } from '../src/core/window-content-protection';
import { scheduleWindowDestroy } from '../src/core/window-lifecycle';
import {
  mapWindowTargetsToDisplay,
  type NativeWindowTarget,
  type WindowTarget,
} from '../src/core/window-target';
import {
  type CapturePlan,
  IPC_CHANNELS,
  type RecorderSnapshot,
  type ScreenshotEditPlan,
} from '../src/shared/contracts';
import { RecordingFileWriter } from './file-writer';
import {
  createExecutableWindowQueryHost,
  createPowerShellWindowQueryHost,
  type QueryHost,
  RefreshingQueryCache,
  ReusableQueryHost,
} from './window-target-query';

const DEV_SERVER_URL = process.env.SCREEN_RECORDER_DEV_SERVER_URL;
const FORCE_PERMISSION_DENIED = process.env.VALLEY_SCREEN_RECORDER_TEST_PERMISSION_DENIED === '1';
const FORCE_SHORTCUT_FAILURE = process.env.VALLEY_SCREEN_RECORDER_TEST_SHORTCUT_FAILURE === '1';
const FORCE_WRITE_FAILURE = process.env.VALLEY_SCREEN_RECORDER_TEST_WRITE_FAILURE === '1';
const SHOW_LONG_SCREENSHOT_FIXTURE =
  process.env.VALLEY_SCREEN_RECORDER_TEST_LONG_SCREENSHOT_FIXTURE === '1';
const TEST_AUTO_STOP_MS = Number(process.env.VALLEY_SCREEN_RECORDER_TEST_AUTO_STOP_MS ?? 0);
// desktopCapturer can briefly occupy the compositor; let the shortcut overlay settle first.
const SCREENSHOT_CAPTURE_PRIME_DELAY_MS = 300;
const SELECTION_DISPLAY_FOLLOW_INTERVAL_MS = 80;
const SCREENSHOT_PERMISSION_DENIED_MESSAGE =
  '屏幕捕获权限不可用。请允许 Valley Screen Recorder 录制屏幕；已授权时请重启应用。';
const RECORDING_PERMISSION_DENIED_MESSAGE =
  '屏幕录制权限不可用。请允许 Valley Screen Recorder 录制屏幕；已授权时请重启应用。';
const MAC_SCREEN_CAPTURE_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

let mainWindow: BrowserWindow | undefined;
let selectionWindow: BrowserWindow | undefined;
let recordingWindow: BrowserWindow | undefined;
let indicatorWindow: BrowserWindow | undefined;
let controlWindow: BrowserWindow | undefined;
let screenshotEditorWindow: BrowserWindow | undefined;
let longScreenshotControlWindow: BrowserWindow | undefined;
let longScreenshotIndicatorWindow: BrowserWindow | undefined;
let recordingSetupWindow: BrowserWindow | undefined;
let completionWindow: BrowserWindow | undefined;
const preparedSelectionWindows = new PreparedWindowSlot<BrowserWindow>();
let preparedSelectionWindowScheduled = false;
let completionKind: 'recording' | 'screenshot' | undefined;
let completionPreviewDataUrl: string | undefined;
let longScreenshotFixtureWindow: BrowserWindow | undefined;
let selectionDisplay: Display | undefined;
let selectionPurpose: 'recording' | 'screenshot' | 'color-picker' | undefined;
let selectionDisplayWatcher: NodeJS.Timeout | undefined;
let selectionGestureActive = false;
let tray: Tray | undefined;
let isQuitting = false;
let nativeScreenCaptureVerified = false;
let captureGranted = false;
let activePlan: CapturePlan | undefined;
let outputPath: string | undefined;
let startedAt: number | undefined;
let errorMessage: string | undefined;
let warningMessage: string | undefined;
let screenshotOutputPath: string | undefined;
let screenshotTask: { display: Display; selection?: Rectangle } | undefined;
let screenshotSourcePromise: Promise<NativeImage> | undefined;
let screenshotDisplayImage: NativeImage | undefined;
let screenshotEditPlan: ScreenshotEditPlan | undefined;
let screenshotCopiedToClipboard = false;
let longScreenshotCapture:
  | {
      operationId: string;
      display: Display;
      selection: Rectangle;
      slices: LongScreenshotSlice[];
      lastFrame: BitmapFrame;
      pixelHeight: number;
      previewSlices: Array<{ dataUrl: string; pixelHeight: number }>;
      startedAt: number;
      timer: NodeJS.Timeout;
      sampling: boolean;
      notice?: string;
    }
  | undefined;
let pendingRecording:
  | { mode: 'screen' | 'region'; display: Display; selection?: Rectangle }
  | undefined;
let shortcutSettings: ShortcutSettings = { ...DEFAULT_SHORTCUTS };
let shortcutCaptureActive = false;
let notificationsEnabled = false;
let windowTargetsPromise: Promise<WindowTarget[]> | undefined;
let trayMenu: Menu | undefined;
const pinnedScreenshots = new Map<number, { dataUrl: string; window: BrowserWindow }>();

let saveDirectory = path.join(app.getPath('videos'), 'Valley Screen Recordings');
const screenshotDirectory = path.join(app.getPath('pictures'), 'Valley Screenshots');
const shortcutSettingsPath = path.join(app.getPath('userData'), 'shortcuts.json');
const appSettingsPath = path.join(app.getPath('userData'), 'settings.json');
const appIconPath = path.join(__dirname, '../assets/logo.png');
const trayTemplateIconPath = path.join(__dirname, '../assets/trayTemplate.png');
const macOSWindowQueryPath = app.isPackaged
  ? path.join(process.resourcesPath, 'native/macos-window-query')
  : path.join(__dirname, 'native/macos-window-query');
const fileWriter = new RecordingFileWriter(saveDirectory, FORCE_WRITE_FAILURE);
const recorderSession = new RecordingSession((mimeType) => fileWriter.begin(mimeType));
const screenshotSession = new ScreenshotSession(captureScreenshotFile);
const WINDOWS_WINDOW_QUERY = `
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ValleyWindows {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr param);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out RECT value, int size);
  public static object[] Read() {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var rows = new List<object>();
    EnumWindows((hwnd, param) => {
      if (!IsWindowVisible(hwnd) || IsIconic(hwnd)) return true;
      var title = new System.Text.StringBuilder(512);
      GetWindowText(hwnd, title, title.Capacity);
      if (title.Length == 0) return true;
      RECT rect;
      if (DwmGetWindowAttribute(hwnd, 9, out rect, Marshal.SizeOf(typeof(RECT))) != 0) return true;
      var width = rect.Right - rect.Left; var height = rect.Bottom - rect.Top;
      if (width < 16 || height < 16) return true;
      uint pid; GetWindowThreadProcessId(hwnd, out pid);
      rows.Add(new { id=hwnd.ToInt64().ToString(), title=title.ToString(), processId=pid, x=rect.Left, y=rect.Top, width, height });
      return true;
    }, IntPtr.Zero);
    return rows.ToArray();
  }
}
'@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while (($command = [Console]::In.ReadLine()) -ne $null) {
  if ($command -ne 'query') { continue }
  try {
    $json = [ValleyWindows]::Read() | ConvertTo-Json -Compress
    if ([String]::IsNullOrWhiteSpace($json)) { $json = '[]' }
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  } catch {
    [Console]::Out.WriteLine('[]')
    [Console]::Out.Flush()
  }
}
`;

function createWindowTargetQueryHost(): QueryHost {
  if (process.platform === 'win32') {
    return createPowerShellWindowQueryHost(WINDOWS_WINDOW_QUERY, 15_000);
  }
  if (process.platform === 'darwin') {
    return createExecutableWindowQueryHost(macOSWindowQueryPath, [], 5_000);
  }
  throw new Error('当前平台不支持窗口识别');
}

const windowTargetQueries = new ReusableQueryHost(createWindowTargetQueryHost);
const windowTargetCache = new RefreshingQueryCache(async () => {
  const stdout = await windowTargetQueries.query();
  const parsed = JSON.parse(stdout.trim() || '[]') as unknown;
  return (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) as NativeWindowTarget[];
}, 1_000);

function toDisplayGeometry(display: Display) {
  return {
    id: String(display.id),
    bounds: { ...display.bounds },
    scaleFactor: display.scaleFactor,
  };
}

async function detectWindowTargets(display: Display): Promise<WindowTarget[]> {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return [];
  try {
    const values = await windowTargetCache.readOr([]);
    return mapWindowTargetsToDisplay(
      values,
      display.bounds,
      (rect) => (process.platform === 'win32' ? screen.screenToDipRect(null, rect) : rect),
      process.pid,
    );
  } catch (error) {
    if (process.env.SCREEN_RECORDER_SMOKE_SOURCE === '1') {
      console.error('[window-targets]', error);
    }
    return [];
  }
}

function getAppIcon(): NativeImage {
  const icon = nativeImage.createFromPath(appIconPath);
  if (icon.isEmpty()) throw new Error('应用图标资源无法读取');
  return icon;
}

function createLongScreenshotFixtureWindow(): void {
  const display = screen.getPrimaryDisplay();
  const fixture = new BrowserWindow({
    x: display.workArea.x + 700,
    y: display.workArea.y + 140,
    width: 520,
    height: 620,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  longScreenshotFixtureWindow = fixture;
  fixture.setAlwaysOnTop(true, 'normal');
  fixture.on('closed', () => {
    if (longScreenshotFixtureWindow === fixture) longScreenshotFixtureWindow = undefined;
  });
  const rows = Array.from(
    { length: 30 },
    (_, index) =>
      `<section style="height:96px;background:hsl(${(index * 31) % 360} 72% 88%)"><b>${String(index + 1).padStart(2, '0')}</b><span>Valley long screenshot fixture row ${index + 1}</span></section>`,
  ).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Valley Long Screenshot Fixture</title><style>*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;color:#172033;font:18px Segoe UI,sans-serif}header{position:sticky;top:0;height:40px;padding:8px 18px;color:white;background:#172033;z-index:2}section{display:flex;align-items:center;gap:18px;padding:0 22px;border-bottom:1px solid rgb(23 32 51 / 18%)}b{font-size:28px;font-variant-numeric:tabular-nums}</style></head><body><header>Valley Long Screenshot Fixture</header>${rows}</body></html>`;
  void fixture.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
    fixture.show();
  });
}

function snapshot(): RecorderSnapshot {
  const platform =
    process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'other';
  return {
    state: recorderSession.state,
    settingsVisible: mainWindow?.isVisible() ?? false,
    platform,
    recordingCapabilities: getRecordingCapabilities(process.platform),
    saveDirectory,
    autoLaunch: getAutoLaunchEnabled(),
    notificationsEnabled,
    shortcutCaptureActive,
    screenCapturePermission: getScreenCapturePermissionStatus(),
    outputPath,
    startedAt,
    error: errorMessage,
    warning: warningMessage,
    shortcut: shortcutSettings.recording,
    shortcuts: { ...shortcutSettings },
    screenshot: {
      state: screenshotSession.state,
      saveDirectory: screenshotDirectory,
      outputPath: screenshotOutputPath,
      copiedToClipboard: screenshotCopiedToClipboard,
      longCapture: longScreenshotCapture
        ? {
            frames: longScreenshotCapture.slices.length,
            pixelHeight: longScreenshotCapture.pixelHeight,
            previewSlices: longScreenshotCapture.previewSlices,
            startedAt: longScreenshotCapture.startedAt,
            notice: longScreenshotCapture.notice,
            selectionFrame: getLongScreenshotSelectionFrame(
              longScreenshotCapture.display.bounds,
              longScreenshotCapture.selection,
            ),
          }
        : undefined,
    },
    completion: completionKind
      ? { kind: completionKind, previewDataUrl: completionPreviewDataUrl }
      : undefined,
    selectionPurpose,
    selectionDisplay: selectionDisplay ? toDisplayGeometry(selectionDisplay) : undefined,
    plan: activePlan,
  };
}

function broadcast(): void {
  const next = snapshot();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    recordingWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (screenshotEditorWindow && !screenshotEditorWindow.isDestroyed()) {
    screenshotEditorWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (longScreenshotControlWindow && !longScreenshotControlWindow.isDestroyed()) {
    longScreenshotControlWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (longScreenshotIndicatorWindow && !longScreenshotIndicatorWindow.isDestroyed()) {
    longScreenshotIndicatorWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (recordingSetupWindow && !recordingSetupWindow.isDestroyed()) {
    recordingSetupWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  if (completionWindow && !completionWindow.isDestroyed()) {
    completionWindow.webContents.send(IPC_CHANNELS.snapshot, next);
  }
  rebuildTrayMenu();
  schedulePreparedSelectionWindow();
}

function showMainWindow(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }
  mainWindow.setContentProtection(shouldProtectWindowContent('settings'));
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  return true;
}

const secondInstanceActivation = createSecondInstanceActivation(showMainWindow);
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', () => secondInstanceActivation.request());
if (hasSingleInstanceLock && process.platform === 'win32') {
  void windowTargetCache.refresh().catch(() => undefined);
}

function concealMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  deactivateShortcutCapture();
  mainWindow.setContentProtection(shouldProtectWindowContent('capture-overlay'));
  mainWindow.hide();
}

function destroyRecordingWindowSoon(): void {
  const window = recordingWindow;
  if (window && !window.isDestroyed()) {
    setImmediate(() => {
      if (recordingWindow === window) {
        recordingWindow = undefined;
      }
      window.destroy();
    });
  }
}

function destroyIndicatorWindowSoon(): void {
  const window = indicatorWindow;
  if (window && !window.isDestroyed()) {
    setImmediate(() => {
      if (indicatorWindow === window) {
        indicatorWindow = undefined;
      }
      window.destroy();
    });
  }
}

function destroyControlWindowSoon(): void {
  const window = controlWindow;
  if (window && !window.isDestroyed()) {
    setImmediate(() => {
      if (controlWindow === window) {
        controlWindow = undefined;
      }
      window.destroy();
    });
  }
}

function destroyScreenshotEditorWindow(): void {
  const window = screenshotEditorWindow;
  if (window && !window.isDestroyed()) {
    screenshotEditorWindow = undefined;
    window.destroy();
  }
  schedulePreparedSelectionWindow();
}

function destroyLongScreenshotControlWindow(): void {
  const window = longScreenshotControlWindow;
  if (window && !window.isDestroyed()) {
    longScreenshotControlWindow = undefined;
    window.destroy();
  }
}

function destroyLongScreenshotIndicatorWindow(): void {
  const window = longScreenshotIndicatorWindow;
  if (window && !window.isDestroyed()) {
    longScreenshotIndicatorWindow = undefined;
    window.destroy();
  }
}

function destroyRecordingSetupWindow(): void {
  const window = recordingSetupWindow;
  if (window && !window.isDestroyed()) {
    recordingSetupWindow = undefined;
    window.destroy();
  }
}

function destroyCompletionWindow(): void {
  const window = completionWindow;
  if (window && !window.isDestroyed()) {
    completionWindow = undefined;
    window.destroy();
  }
  completionKind = undefined;
  completionPreviewDataUrl = undefined;
}

function notify(title: string, content: string): void {
  if (!notificationsEnabled) return;
  if (tray && process.platform === 'win32') {
    tray.displayBalloon({ title, content, iconType: 'info', noSound: true });
  } else if (Notification.isSupported()) {
    new Notification({ title, body: content, silent: true }).show();
  }
}

function fail(message: string): void {
  captureGranted = false;
  errorMessage = message;
  recorderSession.fail();
  void fileWriter.abort();
  selectionWindow?.destroy();
  selectionWindow = undefined;
  selectionDisplay = undefined;
  stopSelectionDisplayWatcher();
  destroyRecordingWindowSoon();
  destroyIndicatorWindowSoon();
  destroyLongScreenshotIndicatorWindow();
  destroyControlWindowSoon();
  destroyRecordingSetupWindow();
  destroyCompletionWindow();
  notify('Valley Capture', message);
  broadcast();
}

function assertMainSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('IPC 调用来源无效');
  }
}

function assertSelectionSender(event: IpcMainInvokeEvent): void {
  if (!selectionWindow || event.sender.id !== selectionWindow.webContents.id) {
    throw new Error('选区 IPC 调用来源无效');
  }
}

function assertRecordingSender(event: IpcMainInvokeEvent): void {
  if (!recordingWindow || event.sender.id !== recordingWindow.webContents.id) {
    throw new Error('录制 IPC 调用来源无效');
  }
}

function assertScreenshotEditorSender(event: IpcMainInvokeEvent): void {
  if (!screenshotEditorWindow || event.sender.id !== screenshotEditorWindow.webContents.id) {
    throw new Error('截图编辑 IPC 调用来源无效');
  }
}

function assertLongScreenshotControlSender(event: IpcMainInvokeEvent): void {
  if (
    !longScreenshotControlWindow ||
    event.sender.id !== longScreenshotControlWindow.webContents.id
  ) {
    throw new Error('长截图 IPC 调用来源无效');
  }
}

function assertRecordingSetupSender(event: IpcMainInvokeEvent): void {
  if (!recordingSetupWindow || event.sender.id !== recordingSetupWindow.webContents.id) {
    throw new Error('录制设置 IPC 调用来源无效');
  }
}

function assertPinnedScreenshotSender(event: IpcMainInvokeEvent) {
  const pinned = pinnedScreenshots.get(event.sender.id);
  if (!pinned || pinned.window.isDestroyed()) {
    throw new Error('固定图片 IPC 调用来源无效');
  }
  return pinned;
}

function assertRecordingConfigurationSender(event: IpcMainInvokeEvent): void {
  if (
    !isAllowedIpcSender(event.sender.id, [
      selectionWindow?.webContents.id,
      recordingSetupWindow?.webContents.id,
    ])
  ) {
    throw new Error('录屏设置 IPC 调用来源无效');
  }
}

function assertOutputSender(event: IpcMainInvokeEvent): void {
  if (
    event.sender.id !== mainWindow?.webContents.id &&
    event.sender.id !== completionWindow?.webContents.id
  ) {
    throw new Error('输出 IPC 调用来源无效');
  }
}

function assertString(value: unknown, label: string, maxLength = 256): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${label}无效`);
  }
}

function parseRectangle(value: unknown): Rectangle {
  if (!value || typeof value !== 'object') {
    throw new Error('选区无效');
  }
  const source = value as Record<string, unknown>;
  const values = [source.x, source.y, source.width, source.height];
  if (!values.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error('选区坐标无效');
  }
  return {
    x: source.x as number,
    y: source.y as number,
    width: source.width as number,
    height: source.height as number,
  };
}

function parseDisplaySelection(display: Display, value: unknown) {
  const raw = parseRectangle(value);
  const normalized = normalizeSelection(
    { x: raw.x, y: raw.y },
    { x: raw.x + raw.width, y: raw.y + raw.height },
  );
  const localSelection = validateSelection(
    clampRectToBounds(normalized, {
      x: 0,
      y: 0,
      width: display.bounds.width,
      height: display.bounds.height,
    }),
  );
  return {
    local: localSelection,
    global: {
      x: display.bounds.x + localSelection.x,
      y: display.bounds.y + localSelection.y,
      width: localSelection.width,
      height: localSelection.height,
    },
  };
}

function loadLocalRenderer(
  window: BrowserWindow,
  mode:
    | 'main'
    | 'selection'
    | 'recorder'
    | 'indicator'
    | 'control'
    | 'screenshot-editor'
    | 'long-screenshot-control'
    | 'long-screenshot-indicator'
    | 'recording-setup'
    | 'pinned-screenshot'
    | 'completion'
    | 'screenshot-completion',
): void {
  if (DEV_SERVER_URL) {
    const url = new URL(DEV_SERVER_URL);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') {
      throw new Error('开发服务器地址必须是本机 HTTP 地址');
    }
    url.searchParams.set('mode', mode);
    void window.loadURL(url.toString());
    return;
  }
  void window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode } });
}

function secureWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: false,
    backgroundThrottling: false,
  } as const;
}

function fitOverlayToDisplay(window: BrowserWindow, display: Display): void {
  window.setBounds(display.bounds);
}

function createMainWindow(): void {
  const primaryBounds = screen.getPrimaryDisplay().workArea;
  const width = 600;
  const height = Math.min(700, Math.max(560, primaryBounds.height - 48));
  mainWindow = new BrowserWindow({
    x: primaryBounds.x + Math.round((primaryBounds.width - width) / 2),
    y: primaryBounds.y + Math.round((primaryBounds.height - height) / 2),
    width,
    height,
    minWidth: width,
    minHeight: height,
    maxWidth: width,
    maxHeight: height,
    useContentSize: true,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#101217',
    icon: getAppIcon(),
    title: 'Valley Screen Recorder',
    webPreferences: secureWebPreferences(),
  });
  mainWindow.setContentProtection(shouldProtectWindowContent('settings'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  loadLocalRenderer(mainWindow, 'main');
}

function createPinnedScreenshotWindow(
  image: NativeImage,
  display: Display,
  displaySize: { width: number; height: number },
): void {
  const imageSize = image.getSize();
  const inset = 12;
  const bounds = getPinnedScreenshotWindowBounds(displaySize, display.workArea, inset);
  const pinnedWindow = new BrowserWindow({
    ...bounds.window,
    minWidth: Math.min(160 + inset * 2, bounds.window.width),
    minHeight: Math.min(90 + inset * 2, bounds.window.height),
    show: false,
    transparent: true,
    frame: false,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  pinnedWindow.setAspectRatio(imageSize.width / imageSize.height, {
    width: inset * 2,
    height: inset * 2,
  });
  pinnedWindow.setAlwaysOnTop(true, 'screen-saver');
  pinnedWindow.setContentProtection(true);
  pinnedWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pinnedWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const webContentsId = pinnedWindow.webContents.id;
  pinnedScreenshots.set(webContentsId, {
    dataUrl: image.toDataURL(),
    window: pinnedWindow,
  });
  pinnedWindow.once('ready-to-show', () => pinnedWindow.showInactive());
  pinnedWindow.on('closed', () => pinnedScreenshots.delete(webContentsId));
  loadLocalRenderer(pinnedWindow, 'pinned-screenshot');
}

function createRecordingWindow(display: Display): void {
  if (recordingWindow && !recordingWindow.isDestroyed()) {
    throw new Error('录制宿主窗口已存在');
  }
  recordingWindow = new BrowserWindow({
    x: display.bounds.x + display.bounds.width - 1,
    y: display.bounds.y + display.bounds.height - 1,
    width: 1,
    height: 1,
    minWidth: 1,
    minHeight: 1,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: secureWebPreferences(),
  });
  recordingWindow.setContentProtection(true);
  recordingWindow.setIgnoreMouseEvents(true);
  recordingWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  recordingWindow.once('ready-to-show', () => recordingWindow?.showInactive());
  recordingWindow.on('closed', () => {
    recordingWindow = undefined;
  });
  loadLocalRenderer(recordingWindow, 'recorder');
}

function createIndicatorWindow(display: Display): void {
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    throw new Error('录制状态提示窗口已存在');
  }
  indicatorWindow = new BrowserWindow({
    ...display.bounds,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  indicatorWindow.setAlwaysOnTop(true, 'screen-saver');
  indicatorWindow.setContentProtection(true);
  indicatorWindow.setIgnoreMouseEvents(true, { forward: true });
  indicatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  indicatorWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  indicatorWindow.once('ready-to-show', () => {
    if (!indicatorWindow) return;
    fitOverlayToDisplay(indicatorWindow, display);
    indicatorWindow.showInactive();
  });
  indicatorWindow.on('closed', () => {
    indicatorWindow = undefined;
  });
  loadLocalRenderer(indicatorWindow, 'indicator');
}

function createControlWindow(display: Display): void {
  if (controlWindow && !controlWindow.isDestroyed()) {
    throw new Error('悬浮录制控制窗口已存在');
  }
  const width = Math.min(320, Math.max(240, display.bounds.width - 24));
  const height = 64;
  controlWindow = new BrowserWindow({
    x: display.bounds.x + Math.round((display.bounds.width - width) / 2),
    y: display.bounds.y + 12,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  controlWindow.setAlwaysOnTop(true, 'screen-saver');
  controlWindow.setContentProtection(true);
  controlWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  controlWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  controlWindow.once('ready-to-show', () => controlWindow?.showInactive());
  controlWindow.on('closed', () => {
    controlWindow = undefined;
  });
  loadLocalRenderer(controlWindow, 'control');
}

function createSelectionBrowserWindow(display: Display): BrowserWindow {
  const nextSelectionWindow = new BrowserWindow({
    ...display.bounds,
    ...getDisplayOverlayWindowOptions(process.platform),
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  nextSelectionWindow.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    nextSelectionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  nextSelectionWindow.setContentProtection(shouldProtectWindowContent('capture-overlay'));
  nextSelectionWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  nextSelectionWindow.on('closed', () => {
    preparedSelectionWindows.remove(nextSelectionWindow);
    if (selectionWindow === nextSelectionWindow) {
      selectionWindow = undefined;
      selectionDisplay = undefined;
      selectionPurpose = undefined;
      windowTargetsPromise = undefined;
      stopSelectionDisplayWatcher();
    }
    if (screenshotEditorWindow === nextSelectionWindow) screenshotEditorWindow = undefined;
    schedulePreparedSelectionWindow();
  });
  loadLocalRenderer(nextSelectionWindow, 'selection');
  return nextSelectionWindow;
}

function stopSelectionDisplayWatcher(): void {
  if (selectionDisplayWatcher) clearInterval(selectionDisplayWatcher);
  selectionDisplayWatcher = undefined;
  selectionGestureActive = false;
}

function followSelectionDisplayAtCursor(): void {
  const currentDisplay = selectionDisplay;
  const currentWindow = selectionWindow;
  if (
    !currentDisplay ||
    !currentWindow ||
    currentWindow.isDestroyed() ||
    (selectionPurpose === 'recording' && recorderSession.state !== 'selecting') ||
    (selectionPurpose === 'screenshot' && screenshotSession.state !== 'selecting') ||
    selectionPurpose === 'color-picker'
  ) {
    return;
  }

  const displays = screen.getAllDisplays();
  const nextGeometry = findSelectionDisplayChange(
    displays.map(toDisplayGeometry),
    String(currentDisplay.id),
    screen.getCursorScreenPoint(),
    selectionGestureActive,
  );
  if (!nextGeometry) return;
  const nextDisplay = displays.find((display) => String(display.id) === nextGeometry.id);
  if (!nextDisplay) return;

  selectionDisplay = nextDisplay;
  windowTargetsPromise = detectWindowTargets(nextDisplay);
  fitOverlayToDisplay(currentWindow, nextDisplay);
  currentWindow.moveTop();
  if (selectionPurpose === 'screenshot') {
    const nextTask = { display: nextDisplay };
    screenshotTask = nextTask;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    primeScreenshotCaptureAfterFirstPaint(nextTask);
  }
  broadcast();
}

function startSelectionDisplayWatcher(): void {
  stopSelectionDisplayWatcher();
  selectionDisplayWatcher = setInterval(
    followSelectionDisplayAtCursor,
    SELECTION_DISPLAY_FOLLOW_INTERVAL_MS,
  );
}

function ensurePreparedSelectionWindow(): void {
  if (
    isQuitting ||
    !app.isReady() ||
    preparedSelectionWindows.hasWindow() ||
    selectionWindow ||
    screenshotEditorWindow ||
    isRecordingBusy() ||
    isScreenshotBusy()
  ) {
    return;
  }
  preparedSelectionWindows.store(createSelectionBrowserWindow(screen.getPrimaryDisplay()));
}

function schedulePreparedSelectionWindow(): void {
  if (preparedSelectionWindowScheduled || isQuitting || !app.isReady()) return;
  preparedSelectionWindowScheduled = true;
  setImmediate(() => {
    preparedSelectionWindowScheduled = false;
    ensurePreparedSelectionWindow();
  });
}

function createSelectionWindow(
  display: Display,
  purpose: 'recording' | 'screenshot' | 'color-picker',
): void {
  if (selectionWindow && !selectionWindow.isDestroyed()) selectionWindow.destroy();
  selectionDisplay = display;
  selectionPurpose = purpose;
  windowTargetsPromise = purpose === 'color-picker' ? undefined : detectWindowTargets(display);
  const nextSelectionWindow =
    preparedSelectionWindows.take() ?? createSelectionBrowserWindow(display);
  selectionWindow = nextSelectionWindow;
  fitOverlayToDisplay(nextSelectionWindow, display);
  if (!nextSelectionWindow.webContents.isLoadingMainFrame()) {
    nextSelectionWindow.webContents.send(IPC_CHANNELS.snapshot, snapshot());
  }
  startSelectionDisplayWatcher();
}

function reuseSelectionWindowForScreenshotEditor(): void {
  if (!selectionWindow || selectionWindow.isDestroyed()) {
    throw new Error('截图选择窗口已失效');
  }
  screenshotEditorWindow = selectionWindow;
  selectionWindow = undefined;
  selectionDisplay = undefined;
  selectionPurpose = undefined;
  windowTargetsPromise = undefined;
  stopSelectionDisplayWatcher();
}

function getRecordingSetupBounds(display: Display, selection?: Rectangle) {
  const width = Math.min(440, display.workArea.width - 24);
  const height = 342;
  if (!selection) {
    return {
      x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
      y: display.workArea.y + Math.round((display.workArea.height - height) / 2),
      width,
      height,
    };
  }
  const centeredX = selection.x + Math.round((selection.width - width) / 2);
  const preferredY = selection.y + selection.height + 14;
  const x = Math.max(
    display.workArea.x + 12,
    Math.min(centeredX, display.workArea.x + display.workArea.width - width - 12),
  );
  const y =
    preferredY + height <= display.workArea.y + display.workArea.height - 12
      ? preferredY
      : Math.max(display.workArea.y + 12, selection.y - height - 14);
  return { x, y, width, height };
}

function createRecordingSetupWindow(display: Display, selection?: Rectangle): void {
  destroyRecordingSetupWindow();
  const bounds = getRecordingSetupBounds(display, selection);
  const nextWindow = new BrowserWindow({
    ...bounds,
    ...(selectionWindow && !selectionWindow.isDestroyed() ? { parent: selectionWindow } : {}),
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  recordingSetupWindow = nextWindow;
  nextWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  nextWindow.setContentProtection(true);
  nextWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  nextWindow.once('ready-to-show', () => {
    if (recordingSetupWindow === nextWindow) {
      nextWindow.show();
      nextWindow.focus();
      nextWindow.moveTop();
    }
  });
  nextWindow.on('closed', () => {
    if (recordingSetupWindow === nextWindow) {
      recordingSetupWindow = undefined;
    }
  });
  loadLocalRenderer(nextWindow, 'recording-setup');
}

function getLongScreenshotControlBounds(display: Display, selection: Rectangle) {
  const width = Math.min(360, display.workArea.width - 24);
  const height = Math.min(340, display.workArea.height - 24);
  const gap = 12;
  const area = display.workArea;
  const candidates = [
    { x: selection.x + selection.width + gap, y: selection.y },
    { x: selection.x - width - gap, y: selection.y },
    { x: selection.x, y: selection.y + selection.height + gap },
    { x: selection.x, y: selection.y - height - gap },
  ];
  const position = candidates.find(
    ({ x, y }) =>
      x >= area.x &&
      y >= area.y &&
      x + width <= area.x + area.width &&
      y + height <= area.y + area.height,
  ) ?? {
    x: area.x + area.width - width - gap,
    y: area.y + area.height - height - gap,
  };
  return { ...position, width, height };
}

function createLongScreenshotControlWindow(display: Display, selection: Rectangle): void {
  destroyLongScreenshotControlWindow();
  const nextWindow = new BrowserWindow({
    ...getLongScreenshotControlBounds(display, selection),
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  longScreenshotControlWindow = nextWindow;
  nextWindow.setAlwaysOnTop(true, 'screen-saver', 2);
  nextWindow.setContentProtection(true);
  nextWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  nextWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
    if (
      longScreenshotControlWindow === nextWindow &&
      screenshotSession.state === 'long-capturing'
    ) {
      cancelLongScreenshot();
    }
  });
  nextWindow.once('ready-to-show', () => {
    if (longScreenshotControlWindow === nextWindow) nextWindow.showInactive();
  });
  nextWindow.on('closed', () => {
    if (longScreenshotControlWindow === nextWindow) longScreenshotControlWindow = undefined;
  });
  loadLocalRenderer(nextWindow, 'long-screenshot-control');
}

function createLongScreenshotIndicatorWindow(display: Display): void {
  destroyLongScreenshotIndicatorWindow();
  const nextWindow = new BrowserWindow({
    ...display.bounds,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  longScreenshotIndicatorWindow = nextWindow;
  nextWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  nextWindow.setContentProtection(true);
  nextWindow.setIgnoreMouseEvents(true, { forward: true });
  nextWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  nextWindow.once('ready-to-show', () => {
    if (longScreenshotIndicatorWindow === nextWindow) {
      fitOverlayToDisplay(nextWindow, display);
      nextWindow.showInactive();
    }
  });
  nextWindow.on('closed', () => {
    if (longScreenshotIndicatorWindow === nextWindow) {
      longScreenshotIndicatorWindow = undefined;
    }
  });
  loadLocalRenderer(nextWindow, 'long-screenshot-indicator');
}

function createCompletionWindow(
  displayGeometry: CapturePlan['display'] | undefined,
  kind: 'recording' | 'screenshot' = 'recording',
  previewDataUrl?: string,
): void {
  destroyCompletionWindow();
  const display =
    screen.getAllDisplays().find((candidate) => String(candidate.id) === displayGeometry?.id) ??
    screen.getPrimaryDisplay();
  const width = kind === 'screenshot' ? 520 : 470;
  const height = kind === 'screenshot' ? 430 : 214;
  const nextWindow = new BrowserWindow({
    x: display.workArea.x + display.workArea.width - width - 20,
    y: display.workArea.y + display.workArea.height - height - 20,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: secureWebPreferences(),
  });
  completionWindow = nextWindow;
  completionKind = kind;
  completionPreviewDataUrl = previewDataUrl;
  nextWindow.setAlwaysOnTop(true, 'floating');
  nextWindow.setContentProtection(true);
  nextWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  nextWindow.once('ready-to-show', () => {
    if (completionWindow === nextWindow) {
      nextWindow.show();
      nextWindow.focus();
    }
  });
  nextWindow.on('closed', () => {
    if (completionWindow === nextWindow) completionWindow = undefined;
  });
  loadLocalRenderer(nextWindow, kind === 'screenshot' ? 'screenshot-completion' : 'completion');
}

function pickDisplayAtCursor(): Display {
  const point = screen.getCursorScreenPoint();
  const displays = screen.getAllDisplays();
  const geometry = findDisplayForPoint(displays.map(toDisplayGeometry), point);
  return (
    displays.find((display) => String(display.id) === geometry?.id) ?? screen.getPrimaryDisplay()
  );
}

function isRecordingBusy(): boolean {
  return ['selecting', 'configuring', 'countdown', 'recording', 'stopping'].includes(
    recorderSession.state,
  );
}

function isScreenshotBusy(): boolean {
  return ['selecting', 'capturing', 'editing', 'long-capturing'].includes(screenshotSession.state);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createAvailableScreenshotPath(): Promise<string> {
  const baseName = createScreenshotFilename(new Date());
  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);
  let targetPath = path.join(screenshotDirectory, baseName);
  for (let suffix = 2; await pathExists(targetPath); suffix += 1) {
    targetPath = path.join(screenshotDirectory, `${stem}-${suffix}${extension}`);
  }
  return targetPath;
}

async function captureDisplayImage(
  display: Display,
  settleForHiddenOverlays = true,
): Promise<NativeImage> {
  if (FORCE_PERMISSION_DENIED) {
    throw new Error(SCREENSHOT_PERMISSION_DENIED_MESSAGE);
  }
  mainWindow?.hide();
  recordingSetupWindow?.hide();
  if (settleForHiddenOverlays) await new Promise((resolve) => setTimeout(resolve, 32));

  const targetWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor));
  const targetHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: targetWidth, height: targetHeight },
    fetchWindowIcons: false,
  });
  const source = matchDisplaySource(
    sources.map((item) => ({ source: item, displayId: item.display_id })),
    toDisplayGeometry(display),
  )?.source;
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('找不到目标显示器的截图源');
  }
  return source.thumbnail;
}

function getScreenCapturePermissionStatus(): ScreenCapturePermissionStatus {
  const reportedStatus = FORCE_PERMISSION_DENIED
    ? 'denied'
    : process.platform === 'darwin'
      ? systemPreferences.getMediaAccessStatus('screen')
      : 'granted';
  return resolveScreenCapturePermissionStatus(
    process.platform,
    reportedStatus,
    nativeScreenCaptureVerified,
  );
}

async function performNativeScreenCapturePermissionRequest(): Promise<void> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1, height: 1 },
    fetchWindowIcons: false,
  });
  if (sources.length === 0) throw new Error('No screen capture sources available');
  nativeScreenCaptureVerified = true;
  void windowTargetCache.refresh().catch(() => undefined);
}

const requestNativeScreenCapturePermission = createSingleFlightScreenCapturePermissionRequest(
  performNativeScreenCapturePermissionRequest,
);

function runWithScreenCapturePermission<T>(
  deniedMessage: string,
  run: () => T | Promise<T>,
): Promise<T> {
  return runAfterScreenCapturePermission({
    platform: process.platform,
    getStatus: getScreenCapturePermissionStatus,
    requestPermission: requestNativeScreenCapturePermission,
    deniedMessage,
    run,
  });
}

function primeScreenshotCapture(display: Display): void {
  screenshotSourcePromise = captureDisplayImage(display);
  void screenshotSourcePromise.catch(() => undefined);
}

function primeScreenshotCaptureAfterFirstPaint(task: { display: Display }): void {
  setTimeout(() => {
    if (
      screenshotTask !== task ||
      selectionPurpose !== 'screenshot' ||
      screenshotSession.state !== 'selecting' ||
      screenshotSourcePromise
    ) {
      return;
    }
    primeScreenshotCapture(task.display);
  }, SCREENSHOT_CAPTURE_PRIME_DELAY_MS);
}

async function captureScreenshotImage(): Promise<NativeImage> {
  const task = screenshotTask;
  if (!task) {
    throw new Error('截图任务已失效');
  }
  const capture = screenshotSourcePromise ?? captureDisplayImage(task.display);
  screenshotSourcePromise = undefined;
  const thumbnail = await capture;
  screenshotDisplayImage = thumbnail;

  const thumbnailSize = thumbnail.getSize();
  const image = task.selection
    ? thumbnail.crop(
        dipRectToVideoPixels(task.selection, toDisplayGeometry(task.display), thumbnailSize),
      )
    : thumbnail;
  if (image.isEmpty()) {
    throw new Error('截图没有产生有效图像数据');
  }
  return image;
}

async function writeScreenshotPng(png: Uint8Array, requestedPath?: string): Promise<string> {
  if (FORCE_WRITE_FAILURE) {
    throw new Error('测试模式：文件写入失败');
  }
  if (!isValidPng(png)) {
    throw new Error('截图数据不是有效 PNG');
  }

  const finalPath = requestedPath
    ? ensurePngExtension(requestedPath)
    : await createAvailableScreenshotPath();
  await mkdir(path.dirname(finalPath), { recursive: true });
  const temporaryPath = `${finalPath}.part-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, png, { flag: 'wx' });
    try {
      await rename(temporaryPath, finalPath);
    } catch (error) {
      if (!requestedPath || !(await pathExists(finalPath))) throw error;
      await rm(finalPath, { force: true });
      await rename(temporaryPath, finalPath);
    }
    return finalPath;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function chooseScreenshotSavePath(): Promise<string | undefined> {
  await mkdir(screenshotDirectory, { recursive: true });
  const defaultPath = await createAvailableScreenshotPath();
  const options = {
    title: '保存截图',
    defaultPath,
    filters: [{ name: 'PNG 图像', extensions: ['png'] }],
    properties: ['showOverwriteConfirmation' as const, 'createDirectory' as const],
  };
  const result = screenshotEditorWindow
    ? await dialog.showSaveDialog(screenshotEditorWindow, options)
    : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? undefined : ensurePngExtension(result.filePath);
}

function bitmapFrameFromImage(image: NativeImage): BitmapFrame {
  const size = image.getSize();
  return {
    width: size.width,
    height: size.height,
    data: new Uint8Array(image.toBitmap()),
  };
}

function createLongScreenshotPreviewSlice(frame: BitmapFrame) {
  const image = nativeImage.createFromBitmap(Buffer.from(frame.data), {
    width: frame.width,
    height: frame.height,
    scaleFactor: 1,
  });
  if (image.isEmpty()) throw new Error('无法生成长截图预览');
  return {
    dataUrl: image.resize({ width: Math.min(180, frame.width), quality: 'good' }).toDataURL(),
    pixelHeight: frame.height,
  };
}

function updateLongScreenshotNotice(
  capture: NonNullable<typeof longScreenshotCapture>,
  notice: string | undefined,
): boolean {
  if (capture.notice === notice) return false;
  capture.notice = notice;
  return true;
}

async function copyScreenshot(png: Uint8Array): Promise<void> {
  const clipboardImage = nativeImage.createFromBuffer(Buffer.from(png));
  if (clipboardImage.isEmpty()) throw new Error('截图图像无法读取');
  clipboard.writeImage(clipboardImage);
  screenshotCopiedToClipboard = true;
}

async function persistCompletedScreenshot(png: Uint8Array, requestedPath?: string): Promise<void> {
  screenshotOutputPath = await writeScreenshotPng(png, requestedPath);
  try {
    await copyScreenshot(png);
  } catch (clipboardError) {
    screenshotCopiedToClipboard = false;
    warningMessage = `截图已保存，但复制到剪贴板失败：${clipboardError instanceof Error ? clipboardError.message : '未知错误'}`;
  }
  screenshotSession.complete();
  notify(
    '截图已保存',
    screenshotCopiedToClipboard ? `${screenshotOutputPath}\n已复制到剪贴板` : screenshotOutputPath,
  );
  screenshotTask = undefined;
  screenshotSourcePromise = undefined;
  screenshotDisplayImage = undefined;
  screenshotEditPlan = undefined;
  errorMessage = undefined;
}

async function captureLongScreenshotFrame(): Promise<void> {
  const capture = longScreenshotCapture;
  if (!capture || capture.sampling || screenshotSession.state !== 'long-capturing') return;
  capture.sampling = true;
  let changed = false;
  try {
    const thumbnail = await captureDisplayImage(capture.display, false);
    const image = thumbnail.crop(
      dipRectToVideoPixels(
        capture.selection,
        toDisplayGeometry(capture.display),
        thumbnail.getSize(),
      ),
    );
    if (image.isEmpty()) throw new Error('长截图没有捕获到有效画面');
    const current = bitmapFrameFromImage(image);
    const match = detectVerticalShift(capture.lastFrame, current);
    if (!match) {
      changed = updateLongScreenshotNotice(capture, '未识别到连续内容，请放慢滚动');
      return;
    }
    if (match.shift === 0) {
      changed = updateLongScreenshotNotice(capture, undefined);
      return;
    }
    if (capture.pixelHeight + match.shift > 30_000) {
      changed = updateLongScreenshotNotice(capture, '已达到 30000 px 上限，请完成截图');
      return;
    }
    const appendedFrame = extractAppendedFrame(current, match.shift);
    capture.slices.push({ frame: appendedFrame, appendRows: appendedFrame.height });
    capture.previewSlices.push(createLongScreenshotPreviewSlice(appendedFrame));
    capture.lastFrame = current;
    capture.pixelHeight += match.shift;
    capture.notice = undefined;
    changed = true;
  } catch (error) {
    changed = updateLongScreenshotNotice(
      capture,
      error instanceof Error ? error.message : '长截图捕获失败',
    );
  } finally {
    capture.sampling = false;
    if (changed) broadcast();
  }
}

function clearLongScreenshotCapture(): void {
  if (longScreenshotCapture) clearInterval(longScreenshotCapture.timer);
  longScreenshotCapture = undefined;
}

async function startLongScreenshot(operationId: string, firstPng: Uint8Array): Promise<void> {
  const task = screenshotTask;
  const selection = task?.selection;
  if (
    screenshotSession.state !== 'editing' ||
    !screenshotEditPlan ||
    screenshotEditPlan.operationId !== operationId ||
    !task ||
    !selection
  ) {
    throw new Error('长截图任务已失效');
  }
  if (!isValidPng(firstPng)) throw new Error('长截图首帧数据无效');
  const firstImage = nativeImage.createFromBuffer(Buffer.from(firstPng));
  if (firstImage.isEmpty()) throw new Error('长截图首帧无法读取');
  const firstFrame = bitmapFrameFromImage(firstImage);
  const timer = setInterval(() => void captureLongScreenshotFrame(), 650);
  longScreenshotCapture = {
    operationId,
    display: task.display,
    selection,
    slices: [{ frame: firstFrame, appendRows: firstFrame.height }],
    lastFrame: firstFrame,
    pixelHeight: firstFrame.height,
    previewSlices: [createLongScreenshotPreviewSlice(firstFrame)],
    startedAt: Date.now(),
    timer,
    sampling: false,
  };
  screenshotSession.beginLongCapture();
  screenshotEditorWindow?.hide();
  createLongScreenshotIndicatorWindow(task.display);
  createLongScreenshotControlWindow(task.display, selection);
  broadcast();
}

async function finishLongScreenshot(): Promise<void> {
  const capture = longScreenshotCapture;
  if (!capture || screenshotSession.state !== 'long-capturing') {
    throw new Error('长截图任务已失效');
  }
  clearInterval(capture.timer);
  while (capture.sampling) await new Promise((resolve) => setTimeout(resolve, 20));
  await captureLongScreenshotFrame();
  try {
    const composed = composeLongScreenshot(capture.slices);
    const image = nativeImage.createFromBitmap(Buffer.from(composed.data), {
      width: composed.width,
      height: composed.height,
      scaleFactor: 1,
    });
    if (image.isEmpty()) throw new Error('无法生成长截图');
    const png = image.toPNG();
    const preview = image.resize({ width: 440, quality: 'best' }).toDataURL();
    const completedDisplay = toDisplayGeometry(capture.display);
    await persistCompletedScreenshot(png);
    clearLongScreenshotCapture();
    destroyLongScreenshotIndicatorWindow();
    destroyLongScreenshotControlWindow();
    destroyScreenshotEditorWindow();
    createCompletionWindow(completedDisplay, 'screenshot', preview);
    broadcast();
  } catch (error) {
    screenshotSession.fail();
    clearLongScreenshotCapture();
    destroyLongScreenshotIndicatorWindow();
    destroyLongScreenshotControlWindow();
    destroyScreenshotEditorWindow();
    errorMessage = `无法保存长截图：${error instanceof Error ? error.message : '未知错误'}`;
    notify('长截图失败', errorMessage);
    broadcast();
    throw error;
  }
}

function cancelLongScreenshot(): void {
  if (!longScreenshotCapture || screenshotSession.state !== 'long-capturing') {
    throw new Error('长截图任务已失效');
  }
  screenshotSession.cancelEditing();
  clearLongScreenshotCapture();
  screenshotTask = undefined;
  screenshotSourcePromise = undefined;
  screenshotDisplayImage = undefined;
  screenshotEditPlan = undefined;
  destroyLongScreenshotIndicatorWindow();
  destroyLongScreenshotControlWindow();
  destroyScreenshotEditorWindow();
  broadcast();
}

async function captureScreenshotFile(): Promise<string> {
  const image = await captureScreenshotImage();
  return writeScreenshotPng(image.toPNG());
}

async function prepareScreenshotEditor(): Promise<void> {
  const task = screenshotTask;
  if (!task?.selection) {
    throw new Error('截图选区已失效');
  }
  try {
    const image = await captureScreenshotImage();
    const pixelSize = image.getSize();
    screenshotEditPlan = {
      operationId: randomUUID(),
      imageDataUrl: image.toDataURL(),
      selection: {
        x: task.selection.x - task.display.bounds.x,
        y: task.selection.y - task.display.bounds.y,
        width: task.selection.width,
        height: task.selection.height,
      },
      pixelSize,
    };
    screenshotSession.beginEditing();
    reuseSelectionWindowForScreenshotEditor();
    errorMessage = undefined;
  } catch (error) {
    screenshotSession.fail();
    screenshotEditPlan = undefined;
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    errorMessage = `无法准备截图：${error instanceof Error ? error.message : '未知错误'}`;
    notify('截图失败', errorMessage);
  }
  broadcast();
}

function updateScreenshotSelection(operationId: string, value: unknown): ScreenshotEditPlan {
  const task = screenshotTask;
  const displayImage = screenshotDisplayImage;
  if (
    screenshotSession.state !== 'editing' ||
    !task ||
    !task.selection ||
    !displayImage ||
    !screenshotEditPlan ||
    screenshotEditPlan.operationId !== operationId
  ) {
    throw new Error('截图选区调整任务已失效');
  }
  const selection = parseDisplaySelection(task.display, value);
  if (
    selection.local.width !== screenshotEditPlan.selection.width ||
    selection.local.height !== screenshotEditPlan.selection.height
  ) {
    throw new Error('移动截图时不能改变选区尺寸');
  }
  const image = displayImage.crop(
    dipRectToVideoPixels(selection.global, toDisplayGeometry(task.display), displayImage.getSize()),
  );
  if (image.isEmpty()) throw new Error('移动后的截图区域无效');
  screenshotTask = { ...task, selection: selection.global };
  screenshotEditPlan = {
    ...screenshotEditPlan,
    imageDataUrl: image.toDataURL(),
    selection: selection.local,
    pixelSize: image.getSize(),
  };
  return screenshotEditPlan;
}

async function finishScreenshot(): Promise<void> {
  try {
    screenshotOutputPath = await screenshotSession.capture();
    errorMessage = undefined;
    notify('截图已保存', screenshotOutputPath);
  } catch (error) {
    errorMessage = `无法保存截图：${error instanceof Error ? error.message : '未知错误'}`;
    notify('截图失败', errorMessage);
  } finally {
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    const confirmedSelectionWindow = selectionWindow;
    confirmedSelectionWindow?.hide();
    if (confirmedSelectionWindow && !confirmedSelectionWindow.isDestroyed()) {
      setTimeout(() => confirmedSelectionWindow.destroy(), 100);
    }
    broadcast();
  }
}

async function beginRecording(mode: 'screen' | 'region'): Promise<void> {
  if (isScreenshotBusy()) {
    throw new Error('请先完成或取消当前截图');
  }
  await runWithScreenCapturePermission(RECORDING_PERMISSION_DENIED_MESSAGE, () => {
    if (isScreenshotBusy()) throw new Error('请先完成或取消当前截图');
    recorderSession.begin(mode);
    errorMessage = undefined;
    outputPath = undefined;
    startedAt = undefined;
    captureGranted = false;
    destroyCompletionWindow();
    concealMainWindow();
    if (mode === 'screen') {
      const display = screen.getPrimaryDisplay();
      pendingRecording = { mode: 'screen', display };
      activePlan = createPlan(
        'screen',
        display,
        undefined,
        'webm',
        getDefaultRecordingOptions(process.platform),
      );
      createIndicatorWindow(display);
      createRecordingSetupWindow(display);
    } else {
      activePlan = undefined;
      createSelectionWindow(pickDisplayAtCursor(), 'recording');
    }
    broadcast();
  });
}

async function beginScreenshot(mode: ScreenshotMode): Promise<void> {
  if (isRecordingBusy()) {
    throw new Error('请先完成或取消当前录制');
  }
  await runWithScreenCapturePermission(SCREENSHOT_PERMISSION_DENIED_MESSAGE, async () => {
    if (isRecordingBusy()) throw new Error('请先完成或取消当前录制');
    screenshotSession.begin(mode);
    screenshotOutputPath = undefined;
    screenshotCopiedToClipboard = false;
    errorMessage = undefined;
    destroyCompletionWindow();
    concealMainWindow();
    const display = mode === 'screen' ? screen.getPrimaryDisplay() : pickDisplayAtCursor();
    screenshotTask = { display };
    if (mode === 'region') {
      createSelectionWindow(display, 'screenshot');
      broadcast();
      return;
    }
    primeScreenshotCapture(display);
    broadcast();
    await finishScreenshot();
  });
}

async function beginColorPicker(): Promise<void> {
  if (isRecordingBusy()) throw new Error('请先完成或取消当前录制');
  if (isScreenshotBusy()) throw new Error('请先完成或取消当前截图');
  await runWithScreenCapturePermission(SCREENSHOT_PERMISSION_DENIED_MESSAGE, () => {
    if (isRecordingBusy()) throw new Error('请先完成或取消当前录制');
    if (isScreenshotBusy()) throw new Error('请先完成或取消当前截图');
    screenshotSession.begin('region');
    screenshotOutputPath = undefined;
    screenshotCopiedToClipboard = false;
    errorMessage = undefined;
    destroyCompletionWindow();
    concealMainWindow();
    const display = pickDisplayAtCursor();
    screenshotTask = { display };
    primeScreenshotCapture(display);
    createSelectionWindow(display, 'color-picker');
    broadcast();
  });
}

function switchSelectionPurpose(purpose: 'recording' | 'screenshot'): void {
  if (!selectionWindow || !selectionDisplay || !selectionPurpose) {
    throw new Error('当前没有可切换的选区任务');
  }
  if (purpose === selectionPurpose) {
    return;
  }
  if (purpose === 'recording') {
    screenshotSession.cancelSelection();
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    recorderSession.begin('region');
  } else {
    recorderSession.cancelSelection();
    activePlan = undefined;
    screenshotSession.begin('region');
    screenshotTask = { display: selectionDisplay };
    primeScreenshotCapture(selectionDisplay);
  }
  selectionPurpose = purpose;
  errorMessage = undefined;
  broadcast();
}

async function ensureMediaPermissions(configuration: RecordingConfiguration): Promise<void> {
  if (FORCE_PERMISSION_DENIED) throw new Error('屏幕录制权限被拒绝');
  const requested = [
    configuration.options.microphone ? ('microphone' as const) : undefined,
    configuration.options.camera ? ('camera' as const) : undefined,
  ].filter((value): value is 'microphone' | 'camera' => Boolean(value));
  for (const mediaType of requested) {
    if (process.platform === 'darwin') {
      const granted = await systemPreferences.askForMediaAccess(mediaType);
      if (!granted)
        throw new Error(`${mediaType === 'microphone' ? '麦克风' : '摄像头'}权限被拒绝`);
    } else if (process.platform === 'win32') {
      const status = systemPreferences.getMediaAccessStatus(mediaType);
      if (status === 'denied' || status === 'restricted') {
        throw new Error(`${mediaType === 'microphone' ? '麦克风' : '摄像头'}权限被拒绝`);
      }
    }
  }
}

async function startConfiguredRecording(configuration: RecordingConfiguration): Promise<void> {
  const pending = pendingRecording;
  if (!pending || recorderSession.state !== 'configuring') {
    throw new Error('录制设置已失效');
  }
  await ensureMediaPermissions(configuration);
  recorderSession.beginCountdown();
  activePlan = createPlan(
    pending.mode,
    pending.display,
    pending.selection,
    configuration.container,
    configuration.options,
  );
  createRecordingWindow(pending.display);
  if (!indicatorWindow || indicatorWindow.isDestroyed()) {
    createIndicatorWindow(pending.display);
  }
  createControlWindow(pending.display);
  pendingRecording = undefined;
  destroyRecordingSetupWindow();
  const configuredSelectionWindow = selectionWindow;
  configuredSelectionWindow?.hide();
  if (configuredSelectionWindow && !configuredSelectionWindow.isDestroyed()) {
    setTimeout(() => configuredSelectionWindow.destroy(), 300);
  }
  broadcast();
}

function cancelConfiguredRecording(): void {
  if (recorderSession.state !== 'configuring') {
    throw new Error('录制设置已失效');
  }
  recorderSession.cancelConfiguration();
  pendingRecording = undefined;
  activePlan = undefined;
  destroyRecordingSetupWindow();
  destroyIndicatorWindowSoon();
  selectionWindow?.destroy();
  broadcast();
}

function createPlan(
  mode: 'screen' | 'region',
  display: Display,
  selection?: Rectangle,
  container: RecordingContainer = 'webm',
  options = getDefaultRecordingOptions(process.platform),
): CapturePlan {
  return {
    operationId: randomUUID(),
    mode,
    container,
    options: { ...options },
    display: toDisplayGeometry(display),
    selection,
    countdownEndsAt: Date.now() + 3000,
  };
}

async function requestStop(): Promise<void> {
  if (recorderSession.state === 'countdown') {
    recorderSession.cancelCountdown();
    captureGranted = false;
    activePlan = undefined;
    startedAt = undefined;
    broadcast();
    destroyRecordingWindowSoon();
    destroyIndicatorWindowSoon();
    destroyControlWindowSoon();
    return;
  }
  if (recorderSession.state !== 'recording') {
    return;
  }
  recorderSession.requestStop();
  broadcast();
}

function handleShortcutError(error: unknown): void {
  errorMessage = error instanceof Error ? error.message : '快捷键操作失败';
  notify('快捷键操作失败', errorMessage);
  broadcast();
}

function registerShortcutSettings(settings: ShortcutSettings): boolean {
  if (FORCE_SHORTCUT_FAILURE) {
    return false;
  }
  try {
    const screenshotRegistered = globalShortcut.register(settings.screenshot, () => {
      if (
        !shouldHandleGlobalShortcut({
          settingsVisible: mainWindow?.isVisible() ?? false,
          shortcutCaptureActive,
        })
      )
        return;
      void beginScreenshot('region').catch(handleShortcutError);
    });
    if (!screenshotRegistered) {
      return false;
    }
    const recordingRegistered = globalShortcut.register(settings.recording, () => {
      if (
        !shouldHandleGlobalShortcut({
          settingsVisible: mainWindow?.isVisible() ?? false,
          shortcutCaptureActive,
        })
      )
        return;
      if (recorderSession.state === 'countdown' || recorderSession.state === 'recording') {
        void requestStop();
        return;
      }
      void beginRecording('region').catch(handleShortcutError);
    });
    if (!recordingRegistered) {
      globalShortcut.unregister(settings.screenshot);
      return false;
    }
    const colorPickerRegistered = globalShortcut.register(settings.colorPicker, () => {
      if (
        !shouldHandleGlobalShortcut({
          settingsVisible: mainWindow?.isVisible() ?? false,
          shortcutCaptureActive,
        })
      )
        return;
      void beginColorPicker().catch(handleShortcutError);
    });
    if (!colorPickerRegistered) {
      globalShortcut.unregisterAll();
      return false;
    }
    return true;
  } catch {
    globalShortcut.unregisterAll();
    return false;
  }
}

function activateShortcutCapture(): void {
  if (shortcutCaptureActive) return;
  shortcutCaptureActive = true;
  globalShortcut.unregisterAll();
  broadcast();
}

function deactivateShortcutCapture(): void {
  if (!shortcutCaptureActive) return;
  shortcutCaptureActive = false;
  if (!registerShortcutSettings(shortcutSettings)) {
    warningMessage = '全局快捷键恢复失败，请保存新的快捷键。';
  }
  broadcast();
}

async function persistShortcutSettings(settings: ShortcutSettings): Promise<void> {
  await mkdir(path.dirname(shortcutSettingsPath), { recursive: true });
  const temporaryPath = `${shortcutSettingsPath}.part-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { flag: 'wx' });
    await rename(temporaryPath, shortcutSettingsPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function getLoginItemOptions() {
  return getLoginItemTarget(process.platform, app.isPackaged, process.execPath, app.getAppPath());
}

function getAutoLaunchEnabled(): boolean {
  return app.getLoginItemSettings(getLoginItemOptions()).openAtLogin;
}

async function persistAppSettings(): Promise<void> {
  await mkdir(path.dirname(appSettingsPath), { recursive: true });
  const temporaryPath = `${appSettingsPath}.part-${randomUUID()}`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ recordingDirectory: saveDirectory, notificationsEnabled }, null, 2)}\n`,
      { flag: 'wx' },
    );
    await rename(temporaryPath, appSettingsPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function loadAppSettings(): Promise<void> {
  try {
    const raw = await readFile(appSettingsPath, 'utf8');
    const settings = parsePersistedAppSettings(JSON.parse(raw), path.isAbsolute);
    if (settings.recordingDirectory) {
      saveDirectory = settings.recordingDirectory;
      fileWriter.setSaveDirectory(saveDirectory);
    }
    notificationsEnabled = settings.notificationsEnabled;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      warningMessage = '录屏保存位置无法读取，已恢复默认目录。';
    }
  }
}

async function chooseRecordingDirectory(): Promise<{ changed: boolean }> {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('设置窗口已失效');
  if (isRecordingBusy()) throw new Error('请先完成或取消当前录制');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择录屏保存位置',
    defaultPath: saveDirectory,
    properties: ['openDirectory', 'createDirectory'],
  });
  const selected = result.filePaths[0];
  if (result.canceled || !selected) return { changed: false };
  if (!path.isAbsolute(selected) || selected.includes('\0') || selected.length > 1024) {
    throw new Error('录屏保存位置无效');
  }

  const previous = saveDirectory;
  try {
    fileWriter.setSaveDirectory(selected);
    saveDirectory = selected;
    await persistAppSettings();
    warningMessage = undefined;
    broadcast();
    return { changed: selected !== previous };
  } catch (error) {
    saveDirectory = previous;
    fileWriter.setSaveDirectory(previous);
    throw new Error(`无法保存录屏位置：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

function updateAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({ ...getLoginItemOptions(), openAtLogin: enabled });
  if (getAutoLaunchEnabled() !== enabled) {
    throw new Error(enabled ? '无法启用开机自启动' : '无法关闭开机自启动');
  }
  warningMessage = undefined;
  broadcast();
}

async function updateNotificationsEnabled(enabled: boolean): Promise<void> {
  const previous = notificationsEnabled;
  notificationsEnabled = enabled;
  try {
    await persistAppSettings();
    warningMessage = undefined;
    broadcast();
  } catch (error) {
    notificationsEnabled = previous;
    throw new Error(`无法保存通知设置：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

async function loadShortcutSettings(): Promise<void> {
  try {
    const raw = await readFile(shortcutSettingsPath, 'utf8');
    shortcutSettings = validateShortcutSettings(JSON.parse(raw), process.platform);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      warningMessage = '快捷键设置无法读取，已恢复默认值。';
    }
    shortcutSettings = { ...DEFAULT_SHORTCUTS };
  }
}

async function updateShortcutSettings(value: unknown): Promise<void> {
  const next = validateShortcutSettings(value, process.platform);
  const previous = shortcutSettings;
  shortcutCaptureActive = false;
  globalShortcut.unregisterAll();
  if (!registerShortcutSettings(next)) {
    registerShortcutSettings(previous);
    warningMessage = '快捷键注册失败，原设置已保留。';
    broadcast();
    throw new Error(warningMessage);
  }
  try {
    await persistShortcutSettings(next);
    shortcutSettings = next;
    warningMessage = undefined;
    broadcast();
  } catch (error) {
    globalShortcut.unregisterAll();
    registerShortcutSettings(previous);
    warningMessage = '快捷键设置无法保存，原设置已保留。';
    broadcast();
    throw new Error(`${warningMessage}${error instanceof Error ? ` ${error.message}` : ''}`);
  }
}

function rebuildTrayMenu(): void {
  if (!tray) {
    return;
  }
  const template: MenuItemConstructorOptions[] = [
    { label: '快捷键设置', click: showMainWindow },
    { type: 'separator' },
    {
      label: `区域截图（${shortcutSettings.screenshot}）`,
      enabled: !isRecordingBusy() && !isScreenshotBusy(),
      click: () => void beginScreenshot('region').catch(handleShortcutError),
    },
    {
      label: `区域录屏（${shortcutSettings.recording}）`,
      enabled: !isRecordingBusy() && !isScreenshotBusy(),
      click: () => void beginRecording('region').catch(handleShortcutError),
    },
    {
      label: `吸色（${shortcutSettings.colorPicker}）`,
      enabled: !isRecordingBusy() && !isScreenshotBusy(),
      click: () => void beginColorPicker().catch(handleShortcutError),
    },
    { type: 'separator' },
    {
      label:
        recorderSession.state === 'countdown'
          ? `取消录制（${shortcutSettings.recording}）`
          : `停止录制（${shortcutSettings.recording}）`,
      enabled: recorderSession.state === 'countdown' || recorderSession.state === 'recording',
      click: () => void requestStop(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        if (recorderSession.state === 'countdown' || recorderSession.state === 'recording') {
          void requestStop();
          return;
        }
        isQuitting = true;
        app.quit();
      },
    },
  ];
  trayMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(process.platform === 'darwin' ? null : trayMenu);
}

function createTray(): void {
  const icon =
    process.platform === 'darwin'
      ? nativeImage.createFromPath(trayTemplateIconPath)
      : getAppIcon().resize({ width: 16, height: 16, quality: 'best' });
  if (icon.isEmpty()) throw new Error('菜单栏图标资源无法读取');
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Valley Screen Recorder');
  tray.on(
    'click',
    createTrayPrimaryAction(() => beginScreenshot('region'), handleShortcutError),
  );
  if (process.platform === 'darwin') {
    tray.on('right-click', () => {
      if (trayMenu) tray?.popUpContextMenu(trayMenu);
    });
  }
  rebuildTrayMenu();
}

function registerIpc(): void {
  ipcMain.on(IPC_CHANNELS.selectionReady, (event) => {
    if (
      !selectionWindow ||
      !selectionDisplay ||
      selectionWindow.isDestroyed() ||
      event.sender.id !== selectionWindow.webContents.id
    ) {
      return;
    }
    fitOverlayToDisplay(selectionWindow, selectionDisplay);
    selectionWindow.show();
    selectionWindow.focus();
    if (
      selectionPurpose === 'screenshot' &&
      screenshotTask &&
      !screenshotSourcePromise &&
      screenshotSession.state === 'selecting'
    ) {
      primeScreenshotCaptureAfterFirstPaint(screenshotTask);
    }
  });

  ipcMain.handle(IPC_CHANNELS.getSnapshot, (event) => {
    if (
      !isAllowedIpcSender(event.sender.id, [
        mainWindow?.webContents.id,
        selectionWindow?.webContents.id,
        recordingWindow?.webContents.id,
        indicatorWindow?.webContents.id,
        controlWindow?.webContents.id,
        screenshotEditorWindow?.webContents.id,
        longScreenshotControlWindow?.webContents.id,
        longScreenshotIndicatorWindow?.webContents.id,
        recordingSetupWindow?.webContents.id,
        completionWindow?.webContents.id,
        preparedSelectionWindows.peek()?.webContents.id,
      ])
    ) {
      throw new Error('IPC 调用来源无效');
    }
    return snapshot();
  });

  ipcMain.handle(IPC_CHANNELS.getPinnedScreenshot, (event) => {
    const pinned = assertPinnedScreenshotSender(event);
    return { dataUrl: pinned.dataUrl };
  });

  ipcMain.handle(IPC_CHANNELS.closePinnedScreenshot, (event) => {
    const pinnedWindow = assertPinnedScreenshotSender(event).window;
    scheduleWindowDestroy(pinnedWindow);
  });

  ipcMain.handle(IPC_CHANNELS.start, async (event, mode: unknown) => {
    assertMainSender(event);
    if (mode !== 'screen' && mode !== 'region') {
      throw new Error('录制模式无效');
    }
    await beginRecording(mode);
  });

  ipcMain.handle(IPC_CHANNELS.startScreenshot, async (event, mode: unknown) => {
    assertMainSender(event);
    if (mode !== 'screen' && mode !== 'region') {
      throw new Error('截图模式无效');
    }
    await beginScreenshot(mode);
  });

  ipcMain.handle(IPC_CHANNELS.startColorPicker, async (event) => {
    assertMainSender(event);
    await beginColorPicker();
  });

  ipcMain.handle(IPC_CHANNELS.switchSelectionPurpose, (event, purpose: unknown) => {
    assertSelectionSender(event);
    if (purpose !== 'recording' && purpose !== 'screenshot') {
      throw new Error('捕获模式无效');
    }
    switchSelectionPurpose(purpose);
  });

  ipcMain.handle(IPC_CHANNELS.getScreenshotEditPlan, (event) => {
    assertScreenshotEditorSender(event);
    if (!screenshotEditPlan || screenshotSession.state !== 'editing') {
      throw new Error('截图编辑任务已失效');
    }
    return screenshotEditPlan;
  });

  ipcMain.handle(IPC_CHANNELS.revealScreenshotEditor, (event, operationId: unknown) => {
    assertScreenshotEditorSender(event);
    if (
      typeof operationId !== 'string' ||
      !canRevealScreenshotEditor(
        screenshotSession.state,
        screenshotEditPlan?.operationId,
        operationId,
      )
    ) {
      throw new Error('截图编辑任务已失效');
    }
    screenshotEditorWindow?.show();
    screenshotEditorWindow?.focus();
  });

  ipcMain.handle(
    IPC_CHANNELS.updateScreenshotSelection,
    (event, operationId: unknown, value: unknown) => {
      assertScreenshotEditorSender(event);
      assertString(operationId, '截图操作 ID');
      return updateScreenshotSelection(operationId, value);
    },
  );

  ipcMain.handle(IPC_CHANNELS.pinScreenshot, (event, operationId: unknown, png: unknown) => {
    assertScreenshotEditorSender(event);
    assertString(operationId, '截图操作 ID');
    const task = screenshotTask;
    if (
      !task?.selection ||
      !screenshotEditPlan ||
      screenshotEditPlan.operationId !== operationId ||
      screenshotSession.state !== 'editing'
    ) {
      throw new Error('截图编辑任务已失效');
    }
    if (!(png instanceof ArrayBuffer)) throw new Error('截图数据格式无效');
    const pngBytes = new Uint8Array(png);
    if (!isValidPng(pngBytes)) throw new Error('截图数据不是有效 PNG');
    const image = nativeImage.createFromBuffer(Buffer.from(pngBytes));
    if (image.isEmpty()) throw new Error('固定图片无法读取');
    createPinnedScreenshotWindow(image, task.display, task.selection);
    screenshotSession.cancelEditing();
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    screenshotEditPlan = undefined;
    setImmediate(destroyScreenshotEditorWindow);
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.saveScreenshot, async (event, operationId: unknown, png: unknown) => {
    assertScreenshotEditorSender(event);
    assertString(operationId, '截图操作 ID');
    if (
      !screenshotEditPlan ||
      screenshotEditPlan.operationId !== operationId ||
      screenshotSession.state !== 'editing'
    ) {
      throw new Error('截图编辑任务已失效');
    }
    if (!(png instanceof ArrayBuffer)) {
      throw new Error('截图数据格式无效');
    }
    try {
      const pngBytes = new Uint8Array(png);
      await persistCompletedScreenshot(pngBytes);
      setImmediate(destroyScreenshotEditorWindow);
      broadcast();
    } catch (error) {
      screenshotSession.fail();
      screenshotTask = undefined;
      screenshotSourcePromise = undefined;
      screenshotDisplayImage = undefined;
      screenshotEditPlan = undefined;
      errorMessage = `无法保存截图：${error instanceof Error ? error.message : '未知错误'}`;
      notify('截图失败', errorMessage);
      setImmediate(destroyScreenshotEditorWindow);
      broadcast();
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.saveScreenshotAs,
    async (event, operationId: unknown, png: unknown) => {
      assertScreenshotEditorSender(event);
      assertString(operationId, '截图操作 ID');
      if (
        !screenshotEditPlan ||
        screenshotEditPlan.operationId !== operationId ||
        screenshotSession.state !== 'editing'
      ) {
        throw new Error('截图编辑任务已失效');
      }
      if (!(png instanceof ArrayBuffer)) throw new Error('截图数据格式无效');
      const targetPath = await chooseScreenshotSavePath();
      if (!targetPath) return { saved: false };
      try {
        await persistCompletedScreenshot(new Uint8Array(png), targetPath);
        setImmediate(destroyScreenshotEditorWindow);
        broadcast();
        return { saved: true };
      } catch (error) {
        errorMessage = `无法保存截图：${error instanceof Error ? error.message : '未知错误'}`;
        notify('截图失败', errorMessage);
        broadcast();
        throw error;
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.startLongScreenshot,
    async (event, operationId: unknown, firstFrame: unknown) => {
      assertScreenshotEditorSender(event);
      assertString(operationId, '截图操作 ID');
      if (!(firstFrame instanceof ArrayBuffer)) throw new Error('长截图首帧格式无效');
      await startLongScreenshot(operationId, new Uint8Array(firstFrame));
    },
  );

  ipcMain.handle(IPC_CHANNELS.finishLongScreenshot, async (event) => {
    assertLongScreenshotControlSender(event);
    await finishLongScreenshot();
  });

  ipcMain.handle(IPC_CHANNELS.cancelLongScreenshot, (event) => {
    assertLongScreenshotControlSender(event);
    cancelLongScreenshot();
  });

  ipcMain.handle(IPC_CHANNELS.cancelScreenshotEdit, (event, operationId: unknown) => {
    assertScreenshotEditorSender(event);
    assertString(operationId, '截图操作 ID');
    if (!screenshotEditPlan || screenshotEditPlan.operationId !== operationId) {
      throw new Error('截图编辑任务已失效');
    }
    screenshotSession.cancelEditing();
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    screenshotEditPlan = undefined;
    setImmediate(destroyScreenshotEditorWindow);
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.updateConfiguredSelection, (event, value: unknown) => {
    assertSelectionSender(event);
    if (!selectionDisplay || !pendingRecording || recorderSession.state !== 'configuring') {
      throw new Error('录制选区调整任务已失效');
    }
    const selection = parseDisplaySelection(selectionDisplay, value).global;
    pendingRecording = { mode: 'region', display: selectionDisplay, selection };
    if (activePlan) activePlan = { ...activePlan, selection };
    recordingSetupWindow?.setBounds(getRecordingSetupBounds(selectionDisplay, selection));
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.startConfiguredRecording, async (event, value: unknown) => {
    assertRecordingSetupSender(event);
    try {
      const configuration = parseRecordingConfiguration(value, process.platform);
      await startConfiguredRecording(configuration);
    } catch (error) {
      if (recorderSession.state === 'configuring') {
        fail(`无法开始录制：${error instanceof Error ? error.message : '未知错误'}`);
      }
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.cancelConfiguredRecording, (event) => {
    assertRecordingConfigurationSender(event);
    cancelConfiguredRecording();
  });

  ipcMain.handle(IPC_CHANNELS.hideSettings, (event) => {
    assertMainSender(event);
    concealMainWindow();
  });

  ipcMain.handle(IPC_CHANNELS.updateShortcuts, async (event, value: unknown) => {
    assertMainSender(event);
    await updateShortcutSettings(value);
  });

  ipcMain.handle(IPC_CHANNELS.setShortcutCaptureActive, (event, value: unknown) => {
    assertMainSender(event);
    if (typeof value !== 'boolean') throw new Error('快捷键录入状态无效');
    if (value) activateShortcutCapture();
    else deactivateShortcutCapture();
  });

  ipcMain.handle(IPC_CHANNELS.requestScreenCapturePermission, async (event) => {
    assertMainSender(event);
    const status = await requestScreenCapturePermissionStatus({
      platform: process.platform,
      getStatus: getScreenCapturePermissionStatus,
      requestPermission: requestNativeScreenCapturePermission,
    });
    if (status === 'granted') errorMessage = undefined;
    broadcast();
    return status;
  });

  ipcMain.handle(IPC_CHANNELS.openScreenCaptureSettings, async (event) => {
    assertMainSender(event);
    if (process.platform !== 'darwin') throw new Error('当前平台无需屏幕录制权限设置');
    await shell.openExternal(MAC_SCREEN_CAPTURE_SETTINGS_URL);
  });

  ipcMain.on(IPC_CHANNELS.restartForScreenCapturePermission, (event) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return;
    app.relaunch();
    app.quit();
  });

  ipcMain.handle(IPC_CHANNELS.chooseRecordingDirectory, async (event) => {
    assertMainSender(event);
    return chooseRecordingDirectory();
  });

  ipcMain.handle(IPC_CHANNELS.setAutoLaunch, (event, value: unknown) => {
    assertMainSender(event);
    if (typeof value !== 'boolean') throw new Error('开机自启动设置无效');
    updateAutoLaunch(value);
  });

  ipcMain.handle(IPC_CHANNELS.setNotificationsEnabled, async (event, value: unknown) => {
    assertMainSender(event);
    if (typeof value !== 'boolean') throw new Error('系统通知设置无效');
    await updateNotificationsEnabled(value);
  });

  ipcMain.handle(IPC_CHANNELS.getWindowTargets, async (event) => {
    if (screenshotEditorWindow && event.sender.id === screenshotEditorWindow.webContents.id) {
      return [];
    }
    if (!selectionWindow || event.sender.id !== selectionWindow.webContents.id) return [];
    if (selectionPurpose !== 'recording' && selectionPurpose !== 'screenshot') return [];
    if (!selectionDisplay) return [];
    const targetsPromise = windowTargetsPromise ?? detectWindowTargets(selectionDisplay);
    windowTargetsPromise = undefined;
    return (await targetsPromise) ?? [];
  });

  ipcMain.on(IPC_CHANNELS.setSelectionGestureActive, (event, value: unknown) => {
    if (!selectionWindow || event.sender.id !== selectionWindow.webContents.id) return;
    if (typeof value !== 'boolean') return;
    selectionGestureActive = value;
  });

  ipcMain.handle(IPC_CHANNELS.getColorPickerFrame, async (event) => {
    assertSelectionSender(event);
    if (selectionPurpose !== 'color-picker' || !selectionDisplay) {
      throw new Error('吸色任务已失效');
    }
    const image = await captureScreenshotImage();
    const pixelSize = image.getSize();
    return {
      imageDataUrl: image.toDataURL(),
      pixelSize,
      displaySize: {
        width: selectionDisplay.bounds.width,
        height: selectionDisplay.bounds.height,
      },
    };
  });

  ipcMain.handle(IPC_CHANNELS.completeColorPicker, (event, value: unknown) => {
    assertSelectionSender(event);
    if (selectionPurpose !== 'color-picker' || !isSupportedColorText(value)) {
      throw new Error('吸色结果无效');
    }
    clipboard.writeText(value);
    screenshotSession.cancelSelection();
    screenshotTask = undefined;
    screenshotSourcePromise = undefined;
    screenshotDisplayImage = undefined;
    const completedWindow = selectionWindow;
    completedWindow?.hide();
    if (completedWindow && !completedWindow.isDestroyed())
      setImmediate(() => completedWindow.destroy());
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.copyColor, (event, value: unknown) => {
    assertScreenshotEditorSender(event);
    if (!isSupportedColorText(value)) throw new Error('吸色结果无效');
    clipboard.writeText(value);
  });

  ipcMain.handle(IPC_CHANNELS.confirmSelection, async (event, value: unknown) => {
    assertSelectionSender(event);
    if (!selectionDisplay) {
      throw new Error('目标显示器不存在');
    }
    const { global: globalSelection } = parseDisplaySelection(selectionDisplay, value);
    stopSelectionDisplayWatcher();
    if (selectionPurpose === 'screenshot') {
      screenshotSession.confirmSelection();
      screenshotTask = { display: selectionDisplay, selection: globalSelection };
      await prepareScreenshotEditor();
      return;
    }
    if (selectionPurpose !== 'recording') {
      throw new Error('选区任务已失效');
    }
    recorderSession.confirmSelection();
    pendingRecording = { mode: 'region', display: selectionDisplay, selection: globalSelection };
    activePlan = createPlan('region', selectionDisplay, globalSelection);
    createRecordingSetupWindow(selectionDisplay, globalSelection);
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.cancelSelection, (event) => {
    assertSelectionSender(event);
    stopSelectionDisplayWatcher();
    if (selectionPurpose === 'screenshot') {
      screenshotSession.cancelSelection();
      screenshotTask = undefined;
      screenshotSourcePromise = undefined;
      screenshotDisplayImage = undefined;
    } else if (selectionPurpose === 'recording') {
      recorderSession.cancelSelection();
      activePlan = undefined;
    } else if (selectionPurpose === 'color-picker') {
      screenshotSession.cancelSelection();
      screenshotTask = undefined;
      screenshotSourcePromise = undefined;
      screenshotDisplayImage = undefined;
    } else {
      throw new Error('选区任务已失效');
    }
    const cancelledSelectionWindow = selectionWindow;
    if (cancelledSelectionWindow && !cancelledSelectionWindow.isDestroyed()) {
      cancelledSelectionWindow.hide();
      setImmediate(() => cancelledSelectionWindow.destroy());
    }
    broadcast();
  });

  ipcMain.handle(IPC_CHANNELS.prepareCapture, async (event, operationId: unknown) => {
    assertRecordingSender(event);
    assertString(operationId, '录制操作 ID');
    if (
      recorderSession.state !== 'countdown' ||
      !activePlan ||
      activePlan.operationId !== operationId
    ) {
      throw new Error('录制操作已失效');
    }
    const delay = Math.max(0, activePlan.countdownEndsAt - Date.now());
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (
      recorderSession.state !== 'countdown' ||
      !activePlan ||
      activePlan.operationId !== operationId
    ) {
      throw new Error('录制操作已失效');
    }
    captureGranted = true;
    return activePlan;
  });

  ipcMain.handle(IPC_CHANNELS.startWriting, async (event, mimeType: unknown) => {
    assertRecordingSender(event);
    assertString(mimeType, 'MIME 类型');
    if (
      !RECORDING_MIME_CANDIDATES.includes(mimeType as (typeof RECORDING_MIME_CANDIDATES)[number])
    ) {
      throw new Error('MIME 类型不在允许列表中');
    }
    try {
      const output = await recorderSession.startRecording(mimeType);
      outputPath = output.outputPath;
      startedAt = Date.now();
      errorMessage = undefined;
      broadcast();
      if (Number.isFinite(TEST_AUTO_STOP_MS) && TEST_AUTO_STOP_MS > 0) {
        setTimeout(() => void requestStop(), TEST_AUTO_STOP_MS);
      }
      return { sessionId: output.sessionId };
    } catch (error) {
      fail(`无法创建录制文件：${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.appendChunk, async (event, sessionId: unknown, chunk: unknown) => {
    assertRecordingSender(event);
    assertString(sessionId, '文件会话 ID');
    if (recorderSession.state !== 'recording' && recorderSession.state !== 'stopping') {
      throw new Error('当前状态不能写入录制数据');
    }
    if (!(chunk instanceof ArrayBuffer)) {
      throw new Error('录制数据格式无效');
    }
    await fileWriter.append(sessionId, new Uint8Array(chunk));
  });

  ipcMain.handle(IPC_CHANNELS.finish, async (event, sessionId: unknown) => {
    assertRecordingSender(event);
    assertString(sessionId, '文件会话 ID');
    if (recorderSession.state !== 'stopping') {
      throw new Error('当前状态不能完成录制');
    }
    try {
      const completedDisplay = activePlan?.display;
      outputPath = await fileWriter.finish(sessionId);
      recorderSession.complete();
      activePlan = undefined;
      startedAt = undefined;
      notify('录屏已保存', outputPath);
      broadcast();
      destroyRecordingWindowSoon();
      destroyIndicatorWindowSoon();
      destroyControlWindowSoon();
      createCompletionWindow(completedDisplay);
    } catch (error) {
      fail(`无法保存录制文件：${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.abort, async (event, sessionId: unknown, message: unknown) => {
    assertRecordingSender(event);
    if (sessionId !== undefined) {
      assertString(sessionId, '文件会话 ID');
    }
    assertString(message, '错误信息', 500);
    await fileWriter.abort(sessionId);
    if (recorderSession.state !== 'error') {
      fail(message);
    }
  });

  ipcMain.handle(IPC_CHANNELS.stop, (event) => {
    if (
      event.sender.id !== mainWindow?.webContents.id &&
      event.sender.id !== recordingWindow?.webContents.id &&
      event.sender.id !== controlWindow?.webContents.id
    ) {
      throw new Error('IPC 调用来源无效');
    }
    return requestStop();
  });

  ipcMain.handle(IPC_CHANNELS.openOutputFolder, (event, kind: unknown) => {
    assertOutputSender(event);
    if (kind !== 'recording' && kind !== 'screenshot') {
      throw new Error('输出类型无效');
    }
    const targetPath = kind === 'recording' ? outputPath : screenshotOutputPath;
    if (!targetPath) {
      throw new Error(kind === 'recording' ? '暂无可打开的录制文件' : '暂无可打开的截图文件');
    }
    shell.showItemInFolder(targetPath);
  });

  ipcMain.handle(IPC_CHANNELS.openOutputFile, async (event, kind: unknown) => {
    assertOutputSender(event);
    if (kind !== 'recording' && kind !== 'screenshot') throw new Error('输出类型无效');
    const targetPath = kind === 'recording' ? outputPath : screenshotOutputPath;
    const completed =
      kind === 'recording'
        ? recorderSession.state === 'completed'
        : screenshotSession.state === 'completed';
    if (!targetPath || !completed) {
      throw new Error(kind === 'recording' ? '暂无可播放的录制文件' : '暂无可打开的截图文件');
    }
    const openError = await shell.openPath(targetPath);
    if (openError)
      throw new Error(`无法打开${kind === 'recording' ? '视频' : '截图'}：${openError}`);
  });

  ipcMain.handle(IPC_CHANNELS.closeCompletion, (event) => {
    if (!completionWindow || event.sender.id !== completionWindow.webContents.id) {
      throw new Error('完成提示 IPC 调用来源无效');
    }
    destroyCompletionWindow();
  });
}

function configureCaptureHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const isExpectedFrame = request.frame?.top === recordingWindow?.webContents.mainFrame;
    if (FORCE_PERMISSION_DENIED) {
      captureGranted = false;
      fail(RECORDING_PERMISSION_DENIED_MESSAGE);
      try {
        callback({});
      } catch {
        // The media request is intentionally rejected after the user-facing error is stored.
      }
      return;
    }
    if (
      !captureGranted ||
      !activePlan ||
      !request.videoRequested ||
      request.audioRequested !== activePlan.options.systemAudio ||
      !isExpectedFrame
    ) {
      captureGranted = false;
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      });
      const source = matchDisplaySource(
        sources.map((item) => ({ source: item, displayId: item.display_id })),
        activePlan.display,
      )?.source;
      captureGranted = false;
      if (!source) {
        callback({});
        fail('找不到目标显示器的捕获源');
        return;
      }
      callback({
        video: source,
        ...(request.audioRequested && process.platform === 'win32'
          ? { audio: 'loopback' as const }
          : {}),
      });
    } catch (error) {
      captureGranted = false;
      callback({});
      fail(`无法读取屏幕捕获源：${error instanceof Error ? error.message : '未知错误'}`);
    }
  });
}

function configureMediaPermissions(): void {
  const isRecorderContents = (webContents: Electron.WebContents | null) =>
    Boolean(webContents && webContents.id === recordingWindow?.webContents.id);
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media' && isRecorderContents(webContents);
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && isRecorderContents(webContents));
  });
}

app.on('window-all-closed', () => {
  // Tray app: keep running until the user explicitly quits.
});

app.on('before-quit', () => {
  isQuitting = true;
  stopSelectionDisplayWatcher();
  clearLongScreenshotCapture();
  destroyLongScreenshotIndicatorWindow();
  destroyLongScreenshotControlWindow();
  globalShortcut.unregisterAll();
  preparedSelectionWindows.destroy();
  void windowTargetQueries.dispose();
});

app.on('activate', () => {
  if (hasSingleInstanceLock) secondInstanceActivation.request();
});

if (hasSingleInstanceLock)
  void app.whenReady().then(async () => {
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
      void dialog.showMessageBox({
        type: 'warning',
        title: '平台提示',
        message: '当前版本支持 Windows 和 macOS。',
      });
    }
    registerIpc();
    Menu.setApplicationMenu(null);
    configureCaptureHandler();
    configureMediaPermissions();
    await loadAppSettings();
    await loadShortcutSettings();
    if (SHOW_LONG_SCREENSHOT_FIXTURE) createLongScreenshotFixtureWindow();
    createMainWindow();
    secondInstanceActivation.flush();
    createTray();
    schedulePreparedSelectionWindow();
    if (!registerShortcutSettings(shortcutSettings)) {
      warningMessage = '全局快捷键注册失败，请在快捷键设置中更换组合键。';
      broadcast();
    }
  });
