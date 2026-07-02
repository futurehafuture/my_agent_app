// =============================================================================
// Agent App UI — Live WebSocket Client
// =============================================================================

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let ws = null;
let isConnected = false;
let thinkingIdx = 0;
let rawIdx = 0;
let runStartTime = null;
let toolCount = 0;
let runtimeInterval = null;
let currentModel = 'Connecting…';

// -----------------------------------------------------------------------------
// WebSocket Connection
// -----------------------------------------------------------------------------

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:8000';
  const url = `${protocol}//${host}/ws`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnected = true;
    updateConnectionStatus('connected');
    console.log('[ws] Connected');
  };

  ws.onclose = () => {
    isConnected = false;
    updateConnectionStatus('disconnected');
    console.log('[ws] Disconnected — reconnecting in 2s…');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('[ws] Error:', err);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerEvent(msg);
    } catch (e) {
      console.error('[ws] Bad message:', e);
    }
  };
}

// -----------------------------------------------------------------------------
// Event Handler
// -----------------------------------------------------------------------------

function handleServerEvent(msg) {
  const { type, data } = msg;

  switch (type) {
    case 'config':
      currentModel = data.model || 'Unknown';
      updateModelBadge(currentModel);
      updateToolList(data.tools || []);
      break;

    case 'user_echo':
      // User message confirmed by server — render it
      appendStreamBlock(renderUserBlock(data.content));
      startRun();
      break;

    case 'thinking':
      const currentIdx = thinkingIdx++;
      appendStreamBlock(renderThinkingBlock(data.content, currentIdx));
      // Auto-expand active thinking blocks so they are readable immediately
      setTimeout(() => {
        const content = document.getElementById(`thinkingContent${currentIdx}`);
        const chevron = document.getElementById(`thinkingChevron${currentIdx}`);
        if (content) content.classList.add('expanded');
        if (chevron) chevron.classList.add('expanded');
      }, 50);
      break;

    case 'thinking_update':
      const thinkingBlocks = document.querySelectorAll('.thinking-content');
      if (thinkingBlocks.length > 0) {
        const lastBlock = thinkingBlocks[thinkingBlocks.length - 1];
        lastBlock.innerHTML = escapeHtml(data.content).replace(/\n/g, '<br>');
      }
      break;

    case 'tool_call':
      toolCount++;
      updateToolCount(toolCount);
      appendStreamBlock(renderToolCallBlock(data.name, data.arguments));
      break;

    case 'tool_result':
      appendStreamBlock(renderToolResultBlock(
        data.name,
        data.status,
        data.result,
        rawIdx++
      ));
      break;

    case 'assistant':
      appendStreamBlock(renderAssistantBlock(data.content));
      break;

    case 'done':
      finishRun(data);
      break;

    case 'error':
      appendStreamBlock(renderErrorBlock(data.content));
      finishRun(data);
      break;


    default:
      console.log('[ws] Unknown event:', type, data);
  }
}

// -----------------------------------------------------------------------------
// Run Management
// -----------------------------------------------------------------------------

function startRun() {
  runStartTime = Date.now();
  toolCount = 0;
  updateToolCount(0);
  updateStatus('running');

  // Update runtime every second
  clearInterval(runtimeInterval);
  runtimeInterval = setInterval(() => {
    if (runStartTime) {
      const elapsed = Math.floor((Date.now() - runStartTime) / 1000);
      updateRuntime(formatDuration(elapsed));
    }
  }, 1000);
}

