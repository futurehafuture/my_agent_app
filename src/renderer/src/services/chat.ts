import { Message } from '../pages/ChatPage'

export type ChatSession = {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export async function loadChat(): Promise<ChatSession[]> {
  return window.api.chat.load()
}

export async function saveChat(sessions: ChatSession[]): Promise<boolean> {
  // App.tsx loads chat history asynchronously while the initial React state is [].
  // Do not persist that transient empty array, otherwise a cold start can overwrite
  // existing conversations before loadChat() has completed.
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return false
  }
  return window.api.chat.save(sessions)
}
