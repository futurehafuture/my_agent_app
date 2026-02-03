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
      search: {
        query: (q: string) => Promise<
          {
            title: string
            link: string
            snippet: string
          }[]
        >
      }
      keys: {
        save: (provider: string, apiKey: string) => Promise<boolean>
        load: (provider: string) => Promise<string | undefined>
      }
      mcp: {
        reload: () => Promise<boolean>
        getConfig: () => Promise<any>
        saveConfig: (cfg: any) => Promise<boolean>
        servers: () => Promise<
          {
            id: string
            status: 'disconnected' | 'connecting' | 'connected' | 'error'
            transport: 'stdio' | 'streamable_http'
            config: any
            error?: string
          }[]
        >
        tools: () => Promise<{ id: string; serverId: string; name: string; description?: string }[]>
        callTool: (serverId: string, name: string, args: any) => Promise<any>
        resources: () => Promise<{ serverId: string; uri: string; name?: string; description?: string }[]>
        readResource: (serverId: string, uri: string) => Promise<any>
        prompts: () => Promise<{ serverId: string; name: string; description?: string }[]>
        getPrompt: (serverId: string, name: string, args?: Record<string, string>) => Promise<any>
      }
      chat: {
        load: () => Promise<any[]>
        save: (messages: any[]) => Promise<boolean>
      }
      app: {
        ready: () => void
      }
    }
  }
}
