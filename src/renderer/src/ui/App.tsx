import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  FileCode2,
  FolderOpen,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Play,
  Presentation,
  RadioTower,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WandSparkles,
  Workflow,
  XCircle
} from 'lucide-react'
import { capabilities, taskEvents } from '../data/capabilities'
import type { AgentCapability, AgentRunResult, ApprovalItem, TaskEvent } from '../types'

interface LlmSettings {
  provider: string
  agent_model: string
  openai_api_key: string
  deepseek_api_key: string
  deepseek_base_url: string
  deepseek_model: string
  save_traces: boolean
}

const iconMap = {
  code: FileCode2,
  data: Database,
  file: FolderOpen,
  ppt: Presentation,
  research: Globe2,
  router: Layers3,
  chat: Bot,
  mcp: ServerCog
}

const defaultApprovals: ApprovalItem[] = [
  { id: 'terminal', title: 'Run terminal command', reason: 'Terminal commands can modify dependencies or generate files. Commands are shown before execution.', risk: 'needs-approval' },
  { id: 'apply-diff', title: 'Apply sandbox diff', reason: 'Real project files are changed only after review.', risk: 'dangerous' }
]

const backendUrl = 'http://127.0.0.1:8765'
const defaultSettings: LlmSettings = {
  provider: 'openai',
  agent_model: 'gpt-4.1-mini',
  openai_api_key: '',
  deepseek_api_key: '',
  deepseek_base_url: 'https://api.deepseek.com',
  deepseek_model: 'deepseek/deepseek-chat',
  save_traces: true
}

function normalizeApprovals(items?: ApprovalItem[]): ApprovalItem[] {
  return items && items.length > 0 ? items : defaultApprovals
}

