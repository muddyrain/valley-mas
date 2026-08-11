import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/register-handlers';
import { isTrustedRendererUrl } from './ipc/trusted-renderer';
import { createPlatformAdapter } from './platform/create-adapter';
import { PortService } from './services/port-service';
import { ProjectRegistrationStore } from './services/project-registration-store';

const directory = __dirname;
const isDevelopment = !app.isPackaged;
const productionEntry = path.resolve(directory, '../dist/index.html');
let mainWindow: BrowserWindow | undefined;
let removeHandlers: (() => void) | undefined;

function createWindow(registrations: ProjectRegistrationStore, registeredPaths: string[]) {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Port Warden',
    icon: path.resolve(directory, '../assets/port-warden-logo.png'),
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = isTrustedRendererUrl(url, isDevelopment, productionEntry);
    if (!allowed) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());

  const service = new PortService(createPlatformAdapter(), { registeredPaths });
  removeHandlers?.();
  removeHandlers = registerIpcHandlers(window, service, {
    isDevelopment,
    productionEntry,
    registrations,
  });

  if (isDevelopment) void window.loadURL('http://127.0.0.1:5182');
  else void window.loadFile(productionEntry);

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  return window;
}

const lockAcquired = app.requestSingleInstanceLock();
if (!lockAcquired) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    const registrations = new ProjectRegistrationStore(
      path.join(app.getPath('userData'), 'registered-projects.json'),
    );
    const registeredPaths = await registrations.load();
    mainWindow = createWindow(registrations, registeredPaths);
    app.on('activate', () => {
      if (!mainWindow) mainWindow = createWindow(registrations, registeredPaths);
    });
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => removeHandlers?.());
}
