# My Agent App

A universal desktop Agent application that combines a polished Electron command-center UI with a Python Agent backend.

## What works now

- Frontend command-center UI for Code, Data, Files, Research, PPT, and MCP workflows.
- Electron folder authorization via native directory picker.
- FastAPI backend with:
  - `/health`
  - `/tasks/plan`
  - `/tasks/run`
- Router logic that classifies tasks.
- Code Agent workflow:
  - copies the authorized project into an isolated workspace
  - inspects project structure
  - detects likely build/test commands
  - optionally runs a DeepSeek/OpenAI-compatible tool loop if API credentials are configured
  - returns summary, events, artifacts, approvals, and diff
- Data Agent workflow:
  - copies authorized data into a workspace
  - summarizes CSV/XLSX files when pandas/openpyxl are available
- File Agent workflow:
  - produces a plan for user-approved folders without moving/deleting files automatically
- Safety boundaries:
  - path guard
  - command risk detector
  - plan-first approvals
  - sandbox/workspace copy before touching source projects

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

## DeepSeek configuration

Create `backend_py/.env`:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Without a key, the app still runs in deterministic local mode so the UI/backend workflow can be tested.

## Safety model

The app should not grant an agent full computer access by default.

1. Code tasks operate on a copied project workspace.
2. Data tasks operate on selected data files or folders.
3. File management tasks only generate a plan first.
4. Delete, overwrite, move, terminal commands, credential access, and real-project writes require approval.
5. The UI shows tool calls, events, artifacts, and final diff before risky changes are applied.

## Next production steps

- Replace deterministic router with an LLM structured-output router.
- Add real streaming via Server-Sent Events or WebSocket.
- Add user approval endpoints for command execution and diff apply.
- Add MCP server management.
- Switch local workspaces to Docker or a hosted sandbox for stronger isolation.
