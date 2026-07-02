import type { AgentCapability, TaskEvent } from '../types'

export const capabilities: AgentCapability[] = [
  {
    id: 'code',
    title: 'Code Agent',
    agent: 'code',
    tagline: 'Sandboxed code changes',
    description: 'Clone or copy a project into a workspace, inspect code, patch files, run checks, and show a diff before applying.',
    command: 'Fix a bug, refactor a feature, or build a UI inside a project sandbox.',
    accent: 'violet',
    needsSandbox: true,
    risk: 'needs-approval',
    tools: ['SandboxAgent', 'Shell', 'Diff', 'Patch', 'Git']
  },
  {
    id: 'data',
    title: 'Data Lab',
    agent: 'data',
    tagline: 'Tables, charts, reports',
    description: 'Analyze CSV and Excel files in a Python workspace, create charts, export cleaned data, and explain insights.',
    command: 'Analyze uploaded data and generate a report with charts.',
    accent: 'cyan',
    needsSandbox: true,
    risk: 'safe',
    tools: ['Python', 'Pandas', 'Charts', 'Artifacts']
  },
  {
    id: 'file',
    title: 'Computer Files',
    agent: 'file',
    tagline: 'Approved local access',
    description: 'Search, preview, organize, and rename files only inside folders the user explicitly authorizes.',
    command: 'Organize my Downloads folder, but ask before moving anything.',
    accent: 'amber',
    needsSandbox: false,
    risk: 'needs-approval',
    tools: ['Finder', 'Plan first', 'Move', 'Rename']
  },
  {
    id: 'research',
    title: 'Research Agent',
    agent: 'research',
    tagline: 'Search with citations',
    description: 'Gather sources, compare claims, produce cited summaries, and save findings into reusable notes.',
    command: 'Research the best desktop agent UX patterns and summarize them.',
    accent: 'blue',
    needsSandbox: false,
    risk: 'safe',
    tools: ['Search', 'Reader', 'Citations', 'Notes']
  },
  {
    id: 'ppt',
    title: 'Deck Builder',
    agent: 'ppt',
    tagline: 'Slides and documents',
    description: 'Convert research, files, and data outputs into structured presentations and exportable artifacts.',
    command: 'Turn this analysis into a 10-slide investor deck.',
    accent: 'pink',
    needsSandbox: true,
    risk: 'safe',
    tools: ['Outline', 'Slides', 'Assets', 'Export']
  },
  {
    id: 'mcp',
    title: 'MCP Hub',
    agent: 'mcp',
    tagline: 'External tool servers',
    description: 'Connect GitHub, Figma, databases, browsers, filesystems, and custom MCP servers with permission boundaries.',
    command: 'Connect tools, review scopes, and expose approved actions to agents.',
    accent: 'green',
    needsSandbox: false,
    risk: 'needs-approval',
    tools: ['Servers', 'Scopes', 'Secrets', 'Audit']
  }
]

export const taskEvents: TaskEvent[] = [
  { id: '1', title: 'Ready', detail: 'Choose a capability, authorize a folder, then run a task.', state: 'pending', meta: 'idle' },
  { id: '2', title: 'Plan', detail: 'The backend will classify the task and choose a specialist agent.', state: 'pending', meta: 'router' },
  { id: '3', title: 'Workspace', detail: 'Code and data tasks run inside a copied workspace.', state: 'pending', meta: 'sandbox' },
  { id: '4', title: 'Review', detail: 'Risky actions require approval before touching real files.', state: 'pending', meta: 'human gate' }
]
