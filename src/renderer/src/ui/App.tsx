import { useMemo, useState } from 'react'
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
import type { AgentCapability, ApprovalItem } from '../types'

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

const approvals: ApprovalItem[] = [
  {
    id: 'terminal',
    title: 'Run terminal command',
    reason: 'npm build can install, compile, or generate files. Show the command before execution.',
    risk: 'needs-approval'
  },
  {
    id: 'apply',
    title: 'Apply sandbox diff',
    reason: 'Real project files are changed only after review.',
    risk: 'dangerous'
  }
]

const sampleDiff = `src/renderer/src/ui/App.tsx
+ Agent command center layout
+ Capability cards
+ Approval panel
+ Workspace status

backend_py/app/agents/code_agent.py
+ SandboxAgent integration placeholder
+ DeepSeek provider hook planned`

export function App(): JSX.Element {
  const [selected, setSelected] = useState<AgentCapability>(capabilities[0])
  const [projectPath, setProjectPath] = useState<string>('Choose a project or data folder')
  const [prompt, setPrompt] = useState('改造这个项目：做一个通用 Agent App，能写代码、分析数据、管理授权文件，并且所有危险操作需要确认。')

  const SelectedIcon = useMemo(() => iconMap[selected.agent] ?? Bot, [selected])

  async function chooseFolder(): Promise<void> {
    const result = await window.agentApp?.selectDirectory()
    if (result) setProjectPath(result)
  }

  return (
    <main className="appShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <aside className="rail">
        <div className="windowDots"><span /><span /><span /></div>
        <div className="logoBlock">
          <div className="logoOrb"><Sparkles size={20} /></div>
          <div>
            <strong>My Agent</strong>
            <small>Command OS</small>
          </div>
        </div>
        <nav className="railNav">
          <button className="railButton active"><Command size={19} /></button>
          <button className="railButton"><Workflow size={19} /></button>
          <button className="railButton"><HardDrive size={19} /></button>
          <button className="railButton"><GitBranch size={19} /></button>
          <button className="railButton"><ShieldCheck size={19} /></button>
        </nav>
        <div className="railStatus">
          <span className="pulse" />
          <small>local</small>
        </div>
      </aside>

      <section className="mainStage">
        <header className="hero">
          <div>
            <div className="eyebrow"><RadioTower size={14} /> Universal Agent Platform</div>
            <h1>一个能调度工具、沙箱和专业 Agent 的桌面控制台</h1>
            <p>主控 Agent 负责理解任务，专业 Agent 负责代码、数据、文件、调研和 PPT。所有高风险动作都进入审批流。</p>
          </div>
          <div className="heroActions">
            <button className="ghostButton" onClick={chooseFolder}><FolderOpen size={16} /> 授权目录</button>
            <button className="primaryButton"><Play size={16} /> 运行计划</button>
          </div>
        </header>

        <div className="commandCenter">
          <div className="commandChrome">
            <Search size={20} />
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <kbd>⌘ K</kbd>
          </div>
          <div className="quickGrid">
            {capabilities.map((item) => {
              const Icon = iconMap[item.agent] ?? Bot
              return (
                <button
                  key={item.id}
                  className={`capCard ${item.id === selected.id ? 'selected' : ''}`}
                  data-accent={item.accent}
                  onClick={() => setSelected(item)}
                >
                  <span className="capIcon"><Icon size={20} /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.tagline}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              )
            })}
          </div>
        </div>

        <section className="contentGrid">
          <article className="panel selectedAgent">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Selected Agent</span>
                <h2><SelectedIcon size={24} /> {selected.title}</h2>
              </div>
              <span className={`riskPill ${selected.risk}`}>{selected.risk}</span>
            </div>
            <p className="agentDescription">{selected.description}</p>
            <div className="agentMetaGrid">
              <div><BrainCircuit size={18} /><span>Router handoff</span><strong>enabled</strong></div>
              <div><TerminalSquare size={18} /><span>Sandbox</span><strong>{selected.needsSandbox ? 'required' : 'optional'}</strong></div>
              <div><Gauge size={18} /><span>Mode</span><strong>plan-first</strong></div>
            </div>
            <div className="toolStrip">
              {selected.tools.map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </article>

          <article className="panel pipelinePanel">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Agent Run</span>
                <h2><Activity size={23} /> Live pipeline</h2>
              </div>
              <button className="miniButton">View logs</button>
            </div>
            <div className="timeline">
              {taskEvents.map((event) => (
                <div className={`timelineItem ${event.state}`} key={event.id}>
                  <div className="timelineIcon">
                    {event.state === 'done' && <CheckCircle2 size={17} />}
                    {event.state === 'running' && <CircleDot size={17} />}
                    {event.state === 'blocked' && <LockKeyhole size={17} />}
                    {event.state === 'pending' && <XCircle size={17} />}
                  </div>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <small>{event.meta}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel workspacePanel">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Workspace</span>
                <h2><HardDrive size={23} /> Scoped access</h2>
              </div>
            </div>
            <div className="pathCard">
              <small>Authorized source</small>
              <strong>{projectPath}</strong>
            </div>
            <div className="workspaceMap">
              <div><span /> source project</div>
              <ArrowUpRight size={16} />
              <div><span /> sandbox copy</div>
              <ArrowUpRight size={16} />
              <div><span /> diff review</div>
            </div>
          </article>

          <article className="panel approvalPanel">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Approvals</span>
                <h2><ShieldCheck size={23} /> Human gates</h2>
              </div>
            </div>
            {approvals.map((approval) => (
              <div className="approvalItem" key={approval.id}>
                <LockKeyhole size={17} />
                <div>
                  <strong>{approval.title}</strong>
                  <p>{approval.reason}</p>
                </div>
              </div>
            ))}
          </article>

          <article className="panel artifactsPanel">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Artifacts</span>
                <h2><WandSparkles size={23} /> Verifiable output</h2>
              </div>
              <span className="artifactCount">2 files</span>
            </div>
            <pre>{sampleDiff}</pre>
          </article>

          <article className="panel chatPanel">
            <div className="panelHeader">
              <div>
                <span className="sectionLabel">Conversation</span>
                <h2><MessageSquareText size={23} /> Agent response</h2>
              </div>
            </div>
            <div className="messageBubble assistant">
              <strong>Router Agent</strong>
              <p>我会把任务拆成：代码沙箱、数据工作区、文件权限、MCP 工具和审批流。下一步会生成执行计划。</p>
            </div>
            <div className="messageBubble user">
              <strong>You</strong>
              <p>{prompt}</p>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