export function App(): JSX.Element {
  const [selected, setSelected] = useState<AgentCapability>(capabilities[0])
  const [projectPath, setProjectPath] = useState<string>('Choose a project or data folder')
  const [prompt, setPrompt] = useState('改造这个项目：做一个通用 Agent App，能写代码、分析数据、管理授权文件，并且所有危险操作需要确认。')
  const [runResult, setRunResult] = useState<AgentRunResult | null>(null)
  const [events, setEvents] = useState<TaskEvent[]>(taskEvents)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<string>('')
  const [settings, setSettings] = useState<LlmSettings>(defaultSettings)
  const [settingsStatus, setSettingsStatus] = useState<string>('')
  const [traces, setTraces] = useState<Array<Record<string, string>>>([])

  const SelectedIcon = useMemo(() => iconMap[selected.agent] ?? Bot, [selected])
  const approvals = normalizeApprovals(runResult?.approvals)
  const artifactText = runResult?.diff || Object.entries(runResult?.artifacts ?? {}).map(([key, value]) => `${key}\n${value}`).join('\n\n') || 'Artifacts and diffs will appear here after a run.'

  useEffect(() => {
    void loadSettings()
    void loadTraces()
  }, [])

  async function loadSettings(): Promise<void> {
    try {
      const response = await fetch(`${backendUrl}/settings/llm`)
      if (response.ok) setSettings({ ...defaultSettings, ...(await response.json()) })
    } catch {
      setSettingsStatus('Backend offline: settings will load after uvicorn starts.')
    }
  }

  async function saveSettings(): Promise<void> {
    const response = await fetch(`${backendUrl}/settings/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    const data = await response.json()
    setSettings({ ...settings, ...data })
    setSettingsStatus('Saved locally to agent_workspaces/app_settings.json')
  }

  async function loadTraces(): Promise<void> {
    try {
      const response = await fetch(`${backendUrl}/traces?limit=6`)
      if (response.ok) setTraces(await response.json())
    } catch {
      setTraces([])
    }
  }

  async function chooseFolder(): Promise<void> {
    const result = await window.agentApp?.selectDirectory()
    if (result) setProjectPath(result)
  }

  function runTask(): void {
    setIsRunning(true)
    setError(null)
    setApplyStatus('')
    setRunResult(null)
    setEvents([{ id: 'start', title: 'Connecting stream', detail: 'Opening SSE connection to backend.', state: 'running', meta: 'sse' }])

    const authorizedPath = projectPath.startsWith('Choose') ? '' : projectPath
    const params = new URLSearchParams({ message: prompt, selected_agent: selected.agent })
    if (selected.agent === 'code' && authorizedPath) params.set('project_path', authorizedPath)
    if (selected.agent === 'data' && authorizedPath) params.set('data_path', authorizedPath)
    if (selected.agent === 'file' && authorizedPath) params.set('allowed_folder', authorizedPath)

    const stream = new EventSource(`${backendUrl}/tasks/stream?${params.toString()}`)
    stream.addEventListener('event', (raw) => setEvents((current) => [...current, JSON.parse((raw as MessageEvent).data) as TaskEvent]))
    stream.addEventListener('result', (raw) => {
      const data = JSON.parse((raw as MessageEvent).data) as AgentRunResult
      setRunResult(data)
      if (data.error) setError(data.error)
      void loadTraces()
    })
    stream.addEventListener('done', () => {
      stream.close()
      setIsRunning(false)
    })
    stream.onerror = () => {
      stream.close()
      setIsRunning(false)
      setError('Backend stream failed. Start: cd backend_py && uvicorn app.main:app --reload --port 8765')
      setEvents((current) => [...current, { id: 'error', title: 'Stream failed', detail: 'Could not read backend SSE stream.', state: 'blocked', meta: 'error' }])
    }
  }

  async function applyDiff(): Promise<void> {
    if (!runResult?.task_id) return
    setApplyStatus('Applying sandbox diff...')
    const response = await fetch(`${backendUrl}/tasks/apply-diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: runResult.task_id, confirm: true })
    })
    setApplyStatus(JSON.stringify(await response.json(), null, 2))
  }

  return (
    <main className="appShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <aside className="rail">
        <div className="windowDots"><span /><span /><span /></div>
        <div className="logoBlock"><div className="logoOrb"><Sparkles size={20} /></div><div><strong>My Agent</strong><small>Command OS</small></div></div>
        <nav className="railNav"><button className="railButton active"><Command size={19} /></button><button className="railButton"><Workflow size={19} /></button><button className="railButton"><HardDrive size={19} /></button><button className="railButton"><GitBranch size={19} /></button><button className="railButton"><ShieldCheck size={19} /></button></nav>
        <div className="railStatus"><span className="pulse" /><small>{isRunning ? 'streaming' : 'local'}</small></div>
      </aside>

      <section className="mainStage">
        <header className="hero">
          <div><div className="eyebrow"><RadioTower size={14} /> OpenAI Agents SDK Platform</div><h1>基于 Runner、handoffs 和 function tools 的桌面 Agent 控制台</h1><p>子 Agent 是真正的 SDK Agent；本地 App 负责密钥、trace、workspace、审批和 artifact 管理。</p></div>
          <div className="heroActions"><button className="ghostButton" onClick={chooseFolder}><FolderOpen size={16} /> 授权目录</button><button className="primaryButton" onClick={runTask} disabled={isRunning}><Play size={16} /> {isRunning ? '流式运行中' : '运行计划'}</button></div>
        </header>

        <div className="commandCenter">
          <div className="commandChrome"><Search size={20} /><input value={prompt} onChange={(event) => setPrompt(event.target.value)} /><kbd>⌘ K</kbd></div>
          <div className="quickGrid">{capabilities.map((item) => { const Icon = iconMap[item.agent] ?? Bot; return <button key={item.id} className={`capCard ${item.id === selected.id ? 'selected' : ''}`} data-accent={item.accent} onClick={() => setSelected(item)}><span className="capIcon"><Icon size={20} /></span><span><strong>{item.title}</strong><small>{item.tagline}</small></span><ChevronRight size={17} /></button> })}</div>
        </div>

        <section className="contentGrid">
          <article className="panel selectedAgent"><div className="panelHeader"><div><span className="sectionLabel">Selected Agent</span><h2><SelectedIcon size={24} /> {selected.title}</h2></div><span className={`riskPill ${selected.risk}`}>{selected.risk}</span></div><p className="agentDescription">{selected.description}</p><div className="agentMetaGrid"><div><BrainCircuit size={18} /><span>SDK handoff</span><strong>{runResult?.task_type ?? 'ready'}</strong></div><div><TerminalSquare size={18} /><span>Sandbox</span><strong>{selected.needsSandbox ? 'workspace' : 'optional'}</strong></div><div><Gauge size={18} /><span>Mode</span><strong>Runner</strong></div></div><div className="toolStrip">{selected.tools.map((tool) => <span key={tool}>{tool}</span>)}</div></article>

          <article className="panel pipelinePanel"><div className="panelHeader"><div><span className="sectionLabel">Agent Run</span><h2><Activity size={23} /> Live stream</h2></div><button className="miniButton">{runResult?.task_id ?? 'No run'}</button></div><div className="timeline">{events.map((event, index) => <div className={`timelineItem ${event.state}`} key={`${event.id}-${index}`}><div className="timelineIcon">{event.state === 'done' && <CheckCircle2 size={17} />}{event.state === 'running' && <CircleDot size={17} />}{event.state === 'blocked' && <LockKeyhole size={17} />}{event.state === 'pending' && <XCircle size={17} />}</div><div><strong>{event.title}</strong><p>{event.detail}</p></div><small>{event.meta}</small></div>)}</div></article>

          <article className="panel settingsPanel"><div className="panelHeader"><div><span className="sectionLabel">LLM Settings</span><h2><ServerCog size={23} /> Model keys</h2></div></div><div className="settingsGrid"><label>Provider<select value={settings.provider} onChange={(e) => setSettings({ ...settings, provider: e.target.value })}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option></select></label><label>Agent model<input value={settings.agent_model} onChange={(e) => setSettings({ ...settings, agent_model: e.target.value })} /></label><label>OpenAI key<input type="password" placeholder="sk-..." value={settings.openai_api_key} onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })} /></label><label>DeepSeek key<input type="password" placeholder="sk-..." value={settings.deepseek_api_key} onChange={(e) => setSettings({ ...settings, deepseek_api_key: e.target.value })} /></label><label>DeepSeek model<input value={settings.deepseek_model} onChange={(e) => setSettings({ ...settings, deepseek_model: e.target.value })} /></label><label className="checkboxLine"><input type="checkbox" checked={settings.save_traces} onChange={(e) => setSettings({ ...settings, save_traces: e.target.checked })} /> Save local traces</label></div><button className="primaryButton" onClick={saveSettings}>保存配置</button><p className="settingsNote">{settingsStatus || 'Keys are stored locally under agent_workspaces/app_settings.json, not committed.'}</p></article>

          <article className="panel workspacePanel"><div className="panelHeader"><div><span className="sectionLabel">Workspace</span><h2><HardDrive size={23} /> Scoped access</h2></div></div><div className="pathCard"><small>Authorized source</small><strong>{projectPath}</strong></div><div className="workspaceMap"><div><span /> source project</div><ArrowUpRight size={16} /><div><span /> sandbox copy</div><ArrowUpRight size={16} /><div><span /> diff review</div></div></article>

          <article className="panel approvalPanel"><div className="panelHeader"><div><span className="sectionLabel">Approvals</span><h2><ShieldCheck size={23} /> Human gates</h2></div></div>{approvals.map((approval) => <div className="approvalItem" key={approval.id}><LockKeyhole size={17} /><div><strong>{approval.title}</strong><p>{approval.reason}</p></div></div>)}<button className="primaryButton" onClick={applyDiff} disabled={!runResult?.task_id || selected.agent !== 'code'}>确认应用 diff</button>{applyStatus && <pre>{applyStatus}</pre>}</article>

          <article className="panel artifactsPanel"><div className="panelHeader"><div><span className="sectionLabel">Artifacts</span><h2><WandSparkles size={23} /> Verifiable output</h2></div><span className="artifactCount">{Object.keys(runResult?.artifacts ?? {}).length} files</span></div><pre>{artifactText}</pre></article>

          <article className="panel chatPanel"><div className="panelHeader"><div><span className="sectionLabel">Conversation</span><h2><MessageSquareText size={23} /> Agent response</h2></div></div><div className="messageBubble assistant"><strong>{error ? 'Backend error' : 'Agent'}</strong><p>{error || runResult?.summary || '点击运行计划后，会通过 SSE 连接本地后端，OpenAI Agents SDK Runner 会驱动 Router 和专业 Agent。'}</p></div><div className="messageBubble user"><strong>You</strong><p>{prompt}</p></div><div className="traceList"><strong>Local traces</strong>{traces.map((trace) => <p key={trace.task_id}>{trace.task_id} · {trace.task_type} · {trace.path}</p>)}</div></article>
        </section>
      </section>
    </main>
  )
}
