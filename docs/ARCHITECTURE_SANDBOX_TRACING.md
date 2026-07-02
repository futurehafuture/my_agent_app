# My Agent App Architecture: OpenAI Agents SDK, Sandbox, Settings, and Traces

This document describes the current architecture of `my_agent_app` after the OpenAI Agents SDK migration.

## 1. High-level architecture

```text
Electron Renderer UI
  -> FastAPI backend
  -> OpenAI Agents SDK Runner
  -> Router Agent
  -> SDK handoff to specialist Agent
  -> SDK function_tool calls
  -> artifacts, trace, approvals, diff
```

The important point: the Agent loop is owned by OpenAI Agents SDK. The app does not manually implement model/tool recursion as the main path anymore.

The app layer still owns product concerns:

- local folder authorization through Electron
- workspace preparation
- LLM key storage
- local trace persistence
- diff apply confirmation
- artifact display
- MCP server registry

## 2. Agents

The backend builds a real SDK Agent network in `backend_py/app/agents/openai_agents_runtime.py`.

### Router Agent

The Router Agent is the only entry point. It decides which specialist should take over and uses SDK handoffs.

### Specialist Agents

Each specialist is a real SDK `Agent` with its own instructions and handoff description:

- Code Agent
- Data Analysis Agent
- File Manager Agent
- PPT Agent
- Browser Research Agent
- Chat Agent

They are not a fixed pipeline. They are peers that the Router can delegate to.

## 3. SDK function tools

Tools live in `backend_py/app/agents/sdk_toolkit.py` and are exposed through `@function_tool`.

Current tools:

| Tool | Purpose | Boundary |
| --- | --- | --- |
| `list_files` | list files in workspace/repo | rooted to sandbox path |
| `read_file` | read UTF-8 text file | rooted to sandbox path |
| `write_file` | write UTF-8 text file | rooted to sandbox path |
| `run_command` | run safe commands | risky commands blocked |
| `get_diff` | produce source vs sandbox diff | read-only diff generation |
| `suggest_validation` | infer test/build commands | read-only |
| `summarize_data` | summarize CSV/XLSX | data workspace only |
| `create_pptx` | export PPTX artifact | workspace artifact |
| `browser_search` | web search | no local file access |
| `scan_allowed_folder` | plan file organization | read-only plan |

## 4. Current sandbox model

The current sandbox is a **workspace-copy sandbox**, not yet a strong OS/container isolation boundary.

For code tasks:

```text
real project folder
  -> copied into agent_workspaces/<task-id>/repo
  -> SDK tools can read/write copied repo
  -> app shows diff
  -> user confirms apply-diff
  -> selected changes copy back to real project
```

### What this protects

- The Agent does not directly edit the real project during the SDK run.
- File tools are rooted with `ensure_within_root`, so relative paths should not escape the workspace.
- Risky shell commands are blocked by `is_risky_command` before execution.
- Applying changes back to the real source requires `/tasks/apply-diff` with `confirm=true`.
- The apply step copies changed files back but does not auto-delete source files.

### What this does not protect yet

- It is not full process isolation.
- A safe-looking command could still have side effects inside the local machine process environment.
- Network access is not blocked in the local workspace mode.
- Secrets in the current process environment are still environment-level risk.
- Docker helpers exist, but the primary SDK tool execution path currently uses local subprocess execution.

### Stronger sandbox target

Production should move command execution to one of these:

1. Docker container with `--network none`, mounted workspace only.
2. OpenAI Agents SDK `SandboxAgent` where supported.
3. Hosted sandbox / remote isolated worker.

## 5. LLM key configuration

The App UI can configure model keys through:

```text
GET  /settings/llm
POST /settings/llm
```

The settings are stored locally at:

```text
agent_workspaces/app_settings.json
```

This path is ignored by git. The backend masks secrets when reading settings back. It also avoids overwriting real secrets with masked values such as `sk-...abcd`.

Supported settings:

- `provider`
- `agent_model`
- `openai_api_key`
- `deepseek_api_key`
- `deepseek_base_url`
- `deepseek_model`
- `save_traces`

## 6. Local traces

Every SDK run is saved locally when `save_traces=true`.

Trace path:

```text
agent_workspaces/traces/<task_id>.json
```

Trace endpoints:

```text
GET /traces
GET /traces/{task_id}
```

A trace contains:

- timestamp
- request snapshot
- route decision
- selected agent profile
- workspace information
- events
- final output
- artifacts
- approvals
- diff
- SDK tool logs captured by the app wrapper

These are app-local traces. They are separate from any hosted OpenAI tracing dashboard behavior.

## 7. Known bug/risk checklist

This pass fixed or noted several issues:

- `.env` was not loaded. Fixed with `load_dotenv()` in `main.py`.
- Mutable default request fields in `McpServerRequest` were replaced with `Field(default_factory=...)`.
- Masked keys could overwrite real stored keys. Fixed in `settings_manager.py`.
- The previous branch ref was accidentally moved by a content API write. The branch was restored to the SDK-primary commit before applying this patch.
- `EventSource` only supports GET; current stream endpoint uses query params, which is acceptable for task text but not ideal for large prompts. Future version should use POST + WebSocket or create-run then stream-by-id.
- The current sandbox is a workspace-copy sandbox, not strong isolation. Docker or SDK SandboxAgent should become the command execution backend before production use.

## 8. Run commands

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend_py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```

OpenAI model:

```bash
export OPENAI_API_KEY=your_key
export AGENT_MODEL=gpt-4.1-mini
```

Or configure keys directly in the App UI.
