import React, { useEffect, useMemo, useState } from 'react'
import { chat, listModels, listProviders } from '../services/llm'
import { loadApiKey, saveApiKey } from '../services/config'
import { AppConfig } from '../services/config'

export function SettingsPanel({ config, onChange }: { config: AppConfig; onChange: (c: AppConfig) => void }) {
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [validateStatus, setValidateStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [validateMsg, setValidateMsg] = useState('')
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [remoteModels, setRemoteModels] = useState<string[]>([])
  const [editingModels, setEditingModels] = useState(false)
  const [modelDrafts, setModelDrafts] = useState<string[]>([])

  const providerModels = useMemo(
    () => ({
      qwen: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long', 'qwen-omni-turbo'],
      zhipu: [
        'glm-4.7',
        'glm-4.7-flash',
        'glm-4.7-flashx',
        'glm-4.6',
        'glm-4.5-air',
        'glm-4.5-airx',
        'glm-4.5-flash',
        'glm-4-flash-250414',
        'glm-4-flashx-250414'
      ],
      minmax: ['MiniMax-M2.1', 'MiniMax-M2.1-lightning', 'MiniMax-M2'],
      deepseek: ['deepseek-chat', 'deepseek-reasoner'],
      mimo: ['mimo-v2-flash'],
      kimi: ['kimi-latest', 'kimi-thinking-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
      doubao: [
        'doubao-1.5-pro-32k',
        'doubao-1-5-pro-32k-250115',
        'doubao-1-5-pro-32k-character-250715',
        'doubao-1-5-pro-32k-character-250228',
        'doubao-1.5-lite-32k',
        'doubao-1-5-lite-32k-250115',
        'doubao-1.5-thinking-pro',
        'doubao-1-5-thinking-pro-250415',
        'doubao-1-5-thinking-pro-m-250428',
        'doubao-1.5-thinking-vision-pro',
        'doubao-1-5-thinking-vision-pro-250428',
        'doubao-1.5-vision-pro',
        'doubao-1-5-vision-pro-250328',
        'doubao-1-5-vision-pro-32k-250115'
      ]
    }),
    []
  )
  const providerDocs = useMemo(
    () => ({
      qwen: 'https://bailian.console.aliyun.com/',
      zhipu: 'https://bigmodel.cn/',
      minmax: 'https://platform.minimaxi.com/docs/guides/models-intro',
      deepseek: 'https://api-docs.deepseek.com/zh-cn/',
      mimo: 'https://platform.xiaomimimo.com/',
      kimi: 'https://platform.moonshot.cn/docs',
      doubao: 'https://www.volcengine.com/docs/82379'
    }),
    []
  )
  const providerBaseUrls = useMemo(
    () => ({
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      minmax: 'https://api.minimax.io/v1',
      deepseek: 'https://api.deepseek.com/v1',
      mimo: 'https://api.xiaomimimo.com/v1',
      kimi: 'https://api.moonshot.cn/v1',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3'
    }),
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

  useEffect(() => {
    setModelsError('')
    setRemoteModels([])
  }, [config.llm.provider, providerModels])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!apiKey && config.llm.provider !== 'kimi') return
      setModelsLoading(true)
      setModelsError('')
      try {
        const remote = await listModels({ provider: config.llm.provider, baseUrl: config.llm.baseUrl })
        if (!active) return
        if (Array.isArray(remote) && remote.length) {
          setRemoteModels(remote)
        }
      } catch (err: any) {
        if (!active) return
        setModelsError(err?.message ?? '模型列表获取失败')
        setRemoteModels([])
      } finally {
        if (!active) return
        setModelsLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [apiKey, config.llm.provider, config.llm.baseUrl])

  const overrideModels = config.llm.modelOverrides?.[config.llm.provider] ?? []
  const staticModels = providerModels[config.llm.provider as keyof typeof providerModels] ?? []
  const resolvedModels = overrideModels.length ? overrideModels : remoteModels.length ? remoteModels : staticModels

  useEffect(() => {
    if (!resolvedModels.length) return
    if (resolvedModels.includes(config.llm.model)) return
    onChange({ ...config, llm: { ...config.llm, model: resolvedModels[0] } })
  }, [resolvedModels, config, onChange])

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
    <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-panel)] text-sm">
      <div className="text-xs text-[var(--text-muted)] mb-3">模型设置</div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">模型厂商</span>
          <select
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
            value={config.llm.provider}
            onChange={(e) => {
              const provider = e.target.value
              const baseUrl = providerBaseUrls[provider as keyof typeof providerBaseUrls] ?? ''
              const defaults = providerModels[provider as keyof typeof providerModels] ?? []
              const model = defaults[0] ?? config.llm.model
              onChange({ ...config, llm: { ...config.llm, provider, baseUrl, model } })
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">模型</span>
          {resolvedModels.length ? (
            <select
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
              value={config.llm.model}
              onChange={(e) => onChange({ ...config, llm: { ...config.llm, model: e.target.value } })}
            >
              {resolvedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
              value={config.llm.model}
              onChange={(e) => onChange({ ...config, llm: { ...config.llm, model: e.target.value } })}
            />
          )}
          {modelsLoading ? <span className="text-xs text-[var(--text-dim)]">模型列表加载中...</span> : null}
          {!modelsLoading && modelsError ? <span className="text-xs text-red-500">{modelsError}</span> : null}
        </label>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>API 文档</span>
          {providerDocs[config.llm.provider as keyof typeof providerDocs] ? (
            <a
              className="text-[var(--link)] hover:opacity-80 underline underline-offset-2"
              href={providerDocs[config.llm.provider as keyof typeof providerDocs]}
              target="_blank"
              rel="noreferrer"
            >
              打开平台
            </a>
          ) : (
            <span className="text-[var(--text-dim)]">未配置</span>
          )}
        </div>
        <div className="border border-[var(--border)] rounded p-3 bg-[var(--bg-input-soft)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-soft)]">模型列表自定义</span>
            <div className="flex items-center gap-2 text-xs">
              {overrideModels.length ? (
                <button
                  className="text-[var(--text-soft)] hover:text-[var(--text)]"
                  onClick={() => {
                    const next = { ...(config.llm.modelOverrides ?? {}) }
                    delete next[config.llm.provider]
                    onChange({ ...config, llm: { ...config.llm, modelOverrides: next } })
                  }}
                >
                  恢复自动
                </button>
              ) : null}
              <button
                className="text-[var(--text-soft)] hover:text-[var(--text)]"
                onClick={() => {
                  if (editingModels) {
                    setEditingModels(false)
                    return
                  }
                  setModelDrafts((resolvedModels.length ? resolvedModels : ['']).slice())
                  setEditingModels(true)
                }}
              >
                {editingModels ? '取消' : '编辑'}
              </button>
              {editingModels ? (
                <button
                  className="text-green-500 hover:text-green-400"
                  onClick={() => {
                    const cleaned = modelDrafts.map((m) => m.trim()).filter(Boolean)
                    const next = { ...(config.llm.modelOverrides ?? {}) }
                    if (cleaned.length) {
                      next[config.llm.provider] = cleaned
                    } else {
                      delete next[config.llm.provider]
                    }
                    onChange({ ...config, llm: { ...config.llm, modelOverrides: next } })
                    setEditingModels(false)
                  }}
                >
                  保存
                </button>
              ) : null}
            </div>
          </div>
          {editingModels ? (
            <div className="mt-3 space-y-2">
              {modelDrafts.map((m, i) => (
                <div key={`${i}-${m}`} className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)]"
                    value={m}
                    onChange={(e) => {
                      const next = modelDrafts.slice()
                      next[i] = e.target.value
                      setModelDrafts(next)
                    }}
                  />
                  <button
                    className="text-red-500 hover:text-red-400 text-xs"
                    onClick={() => {
                      const next = modelDrafts.slice()
                      next.splice(i, 1)
                      setModelDrafts(next.length ? next : [''])
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                className="text-xs text-[var(--text-soft)] hover:text-[var(--text)]"
                onClick={() => setModelDrafts([...modelDrafts, ''])}
              >
                + 添加模型
              </button>
              <div className="text-[11px] text-[var(--text-dim)]">
                自定义列表仅作用于当前厂商；留空将回退到自动列表。
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-[var(--text-dim)]">
              {overrideModels.length ? '当前使用自定义列表' : '当前使用自动列表'}
            </div>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">Base URL</span>
          <input
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
            value={config.llm.baseUrl ?? ''}
            onChange={(e) => onChange({ ...config, llm: { ...config.llm, baseUrl: e.target.value } })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--text-muted)]">Temperature</span>
            <input
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
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
            <span className="text-xs text-[var(--text-muted)]">Max Tokens</span>
            <input
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
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
          <span className="text-xs text-[var(--text-muted)]">API Key</span>
          <input
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
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
          {saved ? <span className="text-xs text-green-500">已保存</span> : null}
          {validateStatus !== 'idle' ? (
            <span className={`text-xs ${validateStatus === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
              {validateMsg}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
