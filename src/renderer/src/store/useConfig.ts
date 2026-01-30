import { useEffect, useState } from 'react'
import { AppConfig, loadConfig, saveConfig } from '../services/config'

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg)
      setLoading(false)
    })
  }, [])

  const updateConfig = async (next: AppConfig) => {
    setConfig(next)
    await saveConfig(next)
  }

  return { config, loading, updateConfig }
}
