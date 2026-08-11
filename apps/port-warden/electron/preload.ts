import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type PortWardenApi } from '../src/shared/contracts';

const api: PortWardenApi = {
  scan: () => ipcRenderer.invoke(IPC_CHANNELS.scan),
  getProcessTree: (pid) => ipcRenderer.invoke(IPC_CHANNELS.processTree, pid),
  prepareStop: (request) => ipcRenderer.invoke(IPC_CHANNELS.prepareStop, request),
  executeStop: (request) => ipcRenderer.invoke(IPC_CHANNELS.executeStop, request),
  openTarget: (request) => ipcRenderer.invoke(IPC_CHANNELS.openTarget, request),
  registerProject: (pid) => ipcRenderer.invoke(IPC_CHANNELS.registerProject, pid),
};

contextBridge.exposeInMainWorld('portWarden', api);
