export type LlmMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type LlmChatRequest = {
  provider: string
  model: string
  messages: LlmMessage[]
  temperature?: number
  maxTokens?: number
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

export async function listProviders() {
  return window.api.llm.listProviders()
}

export async function searchWeb(query: string) {
  const mod = window.api.search
  if (!mod || typeof mod.query !== 'function') {
    throw new Error('搜索模块未就绪，请重启应用后再试')
  }
  return mod.query(query)
}

export async function listModels(req: { provider: string; baseUrl?: string }): Promise<string[]> {
  const fn = window.api.llm.listModels
  if (typeof fn !== 'function') {
    throw new Error('模型列表接口不可用，请重启应用以更新预加载')
  }
  return fn(req)
}

export async function chat(req: LlmChatRequest): Promise<LlmChatResponse> {
  return window.api.llm.chat(req)
}

export async function startStream(req: LlmChatRequest): Promise<string> {
  return window.api.llm.startStream(req)
}

export async function stopStream(streamId: string): Promise<boolean> {
  return window.api.llm.stopStream(streamId)
}

export function onStreamChunk(
  cb: (payload: { streamId: string; content?: string; done?: boolean; error?: string }) => void
) {
  return window.api.llm.onStreamChunk(cb)
}
