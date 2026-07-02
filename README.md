# my_agent_app

A minimal Python agent loop using the OpenAI Python SDK style.

The agent uses the Responses API first:

```python
client.responses.create(...)
```

If the provider does not support Responses API, it automatically falls back to Chat Completions:

```python
client.chat.completions.create(...)
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## Run

```bash
python src/main.py "What time is it? Then calculate 12 * 7."
```

## DeepSeek example

```bash
OPENAI_API_KEY=your_deepseek_key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

DeepSeek may not support Responses API, so the agent will try Responses first and then automatically fall back to Chat Completions.

## Doubao Ark example

```bash
OPENAI_API_KEY=your_ark_key
OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
OPENAI_MODEL=your-doubao-model-id
```

## Core loop

```python
try:
    answer = run_responses_agent(...)
except Exception:
    answer = run_chat_agent(...)
```

Responses API loop:

```python
response = client.responses.create(
    model=model,
    input=input_items,
    tools=tools,
)

if response contains function_call:
    run local tool
    append function_call_output
    continue

return response.output_text
```

Chat Completions fallback loop:

```python
response = client.chat.completions.create(
    model=model,
    messages=messages,
    tools=tools,
)

if response contains tool_calls:
    run local tool
    append tool message
    continue

return assistant_message.content
```