function finishRun(data) {
  clearInterval(runtimeInterval);
  if (runStartTime) {
    const elapsed = Math.floor((Date.now() - runStartTime) / 1000);
    updateRuntime(formatDuration(elapsed));
  }
  updateStatus('completed');
  runStartTime = null;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// -----------------------------------------------------------------------------
// UI Update Helpers
// -----------------------------------------------------------------------------

function updateConnectionStatus(status) {
  const pill = document.getElementById('statusPill');
  if (!pill) return;

  if (status === 'connected') {
    pill.className = 'status-pill status--completed';
    pill.innerHTML = '<span class="status-dot"></span>Connected';
  } else {
    pill.className = 'status-pill status--error';
    pill.innerHTML = '<span class="status-dot"></span>Disconnected';
  }
}

function updateStatus(status) {
  const pill = document.getElementById('statusPill');
  if (!pill) return;

  if (status === 'running') {
    pill.className = 'status-pill status--running';
    pill.innerHTML = '<span class="status-dot"></span>Running';
  } else if (status === 'completed') {
    pill.className = 'status-pill status--completed';
    pill.innerHTML = '<span class="status-dot"></span>Completed';
  }
}

function updateModelBadge(model) {
  const badge = document.getElementById('modelBadge');
  if (badge) {
    badge.innerHTML = `<span class="model-dot"></span>${escapeHtml(model)}`;
  }
}

function updateRuntime(text) {
  const el = document.getElementById('runRuntime');
  if (el) {
    el.innerHTML = `
      <svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      ${text}`;
  }
}

function updateToolCount(count) {
  const el = document.getElementById('runToolCount');
  if (el) {
    el.innerHTML = `
      <svg class="stat-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"></path>
      </svg>
      ${count} tool${count !== 1 ? 's' : ''}`;
  }
}

function updateToolList(tools) {
  const el = document.getElementById('panelTools');
  if (!el) return;

  el.innerHTML = tools.map(name => `
    <li class="panel-list-item">
      <span class="tool-dot tool-dot--active"></span>
      <span class="tool-name">${escapeHtml(name)}</span>
    </li>
  `).join('');

  // Update badge count
  const badge = el.closest('.panel-section')?.querySelector('.panel-badge');
  if (badge) badge.textContent = tools.length;
}

// -----------------------------------------------------------------------------
// Render Functions (return HTML strings)
// -----------------------------------------------------------------------------

function renderUserBlock(content) {
  return `
    <div class="stream-block block-user">
      <div class="block-avatar block-avatar--user">U</div>
      <div class="block-body">
        <div class="block-label block-label--user">You</div>
        <div class="block-content">${escapeHtml(content)}</div>
      </div>
    </div>
  `;
}

function renderThinkingBlock(content, index) {
  return `
    <div class="stream-block block-thinking">
      <button class="thinking-toggle" onclick="toggleThinking(${index})">
        <svg class="thinking-chevron" id="thinkingChevron${index}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        <span class="block-label block-label--thinking">THINKING</span>
        <span style="color: var(--color-text-tertiary); font-size: 12px; margin-left: auto;">Click to expand</span>
      </button>
      <div class="thinking-content" id="thinkingContent${index}">
        ${escapeHtml(content).replace(/\n/g, '<br>')}
      </div>
    </div>
  `;
}

function renderToolCallBlock(name, args) {
  const argsFormatted = Object.entries(args || {})
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');

  return `
    <div class="stream-block block-tool-call">
      <div class="tool-call-header">
        <div class="tool-call-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
        </div>
        <span class="block-label block-label--tool-call">TOOL CALL</span>
        <span class="tool-call-name">${escapeHtml(name)}</span>
      </div>
      <div class="tool-call-args">${escapeHtml(argsFormatted)}</div>
    </div>
  `;
}

function renderToolResultBlock(name, status, result, index) {
  const prettyJson = JSON.stringify(result, null, 2);

  // Build readable summary
  let summary = '';
  if (result && result.ok && result.result) {
    if (typeof result.result === 'string') {
      summary = result.result;
    } else {
      summary = JSON.stringify(result.result, null, 0);
    }
  } else if (result && result.error) {
    summary = `Error: ${result.error}`;
  } else {
    summary = prettyJson;
  }

  return `
    <div class="stream-block block-tool-result">
      <div class="tool-result-header">
        <span class="tool-result-status tool-result-status--${status}"></span>
        <span class="tool-result-label">RESULT — ${escapeHtml(name)}</span>
      </div>
      <div class="tool-result-content">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
      <div class="tool-result-raw">
        <button class="raw-toggle" onclick="toggleRaw(${index})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          View raw JSON
        </button>
        <div class="raw-content" id="rawContent${index}">${escapeHtml(prettyJson)}</div>
      </div>
    </div>
  `;
}

function renderAssistantBlock(content) {
  return `
    <div class="stream-block block-assistant">
      <div class="block-avatar block-avatar--assistant">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"></path></svg>
      </div>
      <div class="block-body">
        <div class="block-label block-label--assistant">Assistant</div>
        <div class="block-content">${content}</div>
      </div>
    </div>
  `;
}

function renderErrorBlock(content) {
  return `
    <div class="stream-block block-tool-result" style="border-left-color: var(--color-error);">
      <div class="tool-result-header">
        <span class="tool-result-status tool-result-status--error"></span>
        <span class="tool-result-label" style="color: var(--color-error);">ERROR</span>
      </div>
      <div class="tool-result-content">${escapeHtml(content)}</div>
    </div>
  `;
}

function renderInfoBlock(message) {
  return `
    <div class="stream-block block-thinking" style="border-style: solid; border-color: var(--color-accent-light);">
      <div style="padding: var(--space-1) 0; color: var(--color-text-secondary); font-size: 13px;">
        ℹ️ ${escapeHtml(message)}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// DOM Helpers
// -----------------------------------------------------------------------------

function appendStreamBlock(html) {
  const stream = document.getElementById('stream');
  if (!stream) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  const block = wrapper.firstElementChild;

  if (block) {
    stream.appendChild(block);
    // Scroll to bottom
    const container = document.getElementById('streamContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

function clearStream() {
  const stream = document.getElementById('stream');
  if (stream) stream.innerHTML = '';
  thinkingIdx = 0;
  rawIdx = 0;
  toolCount = 0;
  updateToolCount(0);
  updateRuntime('0s');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// -----------------------------------------------------------------------------
// Interactive Functions
// -----------------------------------------------------------------------------

function toggleThinking(index) {
  const content = document.getElementById(`thinkingContent${index}`);
  const chevron = document.getElementById(`thinkingChevron${index}`);
  if (content) content.classList.toggle('expanded');
  if (chevron) chevron.classList.toggle('expanded');
}

function toggleRaw(index) {
  const content = document.getElementById(`rawContent${index}`);
  if (content) content.classList.toggle('expanded');
}

// -----------------------------------------------------------------------------
// View Mode Toggle (Readable / Raw Events)
// -----------------------------------------------------------------------------

function initViewToggle() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const stream = document.getElementById('stream');

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.textContent.trim();
      if (mode === 'Raw Events') {
        stream.classList.add('stream--raw');
      } else {
        stream.classList.remove('stream--raw');
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Right Panel Collapse / Expand
// -----------------------------------------------------------------------------

function initPanelToggle() {
  const collapseBtn = document.getElementById('panelCollapseBtn');
  const expandBtn = document.getElementById('panelExpandBtn');
  const contextPanel = document.getElementById('contextPanel');
  const appLayout = document.querySelector('.app-layout');

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      if (contextPanel) contextPanel.classList.add('collapsed');
      if (appLayout) appLayout.classList.add('panel-collapsed');
      if (expandBtn) expandBtn.classList.remove('hidden');
    });
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      if (contextPanel) contextPanel.classList.remove('collapsed');
      if (appLayout) appLayout.classList.remove('panel-collapsed');
      expandBtn.classList.add('hidden');
    });
  }
}

// -----------------------------------------------------------------------------
// Sidebar Navigation
// -----------------------------------------------------------------------------

function initSidebarNav() {
  const navItems = document.querySelectorAll('.nav-item[data-nav]');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // New Run button clears the stream
  const newRunBtn = document.getElementById('navNewRun');
  if (newRunBtn) {
    newRunBtn.addEventListener('click', () => {
      clearStream();
      updateStatus('completed');
      const title = document.getElementById('runTitle');
      if (title) title.textContent = 'New Run';
    });
  }
}

// -----------------------------------------------------------------------------
// Composer (Send messages, auto-grow)
// -----------------------------------------------------------------------------

function initComposer() {
  const textarea = document.getElementById('composerInput');
  const sendBtn = document.getElementById('btnSend');

  // Auto-grow
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${newHeight}px`;
    });

    // Send on Enter (Shift+Enter for newline)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      sendMessage();
    });
  }
}

