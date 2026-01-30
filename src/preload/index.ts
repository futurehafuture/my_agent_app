import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  llm: {
    listProviders: () => ipcRenderer.invoke('llm:listProviders'),
    chat: (req: any) => ipcRenderer.invoke('llm:chat', req),
    startStream: (req: any) => ipcRenderer.invoke('llm:stream:start', req),
    stopStream: (streamId: string) => ipcRenderer.invoke('llm:stream:stop', streamId),
    onStreamChunk: (cb: (payload: { streamId: string; content?: string; done?: boolean; error?: string }) => void) => {
      const handler = (_event: unknown, payload: any) => cb(payload)
      ipcRenderer.on('llm:stream:chunk', handler)
      return () => ipcRenderer.removeListener('llm:stream:chunk', handler)
    }
  },
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config: any) => ipcRenderer.invoke('config:save', config)
  },
  keys: {
    save: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('keys:save', provider, apiKey),
    load: (provider: string) => ipcRenderer.invoke('keys:load', provider)
  },
  chat: {
    load: () => ipcRenderer.invoke('chat:load'),
    save: (messages: any[]) => ipcRenderer.invoke('chat:save', messages)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
