export {}

declare global {
  interface Window {
    electron: typeof import('@electron-toolkit/preload').electronAPI
    api: {
      llm: {
        listProviders: () => Promise<{ id: string; name: string }[]>
        listModels: (req: { provider: string; baseUrl?: string }) => Promise<string[]>
        chat: (req: any) => Promise<any>
        startStream: (req: any) => Promise<string>
        stopStream: (streamId: string) => Promise<boolean>
        onStreamChunk: (
          cb: (payload: { streamId: string; content?: string; done?: boolean; error?: string }) => void
        ) => () => void
      }
      config: {
        load: () => Promise<any>
        save: (config: any) => Promise<boolean>
      }
      keys: {
        save: (provider: string, apiKey: string) => Promise<boolean>
        load: (provider: string) => Promise<string | undefined>
      }
      chat: {
        load: () => Promise<any[]>
        save: (messages: any[]) => Promise<boolean>
      }
    }
  }
}
