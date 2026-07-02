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

## Multi-turn conversation and full trace

The agent can keep multi-turn history and full execution traces in a JSON file.

First turn:

```bash
python src/main.py --session-file .agent_session.json "My name is Bruis."
```

Second turn:

```bash
python src/main.py --session-file .agent_session.json "What is my name?"
```

The session file stores complete turns:

```json
{
  "version": 1,
  "turns": [
    {
      "type": "turn",
      "backend": "responses",
      "model": "gpt-4o-mini",
      "user": {"role": "user", "content": "What time is it?"},
      "assistant": {"role": "assistant", "content": "The current UTC time is ..."},
      "trace": [
        {"type": "model_request", "api": "responses", "iteration": 1},
        {"type": "model_response", "api": "responses", "iteration": 1},
        {"type": "tool_result", "api": "responses", "iteration": 1, "tool_name": "get_time"},
        {"type": "model_request", "api": "responses", "iteration": 2},
        {"type": "model_response", "api": "responses", "iteration": 2}
      ]
    }
  ]
}
```

For the next model call, the code extracts clean user/assistant messages from the saved turns as conversation context. The full trace remains saved for replay, debugging, and auditing.

Old session files that were simple lists of user/assistant messages are still accepted and are migrated into the new `turns` format the next time they are saved.

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

The loop is driven by the model output, not by a fixed `for` loop.

Responses API loop:

```python
while True:
    response = client.responses.create(
        model=model,
        input=input_items,
        tools=tools,
    )

    function_calls = find_function_calls(response)

    if not function_calls:
        return response.output_text

    for function_call in function_calls:
        result = run_local_tool(function_call)
        input_items.append(function_call_output(result))
```

Chat Completions fallback loop:

```python
while True:
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        tools=tools,
    )

    tool_calls = response.choices[0].message.tool_calls or []

    if not tool_calls:
        return response.choices[0].message.content

    for tool_call in tool_calls:
        result = run_local_tool(tool_call)
        messages.append(tool_message(result))
```

There is still a `max_tool_iterations` safety guard to prevent infinite tool loops, but the normal stop condition is: the model stops asking for tools.
