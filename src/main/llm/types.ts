export type LlmRole = 'user' | 'assistant' | 'system'

export type LlmMessage = {
  role: LlmRole
  content: string
}

export type LlmChatRequest = {
  provider: string
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
  apiKey?: string
  baseUrl?: string
}

export type LlmStreamHandlers = {
  onChunk: (content: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export type LlmChatResponse = {
  id: string
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export type LlmProviderConfig = {
  provider: string
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
}

export interface LlmProvider {
  id: string
  name: string
  chat(req: LlmChatRequest): Promise<LlmChatResponse>
  streamChat?: (req: LlmChatRequest, handlers: LlmStreamHandlers, signal?: AbortSignal) => Promise<void>
}
