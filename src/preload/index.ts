import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  llm: {
    listProviders: () => ipcRenderer.invoke('llm:listProviders'),
    listModels: (req: any) => ipcRenderer.invoke('llm:listModels', req),
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
  search: {
    query: (q: string) => ipcRenderer.invoke('search:query', q)
  },
  keys: {
    save: (provider: string, apiKey: string) =>
      ipcRenderer.invoke('keys:save', provider, apiKey),
    load: (provider: string) => ipcRenderer.invoke('keys:load', provider)
  },
  mcp: {
    reload: () => ipcRenderer.invoke('mcp:reload'),
    getConfig: () => ipcRenderer.invoke('mcp:config:get'),
    saveConfig: (cfg: any) => ipcRenderer.invoke('mcp:config:save', cfg),
    servers: () => ipcRenderer.invoke('mcp:servers'),
    tools: () => ipcRenderer.invoke('mcp:tools'),
    callTool: (serverId: string, name: string, args: any) => ipcRenderer.invoke('mcp:tool:call', serverId, name, args),
    resources: () => ipcRenderer.invoke('mcp:resources'),
    readResource: (serverId: string, uri: string) => ipcRenderer.invoke('mcp:resource:read', serverId, uri),
    prompts: () => ipcRenderer.invoke('mcp:prompts'),
    getPrompt: (serverId: string, name: string, args?: Record<string, string>) =>
      ipcRenderer.invoke('mcp:prompt:get', serverId, name, args)
  },
  chat: {
    load: () => ipcRenderer.invoke('chat:load'),
    save: (messages: any[]) => ipcRenderer.invoke('chat:save', messages)
  },
  app: {
    ready: () => ipcRenderer.send('app:ready'),
    log: (payload: any) => ipcRenderer.invoke('app:log', payload)
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
