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
}

export async function listProviders() {
  return window.api.llm.listProviders()
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
