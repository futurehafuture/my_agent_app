import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const defaultMcpConfig = {
  servers: {
    filesystem: {
      command: 'node',
      args: ['mcp-filesystem'],
      env: {}
    }
  }
}

export function ensureDefaultMcpConfig(): string {
  const dir = join(app.getPath('userData'), 'mcp')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, 'mcp.json')
  if (!existsSync(file)) {
    writeFileSync(file, JSON.stringify(defaultMcpConfig, null, 2))
  }
  return file
}

export function startMcp(): void {
  // TODO: 启动内置 MCP server/代理
}

export function stopMcp(): void {
  // TODO: 停止 MCP server/代理
}
