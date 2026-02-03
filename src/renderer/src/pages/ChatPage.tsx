import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Send, Monitor, Paperclip, Copy, Pencil, Save, X, User, Bot } from 'lucide-react'
import { AppConfig } from '../services/config'
import { estimateHistoryTokens, estimateTextTokens } from '../services/TokenService'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  provider?: string
  createdAt?: number
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

  const preprocessMath = (input: string) => {
  let out = input
  out = out.replace(/\\\((.+?)\\\)/g, (_m, expr) => `$${expr}$`)
  out = out.replace(/\\\[((?:.|\n)*?)\\\]/g, (_m, expr) => `$$${expr}$$`)
  out = out.replace(/\(([^()]*)\)/g, (m, expr) => {
    const trimmed = String(expr).trim()
    if (!trimmed) return m
    const looksMath =
      /\\(frac|sqrt|sum|int|gamma|alpha|beta|cdot|times|quad|text|left|right|zeta|pi|displaystyle)/.test(
        trimmed
      ) || /[=^_]/.test(trimmed)
    if (!looksMath) return m
    const asBlock = /\\(displaystyle|frac|sum|int)/.test(trimmed)
    return asBlock ? `$$${trimmed}$$` : `$${trimmed}$`
  })
  out = out.replace(/\[(.*?)\]/g, (m, expr) => {
    const trimmed = String(expr).trim()
    if (!trimmed) return m
    const looksMath =
      /\\(frac|sqrt|sum|int|gamma|alpha|beta|cdot|times|quad|text|left|right)/.test(trimmed) ||
      /[=^_]/.test(trimmed)
    return looksMath ? `$$${trimmed}$$` : m
  })
  return out
}

