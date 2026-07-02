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


def run_responses_agent(
    user_input: str,
    *,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> AgentRun:
    client = create_client()

    input_items: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *(history or []),
        {"role": "user", "content": user_input},
    ]

    tool_schemas = [tool["responses_schema"] for tool in TOOLS.values()]
    tool_iterations = 0
    trace: list[dict[str, Any]] = []

    while True:
        iteration = tool_iterations + 1
        trace.append(
            {
                "type": "model_request",
                "api": "responses",
                "iteration": iteration,
                "model": model,
                "input": input_items,
                "tools": tool_schemas,
            }
        )

        response = client.responses.create(
            model=model,
            input=input_items,
            tools=tool_schemas,
            temperature=0,
        )

        response_output = [
            item.model_dump(exclude_none=True)
            for item in response.output
        ]
        trace.append(
            {
                "type": "model_response",
                "api": "responses",
                "iteration": iteration,
                "output": response_output,
                "output_text": response.output_text,
            }
        )

        function_calls = [
            item
            for item in response.output
            if item.type == "function_call"
        ]

        # The model is done when it does not ask for more tools.
        if not function_calls:
            return AgentRun(answer=response.output_text, trace=trace)

        tool_iterations += 1
        if tool_iterations > max_tool_iterations:
            raise RuntimeError(
                f"Agent exceeded max_tool_iterations={max_tool_iterations}"
            )

        input_items.extend(response_output)

        for function_call in function_calls:
            function_name = function_call.name
            raw_arguments = function_call.arguments or "{}"

            try:
                arguments = json.loads(raw_arguments)
            except json.JSONDecodeError as error:
                tool_result = {
                    "ok": False,
                    "error": f"Invalid tool arguments JSON: {error}",
                }
            else:
                tool_result = run_local_tool(function_name, arguments)

            function_call_output = {
                "type": "function_call_output",
                "call_id": function_call.call_id,
                "output": json.dumps(tool_result, ensure_ascii=False),
            }
            input_items.append(function_call_output)

            trace.append(
                {
                    "type": "tool_result",
                    "api": "responses",
                    "iteration": iteration,
                    "tool_name": function_name,
                    "call_id": function_call.call_id,
                    "arguments": arguments if "arguments" in locals() else {},
                    "result": tool_result,
                    "function_call_output": function_call_output,
                }
            )
