import { LlmChatRequest, LlmChatResponse, LlmProvider, LlmStreamHandlers } from './types'
import { MockProvider } from './providers/mock'
import { QwenProvider } from './providers/qwen'

const providers: Record<string, LlmProvider> = {
  mock: new MockProvider(),
  qwen: new QwenProvider()
}

export function listProviders(): { id: string; name: string }[] {
  return Object.values(providers).map((p) => ({ id: p.id, name: p.name }))
}

export async function chat(req: LlmChatRequest): Promise<LlmChatResponse> {
  const provider = providers[req.provider]
  if (!provider) {
    throw new Error(`Unknown provider: ${req.provider}`)
  }
  return provider.chat(req)
}

export async function streamChat(
  req: LlmChatRequest,
  handlers: LlmStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const provider = providers[req.provider]
  if (!provider || !provider.streamChat) {
    throw new Error(`Streaming not supported for provider: ${req.provider}`)
  }
  return provider.streamChat(req, handlers, signal)
}
