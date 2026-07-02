# My Agent App

A universal desktop Agent application built on **OpenAI Agents SDK**.

## Architecture

The backend now uses OpenAI Agents SDK as the primary execution layer:

```text
Electron UI
  -> FastAPI
  -> OpenAI Agents SDK Runner
  -> Router Agent
  -> handoff to specialist Agent
  -> SDK function tools
  -> sandbox/workspace artifacts
```

Specialist agents are real SDK `Agent` instances, not pipeline placeholders:

- Router Agent: entry point; selects handoff target.
- Code Agent: reads/writes sandbox repo files, validates, and produces diff.
- Data Agent: summarizes copied CSV/XLSX files.
- File Agent: scans approved folders and creates plan-only file operations.
- PPT Agent: generates real PPTX artifacts.
- Research Agent: runs browser search and writes research artifacts.
- Chat Agent: handles ordinary questions.

The SDK handles the core loop: turns, handoffs, tool calls, tool-result feedback, and final output. The app layer still owns Electron UI, local folder authorization, workspace preparation, diff apply approval, and artifact display.

## What works now

- Frontend command-center UI for Code, Data, Files, Research, PPT, and MCP workflows.
- Electron folder authorization via native directory picker.
- FastAPI backend with:
  - `/health`
  - `/tasks/plan`
  - `/tasks/run`
  - `/tasks/stream`
  - `/tasks/apply-diff`
  - `/mcp/servers`
  - `/browser/search`
- OpenAI Agents SDK Router Agent with handoffs to specialist Agents.
- SDK `function_tool` tools for file listing, reading, writing, command execution, diff generation, data summaries, PPTX export, browser search, and file planning.
- Code tasks copy the authorized project into `agent_workspaces/.../repo` before tools can touch it.
- Diff apply requires explicit confirmation.

## Development

Install frontend dependencies:

```bash
npm install
npm run dev
```

Run Python backend:

```bash
cd backend_py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```

Then open the Electron app and click **Run plan**.

## Model configuration

Default OpenAI provider:

```bash
export OPENAI_API_KEY=your_openai_key
export AGENT_MODEL=gpt-4.1-mini
```

DeepSeek through the Agents SDK LiteLLM provider:

```bash
cp backend_py/.env.example backend_py/.env
```

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek/deepseek-chat
```

## Safety model

The app should not grant an agent full computer access by default.

1. Code tasks operate on a copied project workspace.
2. Data tasks operate on selected data files or folders.
3. File management tasks only generate a plan first.
4. Delete, overwrite, move, terminal commands, credential access, and real-project writes require approval.
5. The UI shows tool calls, events, artifacts, and final diff before risky changes are applied.

## Notes

This branch is now structured around OpenAI Agents SDK rather than a custom tool loop. The next local validation step is to run the backend with a real `OPENAI_API_KEY` or DeepSeek/LiteLLM configuration and fix any SDK-version-specific import differences.
