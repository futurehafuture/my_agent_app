from __future__ import annotations
import json
import os
from typing import Any

from openai import OpenAI

from providers.base import ModelOutput, ToolCall, parse_tool_arguments


class ResponsesProvider:
    api_name = "responses"

    def __init__(self, client: OpenAI | None = None) -> None:
        self.client = client or OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )

    def build_initial_state(
        self,
        *,
        system_prompt: str,
        history: list[dict[str, str]],
        user_input: str,
    ) -> list[dict[str, Any]]:
        return [
            {"role": "system", "content": system_prompt},
            *history,
            {"role": "user", "content": user_input},
        ]

    def build_tool_schemas(self, tools: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        return [tool["responses_schema"] for tool in tools.values()]

    def call_model(
        self,
        *,
        model: str,
        state: list[dict[str, Any]],
        tool_schemas: list[dict[str, Any]],
    ) -> ModelOutput:
        response = self.client.responses.create(
            model=model,
            input=state,
            tools=tool_schemas,
            temperature=0,
        )

        response_output = [item.model_dump(exclude_none=True) for item in response.output]
        tool_calls: list[ToolCall] = []

        for item in response.output:
            if item.type != "function_call":
                continue

            arguments, parse_error = parse_tool_arguments(item.arguments)
            if parse_error:
                arguments = {"_parse_error": parse_error}

            tool_calls.append(
                ToolCall(
                    id=item.call_id,
                    name=item.name,
                    arguments=arguments,
                    raw=item.model_dump(exclude_none=True),
                )
            )

        reasoning = getattr(response, "reasoning_content", None)

        return ModelOutput(
            text=response.output_text,
            tool_calls=tool_calls,
            raw={
                "output": response_output,
                "output_text": response.output_text,
            },
            reasoning=reasoning,
        )

    def append_model_output(
        self,
        state: list[dict[str, Any]],
        model_output: ModelOutput,
    ) -> None:
        state.extend(model_output.raw["output"])

    def append_tool_result(
        self,
        state: list[dict[str, Any]],
        tool_call: ToolCall,
        tool_result: dict[str, Any],
    ) -> dict[str, Any]:
        if "_parse_error" in tool_call.arguments:
            tool_result = {"ok": False, "error": tool_call.arguments["_parse_error"]}

        function_call_output = {
            "type": "function_call_output",
            "call_id": tool_call.id,
            "output": json.dumps(tool_result, ensure_ascii=False),
        }
        state.append(function_call_output)
        return function_call_output
