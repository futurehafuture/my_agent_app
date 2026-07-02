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

export interface AgentRunResult {
  task_id: string
  summary: string
  task_type: string
  workspace?: Record<string, unknown>
  events: TaskEvent[]
  artifacts: Record<string, string>
  approvals: ApprovalItem[]
  diff?: string
  error?: string | null
}

declare global {
  interface Window {
    agentApp?: {
      selectDirectory: () => Promise<string | null>
    }
  }
}
