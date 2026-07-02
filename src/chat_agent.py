import json
import os
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

from tools import TOOLS, run_local_tool


SYSTEM_PROMPT = (
    "You are a minimal tool-using agent. "
    "Use tools when useful. "
    "After receiving tool results, answer the user directly."
)


@dataclass
class AgentRun:
    answer: str
    trace: list[dict[str, Any]] = field(default_factory=list)


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
) -> AgentRun:
    client = create_client()

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *(history or []),
        {"role": "user", "content": user_input},
    ]

    tool_schemas = [tool["chat_schema"] for tool in TOOLS.values()]
    tool_iterations = 0
    trace: list[dict[str, Any]] = []

    while True:
        iteration = tool_iterations + 1
        trace.append({"type": "model_request", "api": "chat", "iteration": iteration, "messages": list(messages)})

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tool_schemas,
            tool_choice="auto",
            temperature=0,
        )

        assistant_message = response.choices[0].message
        assistant_message_dict = assistant_message.model_dump(exclude_none=True)
        messages.append(assistant_message_dict)

        trace.append(
            {
                "type": "model_response",
                "api": "chat",
                "iteration": iteration,
                "message": assistant_message_dict,
                "finish_reason": response.choices[0].finish_reason,
            }
        )

        tool_calls = assistant_message.tool_calls or []

        if not tool_calls:
            return AgentRun(answer=assistant_message.content or "", trace=trace)

        tool_iterations += 1
        if tool_iterations > max_tool_iterations:
            raise RuntimeError(f"Agent exceeded max_tool_iterations={max_tool_iterations}")

        for tool_call in tool_calls:
            function_name = tool_call.function.name
            raw_arguments = tool_call.function.arguments or "{}"

            try:
                arguments = json.loads(raw_arguments)
            except json.JSONDecodeError as error:
                arguments = {}
                tool_result = {"ok": False, "error": f"Invalid tool arguments JSON: {error}"}
            else:
                tool_result = run_local_tool(function_name, arguments)

            tool_message = {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result, ensure_ascii=False),
            }
            messages.append(tool_message)

            trace.append(
                {
                    "type": "tool_result",
                    "api": "chat",
                    "iteration": iteration,
                    "tool_name": function_name,
                    "tool_call_id": tool_call.id,
                    "arguments": arguments,
                    "result": tool_result,
                    "message": tool_message,
                }
            )
