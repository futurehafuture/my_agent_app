import React, { useState } from 'react'
import { SettingsPanel } from '../components/SettingsPanel'
import { AppConfig } from '../services/config'
import { Link } from 'react-router-dom'
import { SettingsNav } from '../components/SettingsNav'

export function SettingsPage({ config, onChange }: { config: AppConfig; onChange: (c: AppConfig) => void }) {
  const [tab, setTab] = useState<'model' | 'mcp' | 'system'>('model')
  return (
    <div className="flex flex-col relative h-full min-h-0">
      <div className="absolute top-0 left-0 w-full h-8 draggable z-10" />
      <div className="flex-1 overflow-y-auto p-6 pt-10 min-h-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-[var(--text-muted)]">Settings</div>
            <Link to="/" className="text-xs text-[var(--text-soft)] hover:text-[var(--text)]">
              返回聊天
            </Link>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-6">
            <SettingsNav tab={tab} setTab={setTab} />
            <div className="min-h-[320px]">
              {tab === 'model' ? <SettingsPanel config={config} onChange={onChange} /> : null}
              {tab === 'mcp' ? (
                <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-panel)] text-sm text-[var(--text-soft)]">
                  MCP 设置开发中…
                </div>
              ) : null}
              {tab === 'system' ? (
                <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-panel)] text-sm">
                  <div className="text-xs text-[var(--text-muted)] mb-3">系统设置</div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">主题</span>
                    <select
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)]"
                      value={config.ui?.theme ?? 'dark'}
                      onChange={(e) =>
                        onChange({ ...config, ui: { ...config.ui, theme: e.target.value as 'dark' | 'light' } })
                      }
                    >
                      <option value="dark">深色</option>
                      <option value="light">浅色</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
