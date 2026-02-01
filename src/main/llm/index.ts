import { LlmChatRequest, LlmChatResponse, LlmProvider, LlmStreamHandlers } from './types'
import { MockProvider } from './providers/mock'
import { QwenProvider } from './providers/qwen'
import { OpenAICompatibleProvider } from './providers/openai-compatible'

const providers: Record<string, LlmProvider> = {
  mock: new MockProvider(),
  qwen: new QwenProvider(),
  zhipu: new OpenAICompatibleProvider({
    id: 'zhipu',
    name: 'Zhipu (BigModel)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  }),
  minmax: new OpenAICompatibleProvider({
    id: 'minmax',
    name: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.io/v1'
  }),
  deepseek: new OpenAICompatibleProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1'
  }),
  mimo: new OpenAICompatibleProvider({
    id: 'mimo',
    name: 'Xiaomi MiMo',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1'
  }),
  kimi: new OpenAICompatibleProvider({
    id: 'kimi',
    name: 'Moonshot Kimi',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  }),
  doubao: new OpenAICompatibleProvider({
    id: 'doubao',
    name: 'Doubao (Volcengine Ark)',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  })
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
