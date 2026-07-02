import { contextBridge, ipcRenderer } from 'electron'

const api = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-directory')
}

contextBridge.exposeInMainWorld('agentApp', api)

export type AgentAppApi = typeof api
