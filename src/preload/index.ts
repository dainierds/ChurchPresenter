import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-events'
import {
  ChurchPresenterApi,
  DisplayInfo,
  GlobalControls,
  PresenterState,
  RoleAssignment,
  TestSlide
} from '../shared/types'

const api: ChurchPresenterApi = {
  // Screen management
  getDisplays: (): Promise<DisplayInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_GET)
  },

  getRoleAssignments: (): Promise<RoleAssignment> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_GET_ASSIGNMENTS)
  },

  assignRole: (role: string, displayId: number | null): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_ASSIGN_ROLE, role, displayId)
  },

  identifyDisplays: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_IDENTIFY)
  },

  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, displays: DisplayInfo[]) => {
      callback(displays)
    }
    ipcRenderer.on(IPC_CHANNELS.DISPLAYS_CHANGED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DISPLAYS_CHANGED, subscription)
    }
  },

  // State management
  getState: (): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_GET)
  },

  setGlobalControl: (control: keyof GlobalControls, value: boolean): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SET_CONTROL, control, value)
  },

  toggleGlobalControl: (control: keyof GlobalControls): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_TOGGLE_CONTROL, control)
  },

  sendSlide: (slide: TestSlide, targetRoles?: string[]): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SEND_SLIDE, slide, targetRoles)
  },

  setStressTestMode: (enabled: boolean): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SET_STRESS_TEST, enabled)
  },

  onStateUpdated: (callback: (state: PresenterState) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, state: PresenterState) => {
      callback(state)
    }
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, subscription)
    }
  },

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number): void => {
    ipcRenderer.send(IPC_CHANNELS.LOG_FPS_DROP, role, fps, displayId)
  },

  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION)
  }
}

try {
  contextBridge.exposeInMainWorld('churchPresenterApi', api)
} catch (error) {
  console.error('Failed to expose churchPresenterApi in preload:', error)
}
