import React, { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Send, Monitor, Paperclip } from 'lucide-react'
import { AppConfig } from '../services/config'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const countChars = (text: string) => text.replace(/\s+/g, '').length

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

export function ChatPage({
  messages,
  input,
  setInput,
  busy,
  onSend,
  onStop,
  config
}: {
  messages: Message[]
  input: string
  setInput: (v: string) => void
  busy: boolean
  onSend: () => void
  onStop: () => void
  config: AppConfig
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  let turnIndex = 0
  const totalChars = messages.reduce((sum, m) => sum + countChars(m.content), 0)

  return (
    <div className="flex flex-col relative h-full min-h-0">
      <div className="absolute top-0 left-0 w-full h-8 draggable z-10" />

      <div className="shrink-0 px-4 pt-6 pb-1 border-b border-gray-700/40">
        <div className="max-w-4xl mx-auto w-full text-xs text-gray-300">当前对话总字数：{totalChars}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-3 space-y-6 scroll-smooth min-h-0 pb-28">
        {messages.map((msg) =>
          (() => {
            const turn = msg.role === 'user' ? ++turnIndex : turnIndex
            const showTurn = turn > 0
            const modelName = config.llm.model || 'model'
            const avatarText = msg.role === 'assistant' ? modelName.slice(0, 2).toUpperCase() : 'Me'
            const chars = countChars(msg.content)
            return (
              <div key={msg.id} className="max-w-4xl mx-auto w-full">
                <div
                  className={`flex gap-4 rounded-xl px-5 py-4 ${
                    msg.role === 'assistant' ? 'bg-[#444654]' : 'bg-[#3A3B44]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${
                      msg.role === 'assistant' ? 'bg-green-500' : 'bg-indigo-500'
                    }`}
                  >
                    {avatarText}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-2">
                      {showTurn ? `第 ${turn} 轮` : '引导'}
                      {msg.role === 'assistant' ? ` · ${modelName}` : ''}
                      {` · ${chars} 字`}
                    </div>
                    <div className="prose prose-invert max-w-none text-sm leading-6 select-text">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {preprocessMath(msg.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-4 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10">
        <div className="max-w-3xl mx-auto bg-[#40414F] rounded-xl shadow-lg border border-gray-600 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
            placeholder="发送消息给 Agent..."
            className="w-full bg-transparent text-white p-4 pr-12 outline-none resize-none h-[56px] max-h-[200px]"
            style={{ minHeight: '56px' }}
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
              className="absolute right-3 bottom-3 p-1 rounded-md bg-green-600 hover:bg-green-700 transition-colors text-white disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">LLM Agent Desktop Preview</div>
      </div>

      <div className="absolute bottom-24 right-8 flex flex-col gap-2">
        <button className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 shadow-lg text-white tooltip" title="截取屏幕">
          <Monitor size={20} />
        </button>
        <button className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 shadow-lg text-white" title="上传文件">
          <Paperclip size={20} />
        </button>
      </div>
    </div>
  )
}
