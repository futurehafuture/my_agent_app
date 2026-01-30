export type AppConfig = {
  llm: {
    provider: string
    model: string
    baseUrl?: string
    temperature?: number
    maxTokens?: number
  }
  mcp: {
    enabled: boolean
    configPath: string
  }
}

export async function loadConfig(): Promise<AppConfig> {
  return window.api.config.load()
}

export async function saveConfig(config: AppConfig): Promise<boolean> {
  return window.api.config.save(config)
}

export async function saveApiKey(provider: string, apiKey: string): Promise<boolean> {
  return window.api.keys.save(provider, apiKey)
}

export async function loadApiKey(provider: string): Promise<string | undefined> {
  return window.api.keys.load(provider)
}
