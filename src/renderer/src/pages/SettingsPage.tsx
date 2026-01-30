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
            <div className="text-sm text-gray-400">Settings</div>
            <Link to="/" className="text-xs text-gray-300 hover:text-white">
              返回聊天
            </Link>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-6">
            <SettingsNav tab={tab} setTab={setTab} />
            <div className="min-h-[320px]">
              {tab === 'model' ? <SettingsPanel config={config} onChange={onChange} /> : null}
              {tab === 'mcp' ? (
                <div className="p-4 border border-gray-700 rounded-xl bg-[#2A2B32] text-sm text-gray-300">
                  MCP 设置开发中…
                </div>
              ) : null}
              {tab === 'system' ? (
                <div className="p-4 border border-gray-700 rounded-xl bg-[#2A2B32] text-sm text-gray-300">
                  系统设置开发中…
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
