import React from 'react'

export function SettingsNav({ tab, setTab }: { tab: string; setTab: (t: 'model' | 'mcp' | 'system') => void }) {
  const item = (id: 'model' | 'mcp' | 'system', label: string) => (
    <button
      className={`text-left px-3 py-2 rounded text-sm ${
        tab === id ? 'bg-[#40414F] text-white' : 'text-gray-300 hover:bg-[#2A2B32]'
      }`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-1">
      {item('model', '模型')}
      {item('mcp', 'MCP')}
      {item('system', '系统')}
    </div>
  )
}
