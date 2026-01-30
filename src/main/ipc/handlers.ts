import { ipcMain } from 'electron'
import { chat, listProviders, streamChat } from '../llm'
import { loadConfig, saveConfig, saveApiKey, loadApiKey } from '../config/store'
import { ensureDefaultMcpConfig } from '../mcp'
import { BrowserWindow } from 'electron'
import { loadChat, saveChat } from '../chat/store'

const streamControllers = new Map<string, AbortController>()

export function registerIpcHandlers(): void {
  ipcMain.handle('llm:listProviders', async () => listProviders())

  ipcMain.handle('llm:chat', async (_event, req) => {
    const config = loadConfig()
    const apiKey = loadApiKey(req.provider)
    return chat({
      ...req,
      apiKey,
      baseUrl: config.llm.baseUrl,
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens
    })
  })

  ipcMain.handle('llm:stream:start', async (event, req) => {
    const config = loadConfig()
    const apiKey = loadApiKey(req.provider)
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const controller = new AbortController()
    streamControllers.set(streamId, controller)

    const sender = BrowserWindow.fromWebContents(event.sender)
    if (!sender) throw new Error('No sender window')

    streamChat(
      {
        ...req,
        apiKey,
        baseUrl: config.llm.baseUrl,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens
      },
      {
        onChunk: (content) => sender.webContents.send('llm:stream:chunk', { streamId, content }),
        onDone: () => {
          sender.webContents.send('llm:stream:chunk', { streamId, done: true })
          streamControllers.delete(streamId)
        },
        onError: (error) => {
          sender.webContents.send('llm:stream:chunk', { streamId, error: error.message })
          streamControllers.delete(streamId)
        }
      },
      controller.signal
    ).catch((err) => {
      if (err?.name === 'AbortError') {
        sender.webContents.send('llm:stream:chunk', { streamId, done: true })
        streamControllers.delete(streamId)
        return
      }
      sender.webContents.send('llm:stream:chunk', { streamId, error: err?.message ?? 'Stream failed' })
      streamControllers.delete(streamId)
    })

    return streamId
  })

  ipcMain.handle('llm:stream:stop', async (_event, streamId: string) => {
    const controller = streamControllers.get(streamId)
    if (controller) controller.abort()
    streamControllers.delete(streamId)
    return true
  })

  ipcMain.handle('config:load', async () => {
    const config = loadConfig()
    if (!config.mcp.configPath) {
      config.mcp.configPath = ensureDefaultMcpConfig()
      saveConfig(config)
    }
    return config
  })

  ipcMain.handle('config:save', async (_event, config) => {
    saveConfig(config)
    return true
  })

  ipcMain.handle('keys:save', async (_event, provider, apiKey) => {
    saveApiKey(provider, apiKey)
    return true
  })

  ipcMain.handle('keys:load', async (_event, provider) => {
    return loadApiKey(provider)
  })

  ipcMain.handle('chat:load', async () => {
    return loadChat()
  })

  ipcMain.handle('chat:save', async (_event, messages) => {
    saveChat(messages)
    return true
  })
}
