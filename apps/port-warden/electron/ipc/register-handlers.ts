import { type BrowserWindow, dialog, type IpcMainInvokeEvent, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../src/shared/contracts';
import type { PortService } from '../services/port-service';
import type { ProjectRegistrationStore } from '../services/project-registration-store';
import { isTrustedRendererUrl } from './trusted-renderer';
import {
  validateOpenTargetRequest,
  validatePid,
  validateStopExecuteRequest,
  validateStopPrepareRequest,
} from './validators';

type HandlerOptions = {
  isDevelopment: boolean;
  productionEntry: string;
  registrations: ProjectRegistrationStore;
};

function assertTrustedSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  options: HandlerOptions,
) {
  if (event.sender.id !== window.webContents.id) throw new Error('拒绝来自未知窗口的 IPC 请求');
  if (!event.senderFrame || event.senderFrame !== event.senderFrame.top) {
    throw new Error('拒绝来自子框架的 IPC 请求');
  }
  if (
    !isTrustedRendererUrl(event.senderFrame.url, options.isDevelopment, options.productionEntry)
  ) {
    throw new Error('拒绝来自未知来源的 IPC 请求');
  }
}

export function registerIpcHandlers(
  window: BrowserWindow,
  service: PortService,
  options: HandlerOptions,
) {
  ipcMain.handle(IPC_CHANNELS.scan, async (event) => {
    assertTrustedSender(event, window, options);
    return await service.scan();
  });
  ipcMain.handle(IPC_CHANNELS.processTree, (event, input: unknown) => {
    assertTrustedSender(event, window, options);
    return service.getProcessTree(validatePid(input));
  });
  ipcMain.handle(IPC_CHANNELS.prepareStop, async (event, input: unknown) => {
    assertTrustedSender(event, window, options);
    const request = validateStopPrepareRequest(input);
    return await service.prepareStop(request.pid, request.scope);
  });
  ipcMain.handle(IPC_CHANNELS.executeStop, async (event, input: unknown) => {
    assertTrustedSender(event, window, options);
    const request = validateStopExecuteRequest(input);
    return await service.executeStop(request.planId, request.confirmedPids);
  });
  ipcMain.handle(IPC_CHANNELS.openTarget, async (event, input: unknown) => {
    assertTrustedSender(event, window, options);
    const request = validateOpenTargetRequest(input);
    const target = service.resolveOpenTarget(request.pid, request.kind);
    const error = await shell.openPath(target);
    if (error) throw new Error(`无法打开目录：${error}`);
  });
  ipcMain.handle(IPC_CHANNELS.registerProject, async (event, input: unknown) => {
    assertTrustedSender(event, window, options);
    const pid = validatePid(input);
    const defaultPath = service.resolveRegistrationDefault(pid);
    const selection = await dialog.showOpenDialog(window, {
      title: '登记项目目录',
      buttonLabel: '登记目录',
      defaultPath,
      properties: ['openDirectory'],
    });
    const projectPath = selection.filePaths[0];
    if (selection.canceled || !projectPath) return { registered: false };
    await options.registrations.add(projectPath);
    service.addRegisteredPath(projectPath);
    return { registered: true, path: projectPath };
  });

  return () => {
    for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
  };
}
