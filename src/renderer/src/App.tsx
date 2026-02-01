import React, { useState, useEffect, useRef } from 'react'
import { Settings, Plus, MessageSquare, ChevronRight, Pencil, Trash2, Sun, Moon } from 'lucide-react'
import { startStream, onStreamChunk, stopStream } from './services/llm'
import { loadApiKey } from './services/config'
import { useConfig } from './store/useConfig'
import { ChatPage, Message } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { loadChat, saveChat, ChatSession } from './services/chat'
import { estimateMessageUsage } from './services/TokenService'

function App() {
  const [input, setInput] = useState('')
  const initialMessage: Message = {
    id: '1',
    role: 'assistant',
    content: '你好！我是你的桌面智能助手。我可以帮你处理文件、识别屏幕或编写代码。',
    model: 'system',
    provider: 'system'
  }
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [search, setSearch] = useState('')
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { config, loading, updateConfig } = useConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const saveTimer = useRef<number | null>(null)
  const streamBufferRef = useRef<string>('')
  const streamRafRef = useRef<number | null>(null)

  useEffect(() => {
    loadChat()
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setSessions(data)
          setActiveSessionId(data[0].id)
        } else {
          const s = createSession()
          setSessions([s])
          setActiveSessionId(s.id)
        }
      })
      .catch(() => {
        const s = createSession()
        setSessions([s])
        setActiveSessionId(s.id)
      })
  }, [])

  useEffect(() => {
    if (!config) return
    const theme = config.ui?.theme ?? 'dark'
    document.documentElement.classList.toggle('theme-light', theme === 'light')
    document.documentElement.classList.toggle('theme-dark', theme !== 'light')
  }, [config])

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveChat(sessions).catch(() => {
        // ignore
      })
    }, 400)
  }, [sessions])


  useEffect(() => {
    const unsubscribe = onStreamChunk((payload) => {
      if (!activeStreamId || payload.streamId !== activeStreamId) return
      if (payload.error) {
        if (payload.error.includes('aborted')) {
          setActiveStreamId(null)
          setBusy(false)
          return
        }
        if (!activeSessionId) return
        setSessions((prev) =>
          prev.map((s) =>
                s.id === activeSessionId
                  ? {
                      ...s,
                      messages: [
                        ...s.messages,
                        {
                          id: `err-${Date.now()}`,
                          role: 'assistant',
                          content: `请求失败：${payload.error}`,
                          model: config?.llm.model,
                          provider: config?.llm.provider,
                          usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                        }
                      ],
                      updatedAt: Date.now()
                    }
              : s
          )
        )
        setActiveStreamId(null)
        setBusy(false)
        return
      }
      if (payload.done) {
        if (streamBufferRef.current) {
          const buffered = streamBufferRef.current
          streamBufferRef.current = ''
          if (activeSessionId) {
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== activeSessionId) return s
                const last = s.messages[s.messages.length - 1]
                if (last && last.id === activeStreamId && last.role === 'assistant') {
                  return {
                    ...s,
                    messages: [...s.messages.slice(0, -1), { ...last, content: last.content + buffered }],
                    updatedAt: Date.now()
                  }
                }
                return s
              })
            )
          }
        }
        if (activeSessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === payload.streamId ? { ...m, usage: estimateMessageUsage(m) } : m
                    ),
                    updatedAt: Date.now()
                  }
                : s
            )
          )
        }
        setActiveStreamId(null)
        setBusy(false)
        return
      }
      if (payload.content) {
        if (!activeSessionId) return
        streamBufferRef.current += payload.content
        if (streamRafRef.current == null) {
          streamRafRef.current = window.requestAnimationFrame(() => {
            streamRafRef.current = null
            const buffered = streamBufferRef.current
            if (!buffered) return
            streamBufferRef.current = ''
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== activeSessionId) return s
                const last = s.messages[s.messages.length - 1]
                if (last && last.id === activeStreamId && last.role === 'assistant') {
                  return {
                    ...s,
                    messages: [...s.messages.slice(0, -1), { ...last, content: last.content + buffered }],
                    updatedAt: Date.now()
                  }
                }
                return s
              })
            )
          })
        }
      }
    })
    return unsubscribe
  }, [activeStreamId, activeSessionId])

  const handleSend = async () => {
    if (!input.trim() || !config) return
    if (!activeSessionId) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      usage: estimateMessageUsage({ id: 'tmp', role: 'user', content: input })
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...s.messages, userMsg],
              title: s.title === '新对话' ? makeTitle(userMsg.content) : s.title,
              updatedAt: Date.now()
            }
          : s
      )
    )
    setInput('')

    try {
      setBusy(true)
      const apiKey = await loadApiKey(config.llm.provider)
      if (!apiKey) {
        const aiMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `请先在设置中为 ${config.llm.provider} 配置 API Key。`,
          model: config.llm.model,
          provider: config.llm.provider,
          usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg], updatedAt: Date.now() } : s
          )
        )
        setBusy(false)
        return
      }
      const active = sessions.find((s) => s.id === activeSessionId)
      const messageList = active ? [...active.messages, userMsg] : [userMsg]
      const filtered = messageList.filter((m) => !(m.role === 'assistant' && !m.content?.trim()))
      const streamId = await startStream({
        provider: config.llm.provider,
        model: config.llm.model,
        messages: filtered.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens
      })
      setActiveStreamId(streamId)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: streamId,
                    role: 'assistant',
                    content: '',
                    model: config.llm.model,
                    provider: config.llm.provider,
                    usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                  }
                ],
                updatedAt: Date.now()
              }
            : s
        )
      )
    } catch (err: any) {
      const aiMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `请求失败：${err?.message ?? '未知错误'}`,
        model: config.llm.model,
        provider: config.llm.provider,
        usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg], updatedAt: Date.now() } : s
        )
      )
      setBusy(false)
    }
  }

  const handleStop = async () => {
    if (!activeStreamId) return
    await stopStream(activeStreamId)
    setActiveStreamId(null)
    setBusy(false)
  }

  const createSession = (): ChatSession => ({
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: '新对话',
    messages: [initialMessage],
    createdAt: Date.now(),
    updatedAt: Date.now()
  })

  const makeTitle = (text: string) => {
    const t = text.replace(/\s+/g, ' ').trim()
    return t.length > 16 ? `${t.slice(0, 16)}…` : t || '新对话'
  }

  const handleNewChat = () => {
    setInput('')
    setActiveStreamId(null)
    setBusy(false)
    const s = createSession()
    setSessions((prev) => [s, ...prev])
    setActiveSessionId(s.id)
    navigate('/')
  }

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
    navigate('/')
  }

  const handleDeleteSession = (id: string) => {
    const target = sessions.find((s) => s.id === id)
    const ok = window.confirm(`确认删除会话 “${target?.title || '新对话'}” 吗？`)
    if (!ok) return
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (activeSessionId === id) {
      const next = sessions.find((s) => s.id !== id)
      if (next) setActiveSessionId(next.id)
      else {
        const s = createSession()
        setSessions([s])
        setActiveSessionId(s.id)
      }
    }
  }

  const handleRenameSession = (id: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title, updatedAt: Date.now() } : s)))
  }

  if (loading || !config) {
    return (
      <div className="h-screen bg-[var(--bg-app)] text-[var(--text)] flex items-center justify-center">加载中...</div>
    )
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const visibleSessions = sessions
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text)] font-sans overflow-hidden">
      {/* --- 左侧侧边栏 --- */}
      <div className="w-64 bg-[var(--bg-sidebar)] flex flex-col border-r border-[var(--border)] min-h-0">
        <div className="h-8 draggable shrink-0" />
        <div className="px-4 py-3 text-xs text-[var(--text-muted)] border-b border-[var(--border)]">Agent Desktop</div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 pt-3 min-h-0">
          <button
            className="non-draggable flex items-center gap-2 border border-[var(--border)] rounded p-3 hover:bg-[var(--bg-input)] transition-colors text-sm mb-4 shrink-0"
            onClick={handleNewChat}
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>

          <input
            className="non-draggable bg-[var(--bg-input-soft)] border border-[var(--border)] rounded px-3 py-2 text-xs text-[var(--text-soft)] placeholder:text-[var(--text-dim)] mb-3"
            placeholder="搜索会话"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex-1 overflow-y-auto non-draggable space-y-2 min-h-0">
            {visibleSessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 p-3 text-sm rounded cursor-pointer ${
                  s.id === activeSessionId
                    ? 'bg-[var(--bg-panel)] text-[var(--text)]'
                    : 'text-[var(--text-soft)] hover:bg-[var(--bg-panel)]'
                }`}
                onClick={() => handleSelectSession(s.id)}
              >
                <MessageSquare size={14} />
                {editingSessionId === s.id ? (
                  <input
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs w-full"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      handleRenameSession(s.id, titleDraft.trim() || '新对话')
                      setEditingSessionId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSession(s.id, titleDraft.trim() || '新对话')
                        setEditingSessionId(null)
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="truncate flex-1">{s.title || '新对话'}</span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    className="p-1 rounded hover:bg-[var(--bg-card-user)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingSessionId(s.id)
                      setTitleDraft(s.title || '新对话')
                    }}
                    title="重命名"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-[var(--bg-card-user)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(s.id)
                    }}
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)] shrink-0 non-draggable">
          <div
            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
              location.pathname === '/settings'
                ? 'bg-[var(--bg-panel)] text-[var(--text)]'
                : 'hover:bg-[var(--bg-input)] text-[var(--text-soft)]'
            }`}
            onClick={() => navigate('/settings')}
          >
            <Settings size={16} />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* --- 顶部标题栏/面包屑 --- */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-10 border-b border-[var(--border)] flex items-center px-4 text-xs text-[var(--text-muted)]">
          <div className="draggable h-full flex-1 flex items-center">
            <div className="non-draggable flex items-center">
              <span className="text-[var(--text-soft)]">Agent Desktop</span>
              <ChevronRight size={12} className="mx-2" />
              <span>{location.pathname === '/settings' ? 'Settings' : 'Chat'}</span>
            </div>
          </div>
          <div className="non-draggable flex items-center gap-2">
            <button
              className="p-1 rounded hover:bg-[var(--bg-panel)] text-[var(--text-soft)] hover:text-[var(--text)]"
              onClick={() => {
                const next = config.ui?.theme === 'light' ? 'dark' : 'light'
                updateConfig({ ...config, ui: { ...config.ui, theme: next } })
              }}
              title="切换主题"
            >
              {config.ui?.theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
          <Route
            path="/"
          element={
            <ChatPage
              messages={activeSession?.messages ?? [initialMessage]}
              input={input}
              setInput={setInput}
              busy={busy}
              onSend={handleSend}
              onStop={handleStop}
              onUpdateMessage={(id, content) => {
                if (!activeSessionId) return
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === activeSessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m) =>
                            m.id === id ? { ...m, content, usage: estimateMessageUsage({ ...m, content }) } : m
                          ),
                          updatedAt: Date.now()
                        }
                      : s
                  )
                )
              }}
                config={config}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage config={config} onChange={updateConfig} />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App
