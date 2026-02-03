import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Client } from '@modelcontextprotocol/sdk/client'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const defaultWorkspace = join(app.getPath('documents'), 'AgentWorkspace')

const localGoogleSearchRoot = '/Users/bruis/lzj/google-search'
const localGoogleSearchBin = join(localGoogleSearchRoot, 'bin', 'google-search-mcp')
const localGoogleSearchDist = join(localGoogleSearchRoot, 'dist', 'src', 'mcp-server.js')

const resolveGoogleSearchServer = () => {
  if (existsSync(localGoogleSearchBin) && existsSync(localGoogleSearchDist)) {
    return {
      command: localGoogleSearchBin,
      args: [],
      env: {},
      cwd: localGoogleSearchRoot
    }
  }
  return {
    command: 'npx',
    args: ['google-search-mcp'],
    env: {}
  }
}

const defaultMcpConfig = {
  servers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', defaultWorkspace],
      env: {}
    },
    'google-search': resolveGoogleSearchServer()
  }
}

type McpServerConfig = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  disabled?: boolean
}

type McpConfig = {
  servers: Record<string, McpServerConfig>
}

type McpServerState = {
  id: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  transport: 'stdio' | 'streamable_http'
  config: McpServerConfig
  error?: string
  client?: Client
}

class McpManager {
  private servers = new Map<string, McpServerState>()
  private configPath: string | null = null

  async load(configPath: string): Promise<void> {
    this.configPath = configPath
    await this.reload()
  }

  async reload(): Promise<void> {
    if (!this.configPath) return
    const cfg = readMcpConfig(this.configPath)
    await this.stopAll()
    const entries = Object.entries(cfg.servers ?? {})
    for (const [id, config] of entries) {
      if (config.disabled) {
        this.servers.set(id, {
          id,
          status: 'disconnected',
          transport: config.url ? 'streamable_http' : 'stdio',
          config
        })
        continue
      }
      await this.connectServer(id, config)
    }
  }

  async stopAll(): Promise<void> {
    const states = Array.from(this.servers.values())
    this.servers.clear()
    await Promise.all(
      states.map(async (s) => {
        try {
          await s.client?.close()
        } catch {
          // ignore
        }
      })
    )
  }

  async connectServer(id: string, config: McpServerConfig): Promise<void> {
    const transport = config.url ? 'streamable_http' : 'stdio'
    const state: McpServerState = { id, status: 'connecting', transport, config }
    this.servers.set(id, state)
    try {
      const client = new Client({ name: 'agent-desktop', version: '1.0.0' }, { capabilities: {} })
      if (transport === 'streamable_http') {
        const url = new URL(String(config.url))
        const requestInit = config.headers ? { headers: config.headers } : undefined
        const t = new StreamableHTTPClientTransport(url, { requestInit })
        await client.connect(t)
      } else {
        if (!config.command) {
          throw new Error('Missing command for stdio MCP server')
        }
        const t = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env ?? {},
          cwd: config.cwd,
          stderr: 'pipe'
        })
        await client.connect(t)
      }
      state.client = client
      state.status = 'connected'
      state.error = undefined
    } catch (err: any) {
      state.status = 'error'
      state.error = err?.message ?? String(err)
    }
  }

  listServers(): McpServerState[] {
    return Array.from(this.servers.values()).map((s) => ({
      id: s.id,
      status: s.status,
      transport: s.transport,
      config: s.config,
      error: s.error
    }))
  }

  async listTools(): Promise<{ id: string; serverId: string; name: string; description?: string; inputSchema?: any }[]> {
    const results: { id: string; serverId: string; name: string; description?: string; inputSchema?: any }[] = []
    for (const s of this.servers.values()) {
      if (s.status !== 'connected' || !s.client) continue
      try {
        const res = await s.client.listTools()
        for (const t of res.tools ?? []) {
          results.push({
            id: `${s.id}:${t.name}`,
            serverId: s.id,
            name: t.name,
            description: t.description,
            inputSchema: (t as any).inputSchema
          })
        }
      } catch {
        // ignore
      }
    }
    return results
  }

  async callTool(serverId: string, name: string, args: any): Promise<any> {
    const s = this.servers.get(serverId)
    if (!s || !s.client || s.status !== 'connected') {
      throw new Error(`MCP server not connected: ${serverId}`)
    }
    return s.client.callTool({ name, arguments: args }, undefined, { timeout: 120000, maxTotalTimeout: 120000 })
  }

  async listResources(): Promise<{ serverId: string; uri: string; name?: string; description?: string }[]> {
    const results: { serverId: string; uri: string; name?: string; description?: string }[] = []
    for (const s of this.servers.values()) {
      if (s.status !== 'connected' || !s.client) continue
      try {
        const res = await s.client.listResources()
        for (const r of res.resources ?? []) {
          results.push({ serverId: s.id, uri: r.uri, name: r.name, description: r.description })
        }
      } catch {
        // ignore
      }
    }
    return results
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const s = this.servers.get(serverId)
    if (!s || !s.client || s.status !== 'connected') {
      throw new Error(`MCP server not connected: ${serverId}`)
    }
    return s.client.readResource({ uri })
  }

  async listPrompts(): Promise<{ serverId: string; name: string; description?: string }[]> {
    const results: { serverId: string; name: string; description?: string }[] = []
    for (const s of this.servers.values()) {
      if (s.status !== 'connected' || !s.client) continue
      try {
        const res = await s.client.listPrompts()
        for (const p of res.prompts ?? []) {
          results.push({ serverId: s.id, name: p.name, description: p.description })
        }
      } catch {
        // ignore
      }
    }
    return results
  }

  async getPrompt(serverId: string, name: string, args?: Record<string, string>): Promise<any> {
    const s = this.servers.get(serverId)
    if (!s || !s.client || s.status !== 'connected') {
      throw new Error(`MCP server not connected: ${serverId}`)
    }
    return s.client.getPrompt({ name, arguments: args })
  }
}

