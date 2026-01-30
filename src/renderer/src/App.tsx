import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Monitor, Paperclip, Settings, Plus, MessageSquare } from 'lucide-react';

// 定义消息类型
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '你好！我是你的桌面智能助手。我可以帮你处理文件、识别屏幕或编写代码。' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  // 处理发送 (模拟)
  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // 模拟 AI 回复
    setTimeout(() => {
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: '这是模拟回复。**Markdown** 也是支持的：\n```python\nprint("Hello World")\n```' 
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-[#343541] text-white font-sans overflow-hidden">
      
      {/* --- 左侧侧边栏 --- */}
      <div className="w-64 bg-[#202123] flex flex-col border-r border-gray-700">
        
        {/* 🔥 1. 顶部拖拽区域 (Mac红绿灯/Win标题栏) */}
        <div className="h-8 draggable shrink-0" />

        {/* 2. 侧边栏主要内容区域 */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
          
          {/* New Chat 按钮 (必须加 non-draggable) */}
          <button className="non-draggable flex items-center gap-2 border border-gray-600 rounded p-3 hover:bg-gray-700 transition-colors text-sm mb-4 shrink-0">
            <Plus size={16} />
            <span>New Chat</span>
          </button>

          {/* 历史记录列表 (必须加 non-draggable) */}
          <div className="flex-1 overflow-y-auto non-draggable space-y-2">
            <div className="flex items-center gap-2 p-3 text-sm text-gray-300 hover:bg-[#2A2B32] rounded cursor-pointer">
              <MessageSquare size={14} />
              <span className="truncate">Python 脚本优化</span>
            </div>
            <div className="flex items-center gap-2 p-3 text-sm text-gray-300 hover:bg-[#2A2B32] rounded cursor-pointer">
              <MessageSquare size={14} />
              <span className="truncate">React 组件调试</span>
            </div>
          </div>
        </div>

        {/* 3. 底部设置区域 */}
        <div className="p-4 border-t border-gray-700 shrink-0 non-draggable">
          <div className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer text-sm">
            <Settings size={16} />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* --- 右侧主聊天区 --- */}
      <div className="flex-1 flex flex-col relative">
        
        {/* 顶部也加一个隐形拖拽条，方便操作右侧 */}
        <div className="absolute top-0 left-0 w-full h-8 draggable z-10" />

        {/* 消息列表区域 */}
        <div className="flex-1 overflow-y-auto p-4 pt-10 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'assistant' ? 'bg-[#444654] -mx-4 px-8 py-6' : 'px-4'}`}>
              <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-green-500' : 'bg-indigo-500'}`}>
                {msg.role === 'assistant' ? 'AI' : 'Me'}
              </div>
              <div className="prose prose-invert max-w-none text-sm leading-6 select-text">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 底部输入框区域 */}
        <div className="p-4 bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10">
          <div className="max-w-3xl mx-auto bg-[#40414F] rounded-xl shadow-lg border border-gray-600 relative">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="发送消息给 Agent..."
              className="w-full bg-transparent text-white p-4 pr-12 outline-none resize-none h-[56px] max-h-[200px]"
              style={{ minHeight: '56px' }}
            />
            <button 
              onClick={handleSend}
              className="absolute right-3 bottom-3 p-1 rounded-md bg-green-600 hover:bg-green-700 transition-colors text-white disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="text-center text-xs text-gray-500 mt-2">
             LLM Agent Desktop Preview
          </div>
        </div>

        {/* 悬浮工具栏 */}
        <div className="absolute bottom-24 right-8 flex flex-col gap-2">
          <button className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 shadow-lg text-white tooltip" title="截取屏幕">
            <Monitor size={20} />
          </button>
          <button className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 shadow-lg text-white" title="上传文件">
            <Paperclip size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;