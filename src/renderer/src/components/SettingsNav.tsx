import React from 'react'

export function SettingsNav({ tab, setTab }: { tab: string; setTab: (t: 'model' | 'mcp' | 'system') => void }) {
  const item = (id: 'model' | 'mcp' | 'system', label: string) => (
    <button
      className={`text-left px-3 py-2 rounded text-sm ${
        tab === id
          ? 'bg-[var(--bg-input)] text-[var(--text)]'
          : 'text-[var(--text-soft)] hover:bg-[var(--bg-panel)]'
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
