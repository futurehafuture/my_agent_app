# my_agent_app

A minimal Python agent loop using a **provider-based architecture**.

## Key change (refactor)

The agent loop is now unified:

- One `run_agent_loop`
- Multiple providers:
  - `ResponsesProvider`
  - `ChatCompletionsProvider`

No duplicated agent logic anymore.

---

## Architecture

```
src/
├── loop.py              # unified agent loop
├── providers/           # API adapters
│   ├── base.py
│   ├── responses.py
│   └── chat.py
├── tools.py             # local tool registry
└── agent.py             # fallback + orchestration
```

---

## How it works

### 1. Provider abstraction
Each provider implements:

- build_initial_state()
- call_model()
- append_model_output()
- append_tool_result()

So API differences are isolated.

### 2. Unified loop

```python
run_agent_loop(provider, user_input, model)
```

Loop is now identical for all backends.

---

## Tooling

Supports:

- get_time
- calculator (safe AST eval)

---

## Fallback behavior

- Try Responses API first
- If it fails → fallback to Chat Completions

---

## Run

```bash
python src/main.py "What time is it? Then calculate 12 * 7."
```

---

## Why this refactor matters

Before:
- Two duplicated loops (chat / responses)

Now:
- One loop
- Pluggable providers
- Easier to add DeepSeek / Kimi / local LLM
