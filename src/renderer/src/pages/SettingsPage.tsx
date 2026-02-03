import React, { useEffect, useState } from 'react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppConfig } from '../services/config'
import { Link } from 'react-router-dom'
import { SettingsNav } from '../components/SettingsNav'
import { searchWeb } from '../services/llm'
import { getMcpConfig, listMcpServers, reloadMcp, saveMcpConfig, listMcpTools, listMcpResources, listMcpPrompts, callMcpTool, readMcpResource, getMcpPrompt } from '../services/mcp'

export function SettingsPage({ config, onChange }: { config: AppConfig; onChange: (c: AppConfig) => void }) {
  const [tab, setTab] = useState<'model' | 'mcp' | 'system'>('model')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ title: string; link: string; snippet: string }[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [mcpServers, setMcpServers] = useState<
    { id: string; status: string; transport: string; error?: string }[]
  >([])
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpError, setMcpError] = useState('')
  const [mcpConfig, setMcpConfig] = useState<any>({ servers: {} })
  const [mcpTools, setMcpTools] = useState<
    { id: string; serverId: string; name: string; description?: string; inputSchema?: any }[]
  >([])
  const [mcpResources, setMcpResources] = useState<{ serverId: string; uri: string; name?: string; description?: string }[]>([])
  const [mcpPrompts, setMcpPrompts] = useState<{ serverId: string; name: string; description?: string }[]>([])
  const [mcpToolArgs, setMcpToolArgs] = useState<Record<string, string>>({})
  const [mcpToolResult, setMcpToolResult] = useState<Record<string, string>>({})
  const [mcpResourceResult, setMcpResourceResult] = useState<Record<string, string>>({})
  const [mcpPromptResult, setMcpPromptResult] = useState<Record<string, string>>({})

  useEffect(() => {
    if (tab !== 'mcp') return
    let active = true
    const run = async () => {
      setMcpLoading(true)
      setMcpError('')
      try {
        const cfg = await getMcpConfig()
        if (active) setMcpConfig(cfg)
        const res = await listMcpServers()
        if (active) setMcpServers(res)
        const tools = await listMcpTools()
        if (active) setMcpTools(tools)
        const resources = await listMcpResources()
        if (active) setMcpResources(resources)
        const prompts = await listMcpPrompts()
        if (active) setMcpPrompts(prompts)
      } catch (err: any) {
        if (active) setMcpError(err?.message ?? '加载失败')
      } finally {
        if (active) setMcpLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [tab])
  return (
    <div className="flex flex-col relative h-full min-h-0">
      <div className="absolute top-0 left-0 w-full h-8 draggable z-10" />
      <div className="flex-1 overflow-y-auto p-6 pt-10 min-h-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-[var(--text-muted)]">Settings</div>
            <Link to="/" className="text-xs text-[var(--text-soft)] hover:text-[var(--text)]">
              返回聊天
            </Link>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-6">
            <SettingsNav tab={tab} setTab={setTab} />
            <div className="min-h-[320px]">
              {tab === 'model' ? <SettingsPanel config={config} onChange={onChange} /> : null}
              {tab === 'mcp' ? (
                <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-panel)] text-sm text-[var(--text-soft)]">
                  <div className="text-xs text-[var(--text-muted)] mb-3">MCP 设置</div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-[var(--text-dim)]">
                      配置文件：{config.mcp.configPath || '未生成'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text)] hover:opacity-80"
                        onClick={async () => {
                          if (!config.mcp.configPath) return
                          try {
                            await navigator.clipboard.writeText(config.mcp.configPath)
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        复制路径
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs disabled:opacity-50"
                        disabled={mcpLoading}
                        onClick={async () => {
                          setMcpLoading(true)
                          setMcpError('')
                          try {
                            await reloadMcp()
                            const res = await listMcpServers()
                            setMcpServers(res)
                            const tools = await listMcpTools()
                            setMcpTools(tools)
                            const resources = await listMcpResources()
                            setMcpResources(resources)
                            const prompts = await listMcpPrompts()
                            setMcpPrompts(prompts)
                          } catch (err: any) {
                            setMcpError(err?.message ?? '重载失败')
                          } finally {
                            setMcpLoading(false)
                          }
                        }}
                      >
                        {mcpLoading ? '重载中...' : '重载配置'}
                      </button>
                    </div>
                  </div>
                  {mcpError ? <div className="text-xs text-red-500 mb-2">{mcpError}</div> : null}
                  <div className="mb-4 border border-[var(--border)] rounded p-3 bg-[var(--bg-input-soft)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-[var(--text-muted)]">服务器配置</div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text)]"
                          onClick={() => {
                            const next = { ...(mcpConfig?.servers ?? {}) }
                            let idx = 1
                            let id = `server-${idx}`
                            while (next[id]) {
                              idx += 1
                              id = `server-${idx}`
                            }
                            next[id] = { command: 'node', args: [], env: {} }
                            setMcpConfig({ ...mcpConfig, servers: next })
                          }}
                        >
                          + 新增
                        </button>
                        <button
                          className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text)]"
                          onClick={() => {
                            const next = { ...(mcpConfig?.servers ?? {}) }
                            if (!next['google-search']) {
                              next['google-search'] = { command: 'npx', args: ['google-search-mcp'], env: {} }
                            }
                            setMcpConfig({ ...mcpConfig, servers: next })
                          }}
                        >
                          添加 Google Search MCP
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(mcpConfig?.servers ?? {}).length ? (
                        Object.entries(mcpConfig.servers).map(([id, cfg]: any) => (
                          <div key={id} className="border border-[var(--border)] rounded p-2">
                            <div className="flex items-center justify-between mb-2">
                              <input
                                className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] w-48"
                                value={id}
                                onChange={(e) => {
                                  const next = { ...(mcpConfig?.servers ?? {}) }
                                  const newId = e.target.value.trim()
                                  if (!newId) return
                                  if (newId === id) return
                                  next[newId] = next[id]
                                  delete next[id]
                                  setMcpConfig({ ...mcpConfig, servers: next })
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={!cfg.disabled}
                                    onChange={(e) => {
                                      const next = { ...(mcpConfig?.servers ?? {}) }
                                      next[id] = { ...cfg, disabled: !e.target.checked }
                                      setMcpConfig({ ...mcpConfig, servers: next })
                                    }}
                                  />
                                  启用
                                </label>
                                <button
                                  className="text-xs text-red-500"
                                  onClick={() => {
                                    const next = { ...(mcpConfig?.servers ?? {}) }
                                    delete next[id]
                                    setMcpConfig({ ...mcpConfig, servers: next })
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-[var(--text-dim)]">连接方式</span>
                                <select
                                  className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                  value={cfg.url ? 'http' : 'stdio'}
                                  onChange={(e) => {
                                    const next = { ...(mcpConfig?.servers ?? {}) }
                                    if (e.target.value === 'http') {
                                      next[id] = { ...cfg, url: cfg.url || 'https://', command: undefined, args: undefined }
                                    } else {
                                      next[id] = { ...cfg, url: undefined, command: cfg.command || 'node', args: cfg.args || [] }
                                    }
                                    setMcpConfig({ ...mcpConfig, servers: next })
                                  }}
                                >
                                  <option value="stdio">stdio</option>
                                  <option value="http">Streamable HTTP</option>
                                </select>
                              </label>
                              {cfg.url ? (
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-[var(--text-dim)]">URL</span>
                                  <input
                                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                    value={cfg.url ?? ''}
                                    onChange={(e) => {
                                      const next = { ...(mcpConfig?.servers ?? {}) }
                                      next[id] = { ...cfg, url: e.target.value }
                                      setMcpConfig({ ...mcpConfig, servers: next })
                                    }}
                                  />
                                </label>
                              ) : (
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-[var(--text-dim)]">Command</span>
                                  <input
                                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                    value={cfg.command ?? ''}
                                    onChange={(e) => {
                                      const next = { ...(mcpConfig?.servers ?? {}) }
                                      next[id] = { ...cfg, command: e.target.value }
                                      setMcpConfig({ ...mcpConfig, servers: next })
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                            {!cfg.url ? (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-[var(--text-dim)]">Args (JSON)</span>
                                  <input
                                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                    value={JSON.stringify(cfg.args ?? [])}
                                    onChange={(e) => {
                                      try {
                                        const v = JSON.parse(e.target.value)
                                        const next = { ...(mcpConfig?.servers ?? {}) }
                                        next[id] = { ...cfg, args: Array.isArray(v) ? v : [] }
                                        setMcpConfig({ ...mcpConfig, servers: next })
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-[var(--text-dim)]">Env (JSON)</span>
                                  <input
                                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                    value={JSON.stringify(cfg.env ?? {})}
                                    onChange={(e) => {
                                      try {
                                        const v = JSON.parse(e.target.value)
                                        const next = { ...(mcpConfig?.servers ?? {}) }
                                        next[id] = { ...cfg, env: v || {} }
                                        setMcpConfig({ ...mcpConfig, servers: next })
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="mt-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-[var(--text-dim)]">Headers (JSON)</span>
                                  <input
                                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                    value={JSON.stringify(cfg.headers ?? {})}
                                    onChange={(e) => {
                                      try {
                                        const v = JSON.parse(e.target.value)
                                        const next = { ...(mcpConfig?.servers ?? {}) }
                                        next[id] = { ...cfg, headers: v || {} }
                                        setMcpConfig({ ...mcpConfig, servers: next })
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[var(--text-dim)]">暂无配置</div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={async () => {
                          try {
                            await saveMcpConfig(mcpConfig)
                            await reloadMcp()
                            const res = await listMcpServers()
                            setMcpServers(res)
                          } catch (err: any) {
                            setMcpError(err?.message ?? '保存失败')
                          }
                        }}
                      >
                        保存配置
                      </button>
                      <span className="text-[11px] text-[var(--text-dim)]">保存后会自动重载</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {mcpServers.length ? (
                      mcpServers.map((s) => (
                        <div key={s.id} className="border border-[var(--border)] rounded p-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-[var(--text)]">{s.id}</div>
                            <div className="text-xs text-[var(--text-dim)]">{s.transport}</div>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">状态：{s.status}</div>
                          {s.error ? <div className="text-xs text-red-500 mt-1">{s.error}</div> : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-[var(--text-dim)]">暂无 MCP 服务连接</div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">工具</div>
                    <div className="space-y-2">
                      {mcpTools.length ? (
                        mcpTools.map((t) => (
                          <div key={t.id} className="border border-[var(--border)] rounded p-2">
                            <div className="text-xs text-[var(--text)]">{t.serverId}:{t.name}</div>
                            {t.description ? <div className="text-[11px] text-[var(--text-dim)]">{t.description}</div> : null}
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                                placeholder='参数 JSON，例如 {"q":"test"}'
                                value={mcpToolArgs[t.id] ?? ''}
                                onChange={(e) => setMcpToolArgs({ ...mcpToolArgs, [t.id]: e.target.value })}
                              />
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                onClick={async () => {
                                  try {
                                    const args = mcpToolArgs[t.id] ? JSON.parse(mcpToolArgs[t.id]) : {}
                                    const res = await callMcpTool(t.serverId, t.name, args)
                                    setMcpToolResult({ ...mcpToolResult, [t.id]: JSON.stringify(res, null, 2) })
                                  } catch (err: any) {
                                    setMcpToolResult({ ...mcpToolResult, [t.id]: err?.message ?? '调用失败' })
                                  }
                                }}
                              >
                                调用
                              </button>
                            </div>
                            {mcpToolResult[t.id] ? (
                              <pre className="mt-2 text-[11px] whitespace-pre-wrap text-[var(--text-dim)]">
                                {mcpToolResult[t.id]}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[var(--text-dim)]">暂无工具</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">资源</div>
                    <div className="space-y-2">
                      {mcpResources.length ? (
                        mcpResources.map((r) => (
                          <div key={`${r.serverId}:${r.uri}`} className="border border-[var(--border)] rounded p-2">
                            <div className="text-xs text-[var(--text)]">{r.serverId}:{r.uri}</div>
                            {r.description ? <div className="text-[11px] text-[var(--text-dim)]">{r.description}</div> : null}
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                onClick={async () => {
                                  try {
                                    const res = await readMcpResource(r.serverId, r.uri)
                                    setMcpResourceResult({
                                      ...mcpResourceResult,
                                      [`${r.serverId}:${r.uri}`]: JSON.stringify(res, null, 2)
                                    })
                                  } catch (err: any) {
                                    setMcpResourceResult({
                                      ...mcpResourceResult,
                                      [`${r.serverId}:${r.uri}`]: err?.message ?? '读取失败'
                                    })
                                  }
                                }}
                              >
                                读取
                              </button>
                            </div>
                            {mcpResourceResult[`${r.serverId}:${r.uri}`] ? (
                              <pre className="mt-2 text-[11px] whitespace-pre-wrap text-[var(--text-dim)]">
                                {mcpResourceResult[`${r.serverId}:${r.uri}`]}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[var(--text-dim)]">暂无资源</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-[var(--border)] pt-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">Prompts</div>
                    <div className="space-y-2">
                      {mcpPrompts.length ? (
                        mcpPrompts.map((p) => (
                          <div key={`${p.serverId}:${p.name}`} className="border border-[var(--border)] rounded p-2">
                            <div className="text-xs text-[var(--text)]">{p.serverId}:{p.name}</div>
                            {p.description ? <div className="text-[11px] text-[var(--text-dim)]">{p.description}</div> : null}
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                onClick={async () => {
                                  try {
                                    const res = await getMcpPrompt(p.serverId, p.name)
                                    setMcpPromptResult({
                                      ...mcpPromptResult,
                                      [`${p.serverId}:${p.name}`]: JSON.stringify(res, null, 2)
                                    })
                                  } catch (err: any) {
                                    setMcpPromptResult({
                                      ...mcpPromptResult,
                                      [`${p.serverId}:${p.name}`]: err?.message ?? '获取失败'
                                    })
                                  }
                                }}
                              >
                                获取
                              </button>
                            </div>
                            {mcpPromptResult[`${p.serverId}:${p.name}`] ? (
                              <pre className="mt-2 text-[11px] whitespace-pre-wrap text-[var(--text-dim)]">
                                {mcpPromptResult[`${p.serverId}:${p.name}`]}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-[var(--text-dim)]">暂无 Prompts</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {tab === 'system' ? (
                <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-panel)] text-sm">
                  <div className="text-xs text-[var(--text-muted)] mb-3">系统设置</div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">主题</span>
                    <select
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                      value={config.ui?.theme ?? 'dark'}
                      onChange={(e) =>
                        onChange({ ...config, ui: { ...config.ui, theme: e.target.value as 'dark' | 'light' } })
                      }
                    >
                      <option value="dark">深色</option>
                      <option value="light">浅色</option>
                    </select>
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-soft)]">
                    <input
                      type="checkbox"
                      checked={Boolean(config.ui?.debugLogs)}
                      onChange={(e) =>
                        onChange({ ...config, ui: { ...config.ui, debugLogs: e.target.checked } })
                      }
                    />
                    启用流式调试日志（控制台）
                  </label>
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <div className="text-xs text-[var(--text-muted)] mb-3">联网搜索</div>
                    <label className="flex flex-col gap-1 mb-3">
                      <span className="text-xs text-[var(--text-muted)]">搜索提供方</span>
                      <select
                        className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                        value={config.webSearch?.provider ?? 'google-cse'}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            webSearch: { ...config.webSearch, provider: e.target.value as 'google-cse' | 'serpapi' }
                          })
                        }
                      >
                        <option value="google-cse">Google Programmable Search</option>
                        <option value="serpapi">SerpAPI (Google)</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--text-muted)]">Google API Key</span>
                        <input
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                          value={config.webSearch?.googleApiKey ?? ''}
                          onChange={(e) =>
                            onChange({
                              ...config,
                              webSearch: { ...config.webSearch, googleApiKey: e.target.value }
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--text-muted)]">Google CSE CX</span>
                        <input
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                          value={config.webSearch?.googleCx ?? ''}
                          onChange={(e) =>
                            onChange({
                              ...config,
                              webSearch: { ...config.webSearch, googleCx: e.target.value }
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 mt-3">
                      <span className="text-xs text-[var(--text-muted)]">SerpAPI Key</span>
                      <input
                        className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                        value={config.webSearch?.serpApiKey ?? ''}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            webSearch: { ...config.webSearch, serpApiKey: e.target.value }
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 mt-3">
                      <span className="text-xs text-[var(--text-muted)]">代理地址（HTTP/HTTPS）</span>
                      <input
                        className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                        placeholder="http://127.0.0.1:7890"
                        value={config.webSearch?.proxyUrl ?? ''}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            webSearch: { ...config.webSearch, proxyUrl: e.target.value }
                          })
                        }
                      />
                    </label>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                        placeholder="测试搜索…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button
                        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                        disabled={searchLoading || !searchQuery.trim()}
                        onClick={async () => {
                          setSearchLoading(true)
                          setSearchError('')
                          try {
                            const res = await searchWeb(searchQuery.trim())
                            setSearchResults(res)
                          } catch (err: any) {
                            setSearchResults([])
                            setSearchError(err?.message ?? '搜索失败')
                          } finally {
                            setSearchLoading(false)
                          }
                        }}
                      >
                        {searchLoading ? '搜索中...' : '测试搜索'}
                      </button>
                    </div>
                    {searchError ? <div className="mt-2 text-xs text-red-500">{searchError}</div> : null}
                    {searchResults.length ? (
                      <div className="mt-3 space-y-2 text-xs">
                        {searchResults.slice(0, 5).map((r, idx) => (
                          <div key={`${idx}-${r.link}`} className="border border-[var(--border)] rounded p-2">
                            <div className="text-[var(--text)] font-medium">{r.title}</div>
                            <div className="text-[var(--text-dim)]">{r.snippet}</div>
                            <div className="text-[var(--link)] break-all">{r.link}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
