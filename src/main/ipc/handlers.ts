import { ipcMain } from 'electron'
import { ProxyAgent } from 'undici'
import { chat, listProviders, streamChat } from '../llm'
import { loadConfig, saveConfig, saveApiKey, loadApiKey } from '../config/store'
import {
  ensureDefaultMcpConfig,
  startMcp,
  stopMcp,
  reloadMcp,
  readMcpConfigFile,
  writeMcpConfigFile,
  listMcpServers,
  listMcpTools,
  callMcpTool,
  listMcpResources,
  readMcpResource,
  listMcpPrompts,
  getMcpPrompt
} from '../mcp'
import { BrowserWindow } from 'electron'
import { loadChat, saveChat } from '../chat/store'

const streamControllers = new Map<string, AbortController>()

export function registerIpcHandlers(): void {
  ipcMain.handle('llm:listProviders', async () => listProviders())

  ipcMain.handle('llm:listModels', async (_event, req) => {
    const config = loadConfig()
    const provider = req?.provider ?? config.llm.provider
    const apiKey = loadApiKey(provider)
    const baseUrl = (req?.baseUrl ?? config.llm.baseUrl ?? '').replace(/\/$/, '')

    const isKimi = provider === 'kimi'

    const fetchFromApi = async () => {
      if (!apiKey) throw new Error('Missing API key for model listing')
      if (!baseUrl) throw new Error('Missing base URL for model listing')

      const url = `${baseUrl}/models`
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`List models error ${res.status}: ${text}`)
      }

      const data = await res.json()
      const raw = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
          ? data.models
          : Array.isArray(data)
            ? data
            : []

      const ids = raw
        .map((m: any) => (typeof m === 'string' ? m : m?.id ?? m?.model ?? m?.name))
        .filter(Boolean)

      return Array.from(new Set(ids))
    }

    const fetchKimiFromDoc = async () => {
      const url =
        'https://platform.moonshot.cn/docs/pricing/chat#%E7%94%9F%E6%88%90%E6%A8%A1%E5%9E%8B-kimi-k2'
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Kimi doc error ${res.status}: ${text}`)
      }
      const html = await res.text()
      const decode = (input: string) =>
        input
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")

      const candidates = new Set<string>()
      for (const match of html.matchAll(/<code[^>]*>([^<]+)<\/code>/g)) {
        const text = decode(match[1]).trim()
        if (!text) continue
        if (/kimi|moonshot|k2/i.test(text)) candidates.add(text)
      }
      for (const match of html.matchAll(/\b(kimi-[a-z0-9._-]+)\b/gi)) {
        candidates.add(match[1])
      }
      for (const match of html.matchAll(/\b(moonshot-[a-z0-9._-]+)\b/gi)) {
        candidates.add(match[1])
      }
      return Array.from(candidates)
    }

    try {
      const ids = await fetchFromApi()
      if (ids.length) return ids
    } catch (err: any) {
      if (!isKimi) throw err
      const message = String(err?.message ?? '')
      const authFail =
        message.includes('401') ||
        message.includes('invalid_authentication') ||
        message.includes('Invalid Authentication')
      if (!authFail) throw err
    }

    if (isKimi) {
      const ids = await fetchKimiFromDoc()
      if (ids.length) return ids
    }

    throw new Error('模型列表获取失败')
  })

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
    if (config.mcp.enabled) {
      await startMcp(config.mcp.configPath)
    }
    return config
  })

  ipcMain.handle('config:save', async (_event, config) => {
    saveConfig(config)
    if (config?.mcp?.enabled && config?.mcp?.configPath) {
      await startMcp(config.mcp.configPath)
    } else {
      await stopMcp()
    }
    return true
  })

  ipcMain.handle('mcp:reload', async () => {
    await reloadMcp()
    return true
  })

  ipcMain.handle('mcp:config:get', async () => {
    const config = loadConfig()
    const path = config.mcp.configPath || ensureDefaultMcpConfig()
    return readMcpConfigFile(path)
  })

  ipcMain.handle('mcp:config:save', async (_event, cfg) => {
    const config = loadConfig()
    const path = config.mcp.configPath || ensureDefaultMcpConfig()
    writeMcpConfigFile(path, cfg)
    await reloadMcp()
    return true
  })

  ipcMain.handle('mcp:servers', async () => {
    return listMcpServers()
  })

  ipcMain.handle('mcp:tools', async () => {
    return listMcpTools()
  })

  ipcMain.handle('mcp:tool:call', async (_event, serverId: string, name: string, args: any) => {
    return callMcpTool(serverId, name, args)
  })

  ipcMain.handle('mcp:resources', async () => {
    return listMcpResources()
  })

  ipcMain.handle('mcp:resource:read', async (_event, serverId: string, uri: string) => {
    return readMcpResource(serverId, uri)
  })

  ipcMain.handle('mcp:prompts', async () => {
    return listMcpPrompts()
  })

  ipcMain.handle('mcp:prompt:get', async (_event, serverId: string, name: string, args?: Record<string, string>) => {
    return getMcpPrompt(serverId, name, args)
  })

  ipcMain.handle('search:query', async (_event, q: string) => {
    const config = loadConfig()
    const provider = config.webSearch.provider
    const query = String(q || '').trim()
    if (!query) return []
    const proxyUrl = config.webSearch.proxyUrl?.trim()
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

    if (provider === 'google-cse') {
      const apiKey = config.webSearch.googleApiKey
      const cx = config.webSearch.googleCx
      if (!apiKey || !cx) {
        throw new Error('Missing Google CSE apiKey/cx')
      }
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('cx', cx)
      url.searchParams.set('q', query)
      const res = await fetch(url.toString(), { dispatcher })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Google CSE error ${res.status}: ${text}`)
      }
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      return items.map((i: any) => ({
        title: i?.title ?? '',
        link: i?.link ?? '',
        snippet: i?.snippet ?? ''
      }))
    }

    if (provider === 'serpapi') {
      const apiKey = config.webSearch.serpApiKey
      if (!apiKey) throw new Error('Missing SerpAPI apiKey')
      const url = new URL('https://serpapi.com/search.json')
      url.searchParams.set('engine', 'google')
      url.searchParams.set('q', query)
      url.searchParams.set('api_key', apiKey)
      const res = await fetch(url.toString(), { dispatcher })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`SerpAPI error ${res.status}: ${text}`)
      }
      const data = await res.json()
      const items = Array.isArray(data?.organic_results) ? data.organic_results : []
      return items.map((i: any) => ({
        title: i?.title ?? '',
        link: i?.link ?? i?.displayed_link ?? '',
        snippet: i?.snippet ?? ''
      }))
    }

    throw new Error(`Unknown search provider: ${provider}`)
  })

  ipcMain.handle('keys:save', async (_event, provider, apiKey) => {
    saveApiKey(provider, apiKey)
    return true
  })

  ipcMain.handle('app:log', async (_event, payload) => {
    try {
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload)
      // eslint-disable-next-line no-console
      console.log(msg)
    } catch {
      // eslint-disable-next-line no-console
      console.log(payload)
    }
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
