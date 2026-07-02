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
  if (!Array.isArray(sessions)) {
    return false
  }
  return window.api.chat.save(sessions)
}
