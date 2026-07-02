# My Agent App

A universal desktop Agent application scaffold.

This redesign turns the starter app into a polished **general-purpose Agent command center**:

- Router Agent: classifies user intent and chooses a specialist agent.
- Code Agent: works inside a project sandbox and produces diffs before applying changes.
- Data Agent: analyzes uploaded CSV/Excel files in an isolated data workspace.
- File Agent: manages user-approved folders with explicit approval before risky actions.
- Research Agent: search-oriented workflow placeholder.
- PPT Agent: document and slide generation workflow placeholder.
- MCP Hub: external tool/server management placeholder.
- Permission and approval layer: high-risk actions are planned, logged, and require user confirmation.

## UI direction

The interface is inspired by modern productivity and AI developer tools:

- Raycast-style command palette for fast intent capture.
- Linear-style dense dark project dashboards.
- Agent-first IDE layout: workspace, agent timeline, tools, approvals, artifacts.

## Development

```bash
npm install
npm run dev
```

Python service scaffold:

```bash
cd backend_py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```
