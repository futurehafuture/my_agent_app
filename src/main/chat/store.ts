import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const chatFile = () => join(app.getPath('userData'), 'chat.json')

const defaultSession = (): ChatSession => ({
  id: `s-${Date.now()}`,
  title: '新对话',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
})

export function loadChat(): ChatSession[] {
  const file = chatFile()
  if (!existsSync(file)) return []
  try {
    const raw = readFileSync(file, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      // Backward-compat: array of messages -> wrap into one session
      if (data.length && data[0]?.role) {
        const session = defaultSession()
        session.messages = data as ChatMessage[]
        return [session]
      }
      return data as ChatSession[]
    }
    return []
  } catch {
    return []
  }
}

export function saveChat(sessions: ChatSession[]): void {
  const file = chatFile()
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(sessions, null, 2))
}
