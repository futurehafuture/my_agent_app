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


def run_responses_agent(
    user_input: str,
    *,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> str:
    client = create_client()

    input_items: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *(history or []),
        {"role": "user", "content": user_input},
    ]

    tool_schemas = [tool["responses_schema"] for tool in TOOLS.values()]
    tool_iterations = 0

    while True:
        response = client.responses.create(
            model=model,
            input=input_items,
            tools=tool_schemas,
            temperature=0,
        )

        function_calls = [
            item
            for item in response.output
            if item.type == "function_call"
        ]

        # The model is done when it does not ask for more tools.
        if not function_calls:
            return response.output_text

        tool_iterations += 1
        if tool_iterations > max_tool_iterations:
            raise RuntimeError(
                f"Agent exceeded max_tool_iterations={max_tool_iterations}"
            )

        input_items.extend(
            item.model_dump(exclude_none=True)
            for item in response.output
        )

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

            input_items.append(
                {
                    "type": "function_call_output",
                    "call_id": function_call.call_id,
                    "output": json.dumps(tool_result, ensure_ascii=False),
                }
            )
