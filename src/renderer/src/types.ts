export type AgentKind = 'router' | 'code' | 'data' | 'file' | 'research' | 'ppt' | 'chat' | 'mcp'

export type RiskLevel = 'safe' | 'needs-approval' | 'dangerous'

export interface AgentCapability {
  id: string
  title: string
  agent: AgentKind
  tagline: string
  description: string
  command: string
  accent: string
  needsSandbox: boolean
  risk: RiskLevel
  tools: string[]
}

export interface TaskEvent {
  id: string
  title: string
  detail: string
  state: 'pending' | 'running' | 'done' | 'blocked'
  meta: string
}

export interface ApprovalItem {
  id: string
  title: string
  reason: string
  risk: RiskLevel
}

declare global {
  interface Window {
    agentApp?: {
      selectDirectory: () => Promise<string | null>
    }
  }
}
