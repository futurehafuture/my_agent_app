import React, { useEffect, useMemo, useState } from 'react'
import { chat, listProviders } from '../services/llm'
import { loadApiKey, saveApiKey } from '../services/config'
import { AppConfig } from '../services/config'

export function SettingsPanel({ config, onChange }: { config: AppConfig; onChange: (c: AppConfig) => void }) {
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [validateStatus, setValidateStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [validateMsg, setValidateMsg] = useState('')

  const qwenModels = useMemo(
    () => ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long', 'qwen-omni-turbo'],
    []
  )

  useEffect(() => {
    listProviders().then(setProviders)
  }, [])

  useEffect(() => {
    loadApiKey(config.llm.provider).then((key) => {
      setApiKey(key ?? '')
    })
  }, [config.llm.provider])

  const saveKey = async () => {
    await saveApiKey(config.llm.provider, apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  const validate = async () => {
    setValidateStatus('checking')
    setValidateMsg('')
    try {
      await saveApiKey(config.llm.provider, apiKey)
      await chat({
        provider: config.llm.provider,
        model: config.llm.model,
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
        temperature: 0
      })
      setValidateStatus('ok')
      setValidateMsg('可用')
    } catch (err: any) {
      setValidateStatus('fail')
      setValidateMsg(err?.message ?? '失败')
    }
  }

  return (
    <div className="p-4 border border-gray-700 rounded-xl bg-[#2A2B32] text-sm">
      <div className="text-xs text-gray-400 mb-3">模型设置</div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">模型厂商</span>
          <select
            className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
            value={config.llm.provider}
            onChange={(e) => onChange({ ...config, llm: { ...config.llm, provider: e.target.value } })}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">模型</span>
          {config.llm.provider === 'qwen' ? (
            <select
              className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
              value={config.llm.model}
              onChange={(e) => onChange({ ...config, llm: { ...config.llm, model: e.target.value } })}
            >
              {qwenModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
              value={config.llm.model}
              onChange={(e) => onChange({ ...config, llm: { ...config.llm, model: e.target.value } })}
            />
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Base URL</span>
          <input
            className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
            value={config.llm.baseUrl ?? ''}
            onChange={(e) => onChange({ ...config, llm: { ...config.llm, baseUrl: e.target.value } })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Temperature</span>
            <input
              className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={config.llm.temperature ?? 0.7}
              onChange={(e) =>
                onChange({ ...config, llm: { ...config.llm, temperature: Number(e.target.value) } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Max Tokens</span>
            <input
              className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
              type="number"
              min="1"
              step="1"
              value={config.llm.maxTokens ?? 1024}
              onChange={(e) =>
                onChange({ ...config, llm: { ...config.llm, maxTokens: Number(e.target.value) } })
              }
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">API Key</span>
          <input
            className="bg-[#40414F] border border-gray-600 rounded px-3 py-2"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-2">
          <button onClick={saveKey} className="px-3 py-2 rounded bg-green-600 hover:bg-green-700">
            保存 Key
          </button>
          <button
            onClick={validate}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            disabled={validateStatus === 'checking'}
          >
            {validateStatus === 'checking' ? '校验中...' : '校验'}
          </button>
          {saved ? <span className="text-xs text-green-400">已保存</span> : null}
          {validateStatus !== 'idle' ? (
            <span className={`text-xs ${validateStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {validateMsg}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
