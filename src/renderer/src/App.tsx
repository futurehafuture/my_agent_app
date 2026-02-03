import React, { useState, useEffect, useRef } from 'react'
import { Settings, Plus, MessageSquare, ChevronRight, Pencil, Trash2, Sun, Moon } from 'lucide-react'
import { startStream, onStreamChunk, stopStream, chat } from './services/llm'
import { loadApiKey } from './services/config'
import { useConfig } from './store/useConfig'
import { ChatPage, Message } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { loadChat, saveChat, ChatSession } from './services/chat'
import { estimateMessageUsage } from './services/TokenService'
import { callMcpTool, listMcpTools } from './services/mcp'

function App() {
  const [input, setInput] = useState('')
  const initialMessage: Message = {
    id: '1',
    role: 'assistant',
    content: '你好！我是你的桌面智能助手。我可以帮你处理文件、识别屏幕或编写代码。',
    model: 'system',
    provider: 'system',
    createdAt: Date.now()
  }
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [search, setSearch] = useState('')
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toolAutoEnabled, setToolAutoEnabled] = useState(true)
  const toolCallGuardRef = useRef<boolean>(false)
  const toolHandledRef = useRef<Set<string>>(new Set())
  const streamTargetRef = useRef<Record<string, string>>({})
  const { config, loading, updateConfig } = useConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const saveTimer = useRef<number | null>(null)
  const streamBufferRef = useRef<string>('')
  const streamRafRef = useRef<number | null>(null)
  const sessionsRef = useRef<ChatSession[]>([])
  const streamMetaRef = useRef<
    Record<
      string,
      {
        hasContent: boolean
        sessionId: string
        targetId: string
        timeoutId?: number
        fallback?: { sessionId: string; messages: { role: 'user' | 'assistant' | 'system'; content: string }[]; used: boolean }
      }
    >
  >({})
  const stopRequestedRef = useRef<Set<string>>(new Set())

  const updateMessageContent = (sessionId: string, messageId: string, content: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
              updatedAt: Date.now()
            }
          : s
      )
    )
  }

  const appendAssistantMessage = (sessionId: string, content: string) => {
    if (!config) return
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [
                ...s.messages,
                {
                  id: `sys-${Date.now()}`,
                  role: 'assistant',
                  content,
                  model: config.llm.model,
                  provider: config.llm.provider,
                  createdAt: Date.now(),
                  usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content })
                }
              ],
              updatedAt: Date.now()
            }
          : s
      )
    )
  }

  const logStream = (event: string, payload: Record<string, any>) => {
    if (!config?.ui?.debugLogs) return
    if (typeof window !== 'undefined') {
      window.api?.app?.log?.({ tag: 'stream', event, ...payload }).catch?.(() => {})
    }
    // eslint-disable-next-line no-console
    console.log(`[stream] ${event}`, payload)
  }

  const clearStreamMeta = (streamId: string) => {
    const meta = streamMetaRef.current[streamId]
    if (meta?.timeoutId) window.clearTimeout(meta.timeoutId)
    delete streamMetaRef.current[streamId]
  }

  const scheduleStreamTimeout = (streamId: string, sessionId: string, targetId: string) => {
    const timeoutId = window.setTimeout(() => {
      const meta = streamMetaRef.current[streamId]
      if (!meta || meta.hasContent) return
      logStream('timeout', { streamId })
      if (meta.fallback && !meta.fallback.used) {
        meta.fallback.used = true
        chat({
          provider: config?.llm.provider,
          model: config?.llm.model,
          messages: meta.fallback.messages,
          temperature: config?.llm.temperature,
          maxTokens: config?.llm.maxTokens
        })
          .then((resp) => {
            const text = (resp?.content || '').trim()
            if (text) updateMessageContent(sessionId, targetId, text)
            else updateMessageContent(sessionId, targetId, '模型未返回内容，请重试。')
          })
          .catch((err) => {
            updateMessageContent(sessionId, targetId, `请求失败：${err?.message ?? '未知错误'}`)
          })
      } else {
        updateMessageContent(sessionId, targetId, '模型未返回内容，请重试。')
      }
      if (activeStreamId === streamId) {
        setActiveStreamId(null)
        setBusy(false)
      }
      stopRequestedRef.current.delete(streamId)
      delete streamTargetRef.current[streamId]
      clearStreamMeta(streamId)
    }, 8000)
    const meta = streamMetaRef.current[streamId]
    if (meta) meta.timeoutId = timeoutId
  }

  const appReadySentRef = useRef(false)
  useEffect(() => {
    if (appReadySentRef.current) return
    if (!loading && config) {
      appReadySentRef.current = true
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.api?.app?.ready?.()
        })
      })
    }
  }, [loading, config])

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
    sessionsRef.current = sessions
  }, [sessions])


  useEffect(() => {
    const unsubscribe = onStreamChunk((payload) => {
      const meta = streamMetaRef.current[payload.streamId]
      if (!meta) return
      const targetId = streamTargetRef.current[payload.streamId] || payload.streamId
      const sessionId = meta.sessionId
      logStream('chunk', {
        streamId: payload.streamId,
        hasContent: meta?.hasContent ?? false,
        done: Boolean(payload.done),
        hasError: Boolean(payload.error),
        contentLen: payload.content?.length ?? 0
      })
      if (payload.error) {
        if (payload.error.includes('aborted')) {
          const stopped = stopRequestedRef.current.has(payload.streamId)
          if (!stopped && sessionId) {
            appendAssistantMessage(sessionId, '生成被中断或无输出，请重试。')
          }
          setActiveStreamId(null)
          delete streamTargetRef.current[payload.streamId]
          clearStreamMeta(payload.streamId)
          stopRequestedRef.current.delete(payload.streamId)
          setBusy(false)
          return
        }
        if (!sessionId) return
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages.filter((m) => m.id !== targetId || (m.content || '').trim().length > 0),
                    {
                      id: `err-${Date.now()}`,
                      role: 'assistant',
                      content: `请求失败：${payload.error}`,
                      model: config?.llm.model,
                      provider: config?.llm.provider,
                      createdAt: Date.now(),
                      usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                    }
                  ],
                  updatedAt: Date.now()
                }
              : s
          )
        )
        setActiveStreamId(null)
        delete streamTargetRef.current[payload.streamId]
        clearStreamMeta(payload.streamId)
        stopRequestedRef.current.delete(payload.streamId)
        setBusy(false)
        return
      }
      if (payload.done) {
        const buffered = streamBufferRef.current
        streamBufferRef.current = ''
        if (buffered && sessionId) {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== sessionId) return s
              const updated = s.messages.map((m) =>
                m.id === targetId && m.role === 'assistant' ? { ...m, content: (m.content || '') + buffered } : m
              )
              return { ...s, messages: updated, updatedAt: Date.now() }
            })
          )
        }
        if (sessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === targetId ? { ...m, usage: estimateMessageUsage(m) } : m
                    ),
                    updatedAt: Date.now()
                  }
                : s
            )
          )
          const shouldKeepEmpty = Boolean(meta?.fallback && !meta.hasContent && !meta.fallback?.used)
          if (!shouldKeepEmpty) {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.filter((m) => m.id !== targetId || (m.content || '').trim().length > 0),
                      updatedAt: Date.now()
                    }
                  : s
              )
            )
          }
        }
        if (sessionId && toolAutoEnabled && !toolCallGuardRef.current && !toolHandledRef.current.has(targetId)) {
          const session = sessionsRef.current.find((s) => s.id === sessionId)
          const msg = session?.messages.find((m) => m.id === targetId && m.role === 'assistant')
          const content = msg?.content ?? ''
          if (content.includes('"mcp_tool"')) {
            const toolCall = extractToolCall(content)
            if (toolCall) {
              toolHandledRef.current.add(targetId)
              toolCallGuardRef.current = true
              runToolAndContinue(sessionId, toolCall).finally(() => {
                toolCallGuardRef.current = false
              })
            }
          }
        }
        if (meta?.fallback && !meta.hasContent && !meta.fallback.used) {
          meta.fallback.used = true
          if (sessionId) {
            chat({
              provider: config?.llm.provider,
              model: config?.llm.model,
              messages: meta.fallback.messages,
              temperature: config?.llm.temperature,
              maxTokens: config?.llm.maxTokens
            })
              .then((resp) => {
                const text = (resp?.content || '').trim()
                if (text) updateMessageContent(sessionId, targetId, text)
                else appendAssistantMessage(sessionId, '模型未返回内容，请重试。')
              })
              .catch((err) => {
                appendAssistantMessage(sessionId, `请求失败：${err?.message ?? '未知错误'}`)
              })
          }
        }
        setActiveStreamId(null)
        delete streamTargetRef.current[payload.streamId]
        clearStreamMeta(payload.streamId)
        stopRequestedRef.current.delete(payload.streamId)
        setBusy(false)
        return
      }
      if (payload.content) {
        if (!sessionId) return
        if (meta) meta.hasContent = true
        streamBufferRef.current += payload.content
        if (streamRafRef.current == null) {
          streamRafRef.current = window.requestAnimationFrame(() => {
            streamRafRef.current = null
            const buffered = streamBufferRef.current
            if (!buffered) return
            streamBufferRef.current = ''
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessionId) return s
                const target = s.messages.find((m) => m.id === targetId && m.role === 'assistant')
                if (target) {
                  const nextContent = (target.content || '') + buffered
                  if (
                    toolAutoEnabled &&
                    !toolCallGuardRef.current &&
                    !toolHandledRef.current.has(targetId) &&
                    nextContent.includes('"mcp_tool"')
                  ) {
                    const toolCall = extractToolCall(nextContent)
                    if (toolCall) {
                      const originalBlock = `\`\`\`json\n${JSON.stringify(
                        { mcp_tool: `${toolCall.serverId}:${toolCall.name}`, arguments: toolCall.args ?? {} },
                        null,
                        2
                      )}\n\`\`\`\n`
                      const toolContent = `${originalBlock}\n【MCP 工具调用】${toolCall.serverId}:${toolCall.name}\n\`\`\`json\n${JSON.stringify(
                        toolCall.args ?? {},
                        null,
                        2
                      )}\n\`\`\``
                      toolHandledRef.current.add(targetId)
                      toolCallGuardRef.current = true
                      setSessions((prev2) =>
                        prev2.map((s2) =>
                          s2.id === sessionId
                            ? {
                                ...s2,
                                messages: s2.messages.map((m) =>
                                  m.id === targetId ? { ...m, content: toolContent } : m
                                ),
                                updatedAt: Date.now()
                              }
                            : s2
                        )
                      )
                      runToolAndContinue(sessionId, toolCall).finally(() => {
                        toolCallGuardRef.current = false
                      })
                    }
                  }
                  return {
                    ...s,
                    messages: s.messages.map((m) => (m.id === targetId ? { ...m, content: nextContent } : m)),
                    updatedAt: Date.now()
                  }
                }
                return {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: targetId,
                      role: 'assistant',
                      content: buffered,
                      model: config?.llm.model,
                      provider: config?.llm.provider,
                      createdAt: Date.now(),
                      usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                    }
                  ],
                  updatedAt: Date.now()
                }
              })
            )
          })
        }
      }
    })
    return unsubscribe
  }, [config, toolAutoEnabled])

  const handleSend = async () => {
    if (!input.trim() || !config) return
    if (!activeSessionId) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: Date.now(),
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
          createdAt: Date.now(),
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
      const toolInstruction = await buildToolInstruction()
      const toolMsg =
        toolInstruction && config.mcp.enabled
          ? ({
              id: `tool-hint-${Date.now()}`,
              role: 'assistant',
              content: toolInstruction,
              model: config.llm.model,
              provider: config.llm.provider,
              createdAt: Date.now(),
              usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: toolInstruction })
            } as Message)
          : null
      const messageList = active ? [...active.messages, ...(toolMsg ? [toolMsg] : []), userMsg] : [userMsg]
      const filtered = messageList.filter((m) => !(m.role === 'assistant' && !m.content?.trim()))
      const streamId = await startStream({
        provider: config.llm.provider,
        model: config.llm.model,
        messages: filtered.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens
      })
      logStream('start', { streamId, type: 'user', messages: filtered.length })
      streamMetaRef.current[streamId] = { hasContent: false, sessionId: activeSessionId, targetId: streamId }
      scheduleStreamTimeout(streamId, activeSessionId, streamId)
      streamTargetRef.current[streamId] = streamId
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
                    createdAt: Date.now(),
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
        createdAt: Date.now(),
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
    logStream('stop', { streamId: activeStreamId })
    stopRequestedRef.current.add(activeStreamId)
    await stopStream(activeStreamId)
    setActiveStreamId(null)
    delete streamTargetRef.current[activeStreamId]
    clearStreamMeta(activeStreamId)
    stopRequestedRef.current.delete(activeStreamId)
    setBusy(false)
  }

  const buildToolInstruction = async () => {
    if (!config?.mcp?.enabled) return ''
    try {
      const tools = await listMcpTools()
      if (!tools.length) return ''
      const formatSchema = (schema: any) => {
        if (!schema) return 'args: {}'
        const props = schema?.properties && typeof schema.properties === 'object' ? schema.properties : {}
        const required = Array.isArray(schema?.required) ? schema.required : []
        const entries = Object.entries(props).map(([key, def]: any) => {
          const t = def?.type ?? (Array.isArray(def?.type) ? def.type.join('|') : 'any')
          return `${key}:${t}`
        })
        const argsLine = entries.length ? `args: { ${entries.join(', ')} }` : 'args: {}'
        return required.length ? `${argsLine} (required: ${required.join(', ')})` : argsLine
      }
      const lines = tools.map((t) => {
        const header = `- ${t.serverId}:${t.name}${t.description ? ` — ${t.description}` : ''}`
        const schema = formatSchema((t as any).inputSchema)
        return `${header}\n  ${schema}`
      })
      return [
        '可用的 MCP 工具如下：',
        ...lines,
        '注意：filesystem:list_directory 必须提供 path（例如 "." 或 "/Users/xxx"）。',
        '如果需要调用工具，请只输出以下 JSON（不要额外解释）：',
        '{"mcp_tool":"serverId:toolName","arguments":{}}'
      ].join('\n')
    } catch {
      return ''
    }
  }

  const extractToolCall = (content: string): { serverId: string; name: string; args: any; raw?: string } | null => {
    const fenceMatch = content.match(/```json\s*([\s\S]*?)\s*```/i)
    const raw = fenceMatch ? fenceMatch[1] : content
    const objMatch = raw.match(/\{[\s\S]*\}/)
    if (!objMatch) return null
    try {
      const rawJson = objMatch[0]
      const parsed = JSON.parse(rawJson)
      if (!parsed?.mcp_tool) return null
      const [serverId, name] = String(parsed.mcp_tool).split(':')
      if (!serverId || !name) return null
      let args = parsed.arguments
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args)
        } catch {
          // keep as-is
        }
      }
      if (args == null || (typeof args === 'object' && !Array.isArray(args) && Object.keys(args).length === 0)) {
        const { mcp_tool, arguments: _ignored, ...rest } = parsed
        if (Object.keys(rest).length > 0) args = rest
      }
      return { serverId, name, args: args ?? {}, raw: rawJson }
    } catch {
      return null
    }
  }

  const normalizeToolArgs = (serverId: string, name: string, args: any) => {
    if (serverId === 'filesystem' && name === 'list_directory') {
      if (!args || typeof args.path !== 'string' || !args.path.trim()) {
        return { ...(args ?? {}), path: '.' }
      }
    }
    return args
  }

  const runToolAndContinue = async (
    sessionId: string,
    toolCall: { serverId: string; name: string; args: any }
  ) => {
    if (!config) return
    try {
      const safeArgs = normalizeToolArgs(toolCall.serverId, toolCall.name, toolCall.args)
      const result = await callMcpTool(toolCall.serverId, toolCall.name, safeArgs)
      const toolMsg: Message = {
        id: `tool-${Date.now()}`,
        role: 'assistant',
        content: `【MCP 工具结果】\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        model: config.llm.model,
        provider: config.llm.provider,
        createdAt: Date.now(),
        usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, toolMsg], updatedAt: Date.now() } : s
        )
      )
      const session = sessionsRef.current.find((s) => s.id === sessionId)
      const mergedMessages = session ? [...session.messages, toolMsg] : [toolMsg]
      const followup: Message = {
        id: `tool-follow-${Date.now()}`,
        role: 'user',
        content: '请根据上述工具结果，简明回答用户问题。'
      }
      const messageList = [...mergedMessages, followup]
      const filtered = messageList.filter((m) => !(m.role === 'assistant' && !m.content?.trim()))
      const streamId = await startStream({
        provider: config.llm.provider,
        model: config.llm.model,
        messages: filtered.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens
      })
      logStream('start', { streamId, type: 'tool-follow', messages: filtered.length })
      streamMetaRef.current[streamId] = {
        hasContent: false,
        sessionId,
        targetId: streamId,
        fallback: {
          sessionId,
          messages: filtered.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
          used: false
        }
      }
      scheduleStreamTimeout(streamId, sessionId, streamId)
      streamTargetRef.current[streamId] = streamId
      setActiveStreamId(streamId)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
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
                    createdAt: Date.now(),
                    usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                  }
                ],
                updatedAt: Date.now()
              }
            : s
        )
      )
    } catch (err: any) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: `tool-err-${Date.now()}`,
                    role: 'assistant',
                    content: `【MCP 工具错误】\n\`\`\`text\n${err?.message ?? '未知错误'}\n\`\`\``,
                    model: config.llm.model,
                    provider: config.llm.provider,
                    createdAt: Date.now(),
                    usage: estimateMessageUsage({ id: 'tmp', role: 'assistant', content: '' })
                  }
                ],
                updatedAt: Date.now()
              }
            : s
        )
      )
    }
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
    <div className="flex h-screen bg-[var(--bg-chat,var(--bg-app))] text-[var(--text)] font-sans overflow-hidden">
      {/* --- 左侧侧边栏 --- */}
      <div className="w-64 min-w-[16rem] shrink-0 bg-[var(--bg-sidebar)] flex flex-col border-r border-[var(--border)] min-h-0">
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
              className={`px-2 py-0.5 rounded text-[11px] border ${
                toolAutoEnabled ? 'border-green-600 text-green-600' : 'border-[var(--border)] text-[var(--text-dim)]'
              }`}
              onClick={() => setToolAutoEnabled((v) => !v)}
              title="自动 MCP 工具调用"
            >
              MCP
            </button>
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
              activeStreamId={activeStreamId}
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
