import { LlmChatRequest, LlmChatResponse, LlmProvider, LlmStreamHandlers } from '../types'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export class QwenProvider implements LlmProvider {
  id = 'qwen'
  name = 'Qwen (DashScope)'

  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    if (!req.apiKey) {
      throw new Error('Missing API key for Qwen')
    }

    const baseUrl = (req.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    const payload = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Qwen API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ''

    return {
      id: data?.id ?? `qwen-${Date.now()}`,
      content,
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens
      }
    }
  }

  async streamChat(req: LlmChatRequest, handlers: LlmStreamHandlers, signal?: AbortSignal): Promise<void> {
    if (!req.apiKey) {
      throw new Error('Missing API key for Qwen')
    }

    const baseUrl = (req.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`

    const payload = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.apiKey}`
      },
      body: JSON.stringify(payload),
      signal
    })

    if (!res.ok || !res.body) {
      const text = await res.text()
      throw new Error(`Qwen API error ${res.status}: ${text}`)
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    const reader = res.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const lines = part.split('\n').map((l) => l.trim())
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data) continue
            if (data === '[DONE]') {
              handlers.onDone()
              return
            }
            try {
              const json = JSON.parse(data)
              const delta = json?.choices?.[0]?.delta?.content
              if (delta) handlers.onChunk(delta)
            } catch (err: any) {
              handlers.onError(err instanceof Error ? err : new Error('Invalid SSE JSON'))
            }
          }
        }
      }
      handlers.onDone()
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        handlers.onDone()
        return
      }
      handlers.onError(err instanceof Error ? err : new Error('Stream error'))
    }
  }
}
