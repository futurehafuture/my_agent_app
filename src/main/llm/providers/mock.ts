import { LlmChatRequest, LlmChatResponse, LlmProvider } from '../types'

export class MockProvider implements LlmProvider {
  id = 'mock'
  name = 'Mock Provider'

  async chat(req: LlmChatRequest): Promise<LlmChatResponse> {
    const last = req.messages[req.messages.length - 1]
    const content = last ? `模拟回复：${last.content}` : '模拟回复：空消息'
    return {
      id: `mock-${Date.now()}`,
      content
    }
  }
}