let manager: McpManager | null = null

function getManager(): McpManager {
  if (!manager) manager = new McpManager()
  return manager
}

export function ensureDefaultMcpConfig(): string {
  const dir = join(app.getPath('userData'), 'mcp')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(defaultWorkspace)) mkdirSync(defaultWorkspace, { recursive: true })
  const file = join(dir, 'mcp.json')
  if (!existsSync(file)) {
    writeFileSync(file, JSON.stringify(defaultMcpConfig, null, 2))
  }
  return file
}

function readMcpConfig(path: string): McpConfig {
  if (!existsSync(path)) {
    return { servers: {} }
  }
  try {
    const raw = readFileSync(path, 'utf-8')
    const cfg = JSON.parse(raw) as McpConfig
    const normalized = normalizeMcpConfig(cfg)
    if (normalized.changed) {
      writeFileSync(path, JSON.stringify(normalized.config, null, 2))
    }
    return normalized.config
  } catch {
    return { servers: {} }
  }
}

function normalizeMcpConfig(cfg: McpConfig): { config: McpConfig; changed: boolean } {
  let changed = false
  const servers = { ...(cfg.servers ?? {}) }
  const fsServer = servers.filesystem
  if (fsServer) {
    const args = Array.isArray(fsServer.args) ? fsServer.args : []
    if (fsServer.command === 'node' && args[0] === 'mcp-filesystem') {
      servers.filesystem = {
        ...fsServer,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', defaultWorkspace]
      }
      changed = true
    }
    if (fsServer.command === 'npx' && args[0] === 'mcp-filesystem') {
      servers.filesystem = {
        ...fsServer,
        args: ['-y', '@modelcontextprotocol/server-filesystem', defaultWorkspace]
      }
      changed = true
    }
  }
  const googleServer = servers['google-search']
  if (googleServer) {
    const args = Array.isArray(googleServer.args) ? googleServer.args : []
    if (googleServer.command === 'npx' && args[0] === 'google-search-mcp') {
      const resolved = resolveGoogleSearchServer()
      if (resolved.command !== googleServer.command || (resolved.args?.[0] ?? '') !== args[0]) {
        servers['google-search'] = { ...googleServer, ...resolved }
        changed = true
      }
    }
  }
  return { config: { servers }, changed }
}

export function readMcpConfigFile(path: string): McpConfig {
  return readMcpConfig(path)
}

export function writeMcpConfigFile(path: string, config: McpConfig): void {
  writeFileSync(path, JSON.stringify(config, null, 2))
}

export async function startMcp(configPath: string): Promise<void> {
  await getManager().load(configPath)
}

export async function stopMcp(): Promise<void> {
  await getManager().stopAll()
}

export async function reloadMcp(): Promise<void> {
  await getManager().reload()
}

export function listMcpServers() {
  return getManager().listServers()
}

export async function listMcpTools() {
  return getManager().listTools()
}

export async function callMcpTool(serverId: string, name: string, args: any) {
  return getManager().callTool(serverId, name, args)
}

export async function listMcpResources() {
  return getManager().listResources()
}

export async function readMcpResource(serverId: string, uri: string) {
  return getManager().readResource(serverId, uri)
}

export async function listMcpPrompts() {
  return getManager().listPrompts()
}

export async function getMcpPrompt(serverId: string, name: string, args?: Record<string, string>) {
  return getManager().getPrompt(serverId, name, args)
}
