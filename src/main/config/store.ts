import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

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

const defaultConfig: AppConfig = {
  llm: {
    provider: 'qwen',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    temperature: 0.7,
    maxTokens: 1024
  },
  mcp: {
    enabled: true,
    configPath: ''
  }
}

const configFile = () => join(app.getPath('userData'), 'config.json')

export function loadConfig(): AppConfig {
  const file = configFile()
  if (!existsSync(file)) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify(defaultConfig, null, 2))
    return { ...defaultConfig }
  }

  try {
    const raw = readFileSync(file, 'utf-8')
    return { ...defaultConfig, ...JSON.parse(raw) }
  } catch {
    return { ...defaultConfig }
  }
}

export function saveConfig(config: AppConfig): void {
  const file = configFile()
  writeFileSync(file, JSON.stringify(config, null, 2))
}

const keyFile = () => join(app.getPath('userData'), 'keys.dat')

type KeyStore = Record<string, string>

export function saveApiKey(provider: string, apiKey: string): void {
  const store = loadKeyStore()
  store[provider] = apiKey
  persistKeyStore(store)
}

export function loadApiKey(provider: string): string | undefined {
  const store = loadKeyStore()
  return store[provider]
}

function loadKeyStore(): KeyStore {
  const file = keyFile()
  if (!existsSync(file)) return {}
  try {
    const raw = readFileSync(file)
    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(raw.toString('utf-8'))
    }
    const decrypted = safeStorage.decryptString(raw)
    return JSON.parse(decrypted)
  } catch {
    return {}
  }
}

function persistKeyStore(store: KeyStore): void {
  const file = keyFile()
  const payload = JSON.stringify(store)
  if (!safeStorage.isEncryptionAvailable()) {
    writeFileSync(file, payload)
    return
  }
  const encrypted = safeStorage.encryptString(payload)
  writeFileSync(file, encrypted)
}
