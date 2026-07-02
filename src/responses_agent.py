import json
import os
from typing import Any

from openai import OpenAI

from tools import TOOLS, run_local_tool


def create_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    )


def run_responses_agent(
    user_input: str,
    *,
    model: str,
    max_turns: int = 8,
) -> str:
    client = create_client()

    input_items: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are a minimal tool-using agent. "
                "Use tools when useful. "
                "After receiving tool results, answer the user directly."
            ),
        },
        {
            "role": "user",
            "content": user_input,
        },
    ]

    tool_schemas = [tool["responses_schema"] for tool in TOOLS.values()]

    for _ in range(max_turns):
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

        if not function_calls:
            return response.output_text

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

    raise RuntimeError(f"Agent stopped after max_turns={max_turns}")
