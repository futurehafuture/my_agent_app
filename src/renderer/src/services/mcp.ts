export type McpServerStatus = {
  id: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  transport: 'stdio' | 'streamable_http'
  config: any
  error?: string
}

export async function reloadMcp() {
  if (!window.api?.mcp?.reload) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.reload()
}

export async function getMcpConfig() {
  if (!window.api?.mcp?.getConfig) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.getConfig()
}

export async function saveMcpConfig(cfg: any) {
  if (!window.api?.mcp?.saveConfig) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.saveConfig(cfg)
}

export async function listMcpServers(): Promise<McpServerStatus[]> {
  if (!window.api?.mcp?.servers) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.servers()
}

export async function listMcpTools() {
  if (!window.api?.mcp?.tools) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.tools()
}

export async function callMcpTool(serverId: string, name: string, args: any) {
  if (!window.api?.mcp?.callTool) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.callTool(serverId, name, args)
}

export async function listMcpResources() {
  if (!window.api?.mcp?.resources) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.resources()
}

export async function readMcpResource(serverId: string, uri: string) {
  if (!window.api?.mcp?.readResource) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.readResource(serverId, uri)
}

export async function listMcpPrompts() {
  if (!window.api?.mcp?.prompts) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.prompts()
}

export async function getMcpPrompt(serverId: string, name: string, args?: Record<string, string>) {
  if (!window.api?.mcp?.getPrompt) {
    throw new Error('MCP 模块未就绪，请重启应用')
  }
  return window.api.mcp.getPrompt(serverId, name, args)
}
