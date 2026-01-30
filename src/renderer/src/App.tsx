import React, { useState, useEffect, useRef } from 'react'
import { Settings, Plus, MessageSquare, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { startStream, onStreamChunk, stopStream } from './services/llm'
import { useConfig } from './store/useConfig'
import { ChatPage, Message } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { loadChat, saveChat, ChatSession } from './services/chat'

function App() {
  const [input, setInput] = useState('')
  const initialMessage: Message = {
    id: '1',
    role: 'assistant',
    content: '你好！我是你的桌面智能助手。我可以帮你处理文件、识别屏幕或编写代码。'
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
                    { id: `err-${Date.now()}`, role: 'assistant', content: `请求失败：${payload.error}` }
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
        setActiveStreamId(null)
        setBusy(false)
        return
      }
      if (payload.content) {
        if (!activeSessionId) return
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s
            const last = s.messages[s.messages.length - 1]
            if (last && last.id === activeStreamId && last.role === 'assistant') {
              return {
                ...s,
                messages: [...s.messages.slice(0, -1), { ...last, content: last.content + payload.content }],
                updatedAt: Date.now()
              }
            }
            return s
          })
        )
      }
    })
    return unsubscribe
  }, [activeStreamId, activeSessionId])

  const handleSend = async () => {
    if (!input.trim() || !config) return
    if (!activeSessionId) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
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
      const active = sessions.find((s) => s.id === activeSessionId)
      const messageList = active ? [...active.messages, userMsg] : [userMsg]
      const streamId = await startStream({
        provider: config.llm.provider,
        model: config.llm.model,
        messages: messageList.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens
      })
      setActiveStreamId(streamId)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, { id: streamId, role: 'assistant', content: '' }], updatedAt: Date.now() }
            : s
        )
      )
    } catch (err: any) {
      const aiMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `请求失败：${err?.message ?? '未知错误'}`
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
    return <div className="h-screen bg-[#343541] text-white flex items-center justify-center">加载中...</div>
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const visibleSessions = sessions
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-screen bg-[#343541] text-white font-sans overflow-hidden">
      {/* --- 左侧侧边栏 --- */}
      <div className="w-64 bg-[#202123] flex flex-col border-r border-gray-700 min-h-0">
        <div className="h-8 draggable shrink-0" />
        <div className="px-4 py-3 text-xs text-gray-400 border-b border-gray-700/60">Agent Desktop</div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 pt-3 min-h-0">
          <button
            className="non-draggable flex items-center gap-2 border border-gray-600 rounded p-3 hover:bg-gray-700 transition-colors text-sm mb-4 shrink-0"
            onClick={handleNewChat}
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>

          <input
            className="non-draggable bg-[#1F2026] border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 mb-3"
            placeholder="搜索会话"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex-1 overflow-y-auto non-draggable space-y-2 min-h-0">
            {visibleSessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 p-3 text-sm rounded cursor-pointer ${
                  s.id === activeSessionId ? 'bg-[#2A2B32] text-white' : 'text-gray-300 hover:bg-[#2A2B32]'
                }`}
                onClick={() => handleSelectSession(s.id)}
              >
                <MessageSquare size={14} />
                {editingSessionId === s.id ? (
                  <input
                    className="bg-[#40414F] border border-gray-600 rounded px-2 py-1 text-xs w-full"
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
                    className="p-1 rounded hover:bg-[#3A3B44]"
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
                    className="p-1 rounded hover:bg-[#3A3B44]"
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

        <div className="p-4 border-t border-gray-700 shrink-0 non-draggable">
          <div
            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
              location.pathname === '/settings' ? 'bg-[#2A2B32] text-white' : 'hover:bg-gray-700 text-gray-300'
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
        <div className="h-10 border-b border-gray-700 flex items-center px-4 text-xs text-gray-400">
          <span className="text-gray-300">Agent Desktop</span>
          <ChevronRight size={12} className="mx-2" />
          <span>{location.pathname === '/settings' ? 'Settings' : 'Chat'}</span>
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
