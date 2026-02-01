import { approximateTokenSize } from 'tokenx'
import type { Message } from '../pages/ChatPage'

export type Usage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export function estimateTextTokens(text: string): number {
  return approximateTokenSize(text || '')
}

export function estimateMessageUsage(message: Message): Usage {
  const tokens = estimateTextTokens(message.content || '')
  return {
    prompt_tokens: tokens,
    completion_tokens: tokens,
    total_tokens: tokens
  }
}

export function estimateHistoryTokens(messages: Message[]): number {
  return messages.reduce((acc, message) => {
    if (message.usage) {
      const inputTokens = message.usage.total_tokens ?? 0
      const outputTokens = message.usage.completion_tokens ?? 0
      return acc + (message.role === 'user' ? inputTokens : outputTokens)
    }
    const tokens = estimateTextTokens(message.content || '')
    return acc + tokens
  }, 0)
}
