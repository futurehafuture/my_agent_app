import json
import os
from typing import Any

from openai import OpenAI

from tools import TOOLS, run_local_tool


SYSTEM_PROMPT = (
    "You are a minimal tool-using agent. "
    "Use tools when useful. "
    "After receiving tool results, answer the user directly."
)


def create_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    )


def run_chat_agent(
    user_input: str,
    *,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> str:
    client = create_client()

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *(history or []),
        {"role": "user", "content": user_input},
    ]

    tool_schemas = [tool["chat_schema"] for tool in TOOLS.values()]
    tool_iterations = 0

    while True:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tool_schemas,
            tool_choice="auto",
            temperature=0,
        )

        assistant_message = response.choices[0].message
        messages.append(assistant_message.model_dump(exclude_none=True))

        tool_calls = assistant_message.tool_calls or []

        # The model is done when it does not ask for more tools.
        if not tool_calls:
            return assistant_message.content or ""

        tool_iterations += 1
        if tool_iterations > max_tool_iterations:
            raise RuntimeError(
                f"Agent exceeded max_tool_iterations={max_tool_iterations}"
            )

        for tool_call in tool_calls:
            function_name = tool_call.function.name
            raw_arguments = tool_call.function.arguments or "{}"

            try:
                arguments = json.loads(raw_arguments)
            except json.JSONDecodeError as error:
                tool_result = {
                    "ok": False,
                    "error": f"Invalid tool arguments JSON: {error}",
                }
            else:
                tool_result = run_local_tool(function_name, arguments)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                }
            )