const formatMessageTime = (ts?: number) => {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ChatPage({
  messages,
  input,
  setInput,
  busy,
  activeStreamId,
  onSend,
  onStop,
  onUpdateMessage,
  config
}: {
  messages: Message[]
  input: string
  setInput: (v: string) => void
  busy: boolean
  activeStreamId: string | null
  onSend: () => void
  onStop: () => void
  onUpdateMessage: (id: string, content: string) => void
  config: AppConfig
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesWrapRef = useRef<HTMLDivElement>(null)
  const [stickToBottom, setStickToBottom] = useState(true)
  const autoScrollRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const scrollToBottom = (behavior: ScrollBehavior) => {
    autoScrollRef.current = true
    messagesEndRef.current?.scrollIntoView({ behavior })
    window.setTimeout(() => {
      autoScrollRef.current = false
    }, 0)
  }

  useEffect(() => {
    if (!stickToBottom) return
    scrollToBottom(activeStreamId ? 'auto' : 'smooth')
  }, [messages, stickToBottom, activeStreamId])
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, 200)
    el.style.height = `${next}px`
  }, [input])

  let turnIndex = 0
  const totalTokens = useMemo(() => estimateHistoryTokens(messages), [messages])

  const replaceCodeBlock = (content: string, index: number, nextCode: string, lang?: string) => {
    let i = 0
    const re = /```([^\n]*)\n([\s\S]*?)```/g
    return content.replace(re, (_m, l, code) => {
      if (i !== index) {
        i += 1
        return `\`\`\`${l}\n${code}\`\`\``
      }
      i += 1
      const label = lang ?? l ?? ''
      return `\`\`\`${label}\n${nextCode}\`\`\``
    })
  }

  const extractToolSections = (content: string) => {
    const sections: { main: string; call?: string; result?: string; error?: string; answer?: string } = { main: content }
    const markers = Array.from(content.matchAll(/\n(【MCP 工具调用】|【MCP 工具结果】|【MCP 工具错误】|【回答】)/g))
    if (!markers.length) return sections
    sections.main = content.slice(0, markers[0].index).trim()
    for (let i = 0; i < markers.length; i += 1) {
      const marker = markers[i][1]
      const start = (markers[i].index ?? 0) + marker.length + 1
      const end = i + 1 < markers.length ? markers[i + 1].index ?? content.length : content.length
      const body = content.slice(start, end).trim()
      if (marker === '【MCP 工具调用】') sections.call = body
      if (marker === '【MCP 工具结果】') sections.result = body
      if (marker === '【MCP 工具错误】') sections.error = body
      if (marker === '【回答】') sections.answer = body
    }
    return sections
  }

  const renderToolSection = (title: string, body?: string) => {
    if (!body) return null
    const fenceMatch = body.match(/```[a-z]*\s*([\s\S]*?)\s*```/i)
    const text = fenceMatch ? fenceMatch[1].trim() : body.trim()
    return (
      <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input-soft)]">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs text-[var(--text-muted)]">{title}</summary>
        <pre className="overflow-x-auto text-xs text-[var(--text)] p-3">
          <code className="font-mono whitespace-pre-wrap break-words">{text}</code>
        </pre>
      </details>
    )
  }

  const renderAnswer = (body?: string) => {
    if (!body) return null
    return (
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3">
        <div className="text-xs text-[var(--text-muted)] mb-2">回答</div>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {body}
        </ReactMarkdown>
      </div>
    )
  }

  const CodeBlock = ({
    code,
    lang,
    msgId,
    blockIndex
  }: {
    code: string
    lang?: string
    msgId: string
    blockIndex: number
  }) => {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(code)
    const [copied, setCopied] = useState(false)

    useEffect(() => setDraft(code), [code])

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1000)
      } catch {
        // ignore
      }
    }

    const handleSave = () => {
      const msg = messages.find((m) => m.id === msgId)
      if (!msg) return
      const next = replaceCodeBlock(msg.content, blockIndex, draft, lang)
      onUpdateMessage(msgId, next)
      setEditing(false)
    }

    return (
      <div className="my-3 rounded-lg border border-[var(--border)] bg-[var(--bg-input-soft)]">
        <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
          <span>{lang || 'code'}</span>
          <div className="flex items-center gap-2">
            <button className="text-[var(--text-soft)] hover:text-[var(--text)]" onClick={handleCopy}>
              {copied ? '已复制' : '复制'}
            </button>
            <button className="text-[var(--text-soft)] hover:text-[var(--text)]" onClick={() => setEditing((v) => !v)}>
              {editing ? '取消' : '编辑'}
            </button>
            {editing ? (
              <button className="text-green-500 hover:text-green-400" onClick={handleSave}>
                保存
              </button>
            ) : null}
          </div>
        </div>
        {editing ? (
          <textarea
            className="w-full bg-transparent text-xs font-mono text-[var(--text)] p-3 outline-none resize-y min-h-[120px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <pre className="overflow-x-auto text-xs text-[var(--text)] p-3">
            <code className="font-mono">{code}</code>
          </pre>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col relative h-full min-h-0">
      <div className="absolute top-0 left-0 w-full h-8 draggable z-10" />

      <div className="shrink-0 px-4 pt-6 pb-1 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto w-full text-xs text-[var(--text-soft)]">当前对话总 Token：{totalTokens}</div>
      </div>

      <div
        ref={messagesWrapRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-3 space-y-6 scroll-smooth min-h-0 pb-28"
        onScroll={() => {
          const el = messagesWrapRef.current
          if (!el) return
          if (autoScrollRef.current) return
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          setStickToBottom(nearBottom)
        }}
      >
        {messages.map((msg) =>
          (() => {
            const turn = msg.role === 'user' ? ++turnIndex : turnIndex
            const showTurn = turn > 0
            const modelName = msg.model || (msg.role === 'assistant' ? '未记录模型' : '')
            const tokenLabel =
              msg.usage?.total_tokens != null ? `${msg.usage?.total_tokens} Token` : `${estimateTextTokens(msg.content)} Token`
            const timeLabel = formatMessageTime(msg.createdAt)
            let codeIndex = 0
            return (
              <div key={msg.id} className="max-w-4xl mx-auto w-full min-w-0">
                <div
                  className={`flex gap-4 rounded-xl px-5 py-4 min-w-0 ${
                    msg.role === 'assistant' ? 'bg-[var(--bg-card-ai)]' : 'bg-[var(--bg-card-user)]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${
                      msg.role === 'assistant' ? 'bg-[var(--avatar-bot)]' : 'bg-[var(--avatar-user)]'
                    }`}
                  >
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-muted)] mb-2">
                      {showTurn ? `第 ${turn} 轮` : '引导'}
                      {msg.role === 'assistant' ? ` · ${modelName}` : ''}
                      {` · ${tokenLabel}`}
                      {timeLabel ? ` · ${timeLabel}` : ''}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
                      <div className="relative group">
                        <button
                          className="p-1 rounded hover:bg-[var(--bg-panel)] hover:text-[var(--text)]"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(msg.content)
                              setCopiedMessageId(msg.id)
                              setTimeout(() => setCopiedMessageId(null), 1000)
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-soft)] opacity-0 shadow-sm group-hover:opacity-100">
                          {copiedMessageId === msg.id ? '已复制' : '复制回答'}
                        </div>
                      </div>
                      <div className="relative group">
                        <button
                          className="p-1 rounded hover:bg-[var(--bg-panel)] hover:text-[var(--text)]"
                          onClick={() => {
                            if (editingMessageId === msg.id) {
                              setEditingMessageId(null)
                              return
                            }
                            setEditingMessageId(msg.id)
                            setEditDraft(msg.content)
                          }}
                        >
                          {editingMessageId === msg.id ? <X size={14} /> : <Pencil size={14} />}
                        </button>
                        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-soft)] opacity-0 shadow-sm group-hover:opacity-100">
                          {editingMessageId === msg.id ? '取消编辑' : '编辑回答'}
                        </div>
                      </div>
                      {editingMessageId === msg.id ? (
                        <div className="relative group">
                          <button
                            className="p-1 rounded hover:bg-[var(--bg-panel)] text-green-500 hover:text-green-400"
                            onClick={() => {
                              onUpdateMessage(msg.id, editDraft)
                              setEditingMessageId(null)
                            }}
                          >
                            <Save size={14} />
                          </button>
                          <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-soft)] opacity-0 shadow-sm group-hover:opacity-100">
                            保存
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {editingMessageId === msg.id ? (
                      <textarea
                        className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded p-3 text-sm leading-6 text-[var(--text)] outline-none resize-y min-h-[120px]"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                      />
                    ) : (
                      <div className="max-w-none text-sm leading-6 select-text text-[var(--text)] break-words">
                        {(() => {
                          const sections = extractToolSections(preprocessMath(msg.content))
                          return (
                            <>
                              <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p({ children }) {
                              return <p className="mb-3 last:mb-0">{children}</p>
                            },
                            h1({ children }) {
                              return <h1 className="text-base font-semibold mt-4 mb-2">{children}</h1>
                            },
                            h2({ children }) {
                              return <h2 className="text-sm font-semibold mt-4 mb-2">{children}</h2>
                            },
                            h3({ children }) {
                              return <h3 className="text-sm font-semibold mt-3 mb-2">{children}</h3>
                            },
                            ul({ children }) {
                              return <ul className="mb-3 pl-5 list-disc">{children}</ul>
                            },
                            ol({ children }) {
                              return <ol className="mb-3 pl-5 list-decimal">{children}</ol>
                            },
                            table({ children }) {
                              return (
                                <div className="overflow-x-auto">
                                  <table className="markdown-table">{children}</table>
                                </div>
                              )
                            },
                            li({ children }) {
                              return <li className="mb-1">{children}</li>
                            },
                            blockquote({ children }) {
                              return (
                                <blockquote className="border-l-2 border-[var(--border)] pl-3 text-[var(--text-soft)] mb-3">
                                  {children}
                                </blockquote>
                              )
                            },
                            code({ inline, className, children }) {
                              const match = /language-(\w+)/.exec(className || '')
                              if (inline) {
                                return (
                                  <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded text-[12px]">
                                    {children}
                                  </code>
                                )
                              }
                              const raw = String(children).replace(/\n$/, '')
                              if (!match && !raw.includes('\n') && raw.length <= 40) {
                                return (
                                  <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded text-[12px]">
                                    {raw}
                                  </code>
                                )
                              }
                              const lang = match?.[1]
                              const idx = codeIndex
                              codeIndex += 1
                              return (
                                <CodeBlock
                                  code={raw}
                                  lang={lang}
                                  msgId={msg.id}
                                  blockIndex={idx}
                                />
                              )
                            }
                          }}
                        >
                          {sections.main}
                              </ReactMarkdown>
                              {renderToolSection('MCP 工具调用', sections.call)}
                              {renderToolSection('MCP 工具结果', sections.result)}
                              {renderToolSection('MCP 工具错误', sections.error)}
                              {renderAnswer(sections.answer)}
                              {msg.id === activeStreamId ? <span className="typing-caret" /> : null}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-4 bg-gradient-to-t from-[var(--bg-app)] via-[var(--bg-app)] to-transparent pt-10">
        <div className="max-w-3xl mx-auto bg-[var(--bg-input)] rounded-2xl shadow-[0_10px_34px_rgba(15,23,42,0.08)] border border-[var(--border)] relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="和我说点什么吧～  给 Agent 发消息，Enter 换行，Ctrl/Cmd+Enter 发送"
            className="w-full bg-transparent text-[var(--text)] p-4 pr-12 outline-none resize-none min-h-[56px] max-h-[200px] overflow-y-auto"
            rows={1}
          />
          {busy ? (
            <button
              onClick={onStop}
              className="absolute right-3 bottom-3 p-1 rounded-md bg-red-600 hover:bg-red-700 transition-colors text-white disabled:opacity-50"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={onSend}
              className="absolute right-3 bottom-3 p-1 rounded-md bg-green-600 hover:bg-green-700 transition-colors text-white disabled:opacity-50 shadow-sm"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="text-center text-xs text-[var(--text-dim)] mt-2">LLM Agent Desktop Preview</div>
      </div>

      <div className="absolute bottom-24 right-8 flex flex-col gap-2">
        <button
          className="p-3 bg-[var(--bg-input)] rounded-full hover:bg-[var(--bg-panel)] shadow-lg text-[var(--text)] tooltip"
          title="截取屏幕"
        >
          <Monitor size={20} />
        </button>
        <button
          className="p-3 bg-[var(--bg-input)] rounded-full hover:bg-[var(--bg-panel)] shadow-lg text-[var(--text)]"
          title="上传文件"
        >
          <Paperclip size={20} />
        </button>
      </div>
    </div>
  )
}
