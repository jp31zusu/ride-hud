import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { OverlayApi } from '../shared/bluetooth'

function on<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: OverlayApi = {
  bluetooth: {
    start: (targets, manual) => ipcRenderer.invoke('bt:start', targets, manual),
    end: () => ipcRenderer.invoke('bt:end'),
    setTargets: (targets) => ipcRenderer.invoke('bt:set-targets', targets),
    choose: (action) => ipcRenderer.invoke('bt:choose', action),
    takeChosen: () => ipcRenderer.invoke('bt:take-chosen'),
    onCandidates: (cb) => on('bt:candidates', cb)
  },
  window: {
    resize: (width, height) => ipcRenderer.send('win:resize', width, height),
    setClickThrough: (enabled) => ipcRenderer.send('win:click-through', enabled),
    onClickThrough: (cb) => on('win:click-through', cb),
    onOpenSettings: (cb) => on('win:open-settings', cb),
    quit: () => ipcRenderer.send('app:quit')
  }
}

contextBridge.exposeInMainWorld('api', api)