function sendMessage() {
  const textarea = document.getElementById('composerInput');
  if (!textarea) return;

  const content = textarea.value.trim();
  if (!content) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendStreamBlock(renderErrorBlock('Not connected to server. Please wait…'));
    return;
  }

  // Send to server
  ws.send(JSON.stringify({ content }));

  // Clear input
  textarea.value = '';
  textarea.style.height = 'auto';

  // Update run title from first message
  const title = document.getElementById('runTitle');
  if (title) {
    const preview = content.length > 50 ? content.substring(0, 50) + '…' : content;
    title.textContent = preview;
  }

  // Brief button animation
  const sendBtn = document.getElementById('btnSend');
  if (sendBtn) {
    sendBtn.style.transform = 'scale(0.9)';
    setTimeout(() => { sendBtn.style.transform = ''; }, 120);
  }
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initViewToggle();
  initPanelToggle();
  initSidebarNav();
  initComposer();

  // Set initial state
  updateStatus('completed');
  updateRuntime('0s');
  updateToolCount(0);

  // Show welcome message
  const stream = document.getElementById('stream');
  if (stream) {
    stream.innerHTML = `
      <div class="stream-block block-assistant">
        <div class="block-avatar block-avatar--assistant">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"></path></svg>
        </div>
        <div class="block-body">
          <div class="block-label block-label--assistant">Assistant</div>
          <div class="block-content">
            Welcome! I'm your AI agent. I can use tools like <code>get_time</code> and <code>calculator</code> to help you.<br><br>
            Type a message below to get started. Try asking me:<br>
            • "What time is it?"<br>
            • "Calculate 125 * 37 + 89"<br>
            • "What time is it? Then calculate 12 * 7"
          </div>
        </div>
      </div>
    `;
  }

  // Connect to WebSocket
  connectWebSocket();
});
