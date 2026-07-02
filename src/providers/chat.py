from __future__ import annotations
import json
import os
from typing import Any

from openai import OpenAI

from providers.base import ModelOutput, ToolCall, parse_tool_arguments


class ChatCompletionsProvider:
    api_name = "chat"

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
        return [tool["chat_schema"] for tool in tools.values()]

    def call_model(
        self,
        *,
        model: str,
        state: list[dict[str, Any]],
        tool_schemas: list[dict[str, Any]],
    ) -> ModelOutput:
        response = self.client.chat.completions.create(
            model=model,
            messages=state,
            tools=tool_schemas,
            tool_choice="auto",
            temperature=0,
        )

        assistant_message = response.choices[0].message
        assistant_message_dict = assistant_message.model_dump(exclude_none=True)
        tool_calls: list[ToolCall] = []

        for item in assistant_message.tool_calls or []:
            arguments, parse_error = parse_tool_arguments(item.function.arguments)
            if parse_error:
                arguments = {"_parse_error": parse_error}

            tool_calls.append(
                ToolCall(
                    id=item.id,
                    name=item.function.name,
                    arguments=arguments,
                    raw=item.model_dump(exclude_none=True),
                )
            )

        reasoning = getattr(assistant_message, "reasoning_content", None)
        if not reasoning and isinstance(assistant_message_dict, dict):
            reasoning = assistant_message_dict.get("reasoning_content")

        return ModelOutput(
            text=assistant_message.content or "",
            tool_calls=tool_calls,
            raw={
                "message": assistant_message_dict,
                "finish_reason": response.choices[0].finish_reason,
            },
            reasoning=reasoning,
        )

    def append_model_output(
        self,
        state: list[dict[str, Any]],
        model_output: ModelOutput,
    ) -> None:
        state.append(model_output.raw["message"])

    def append_tool_result(
        self,
        state: list[dict[str, Any]],
        tool_call: ToolCall,
        tool_result: dict[str, Any],
    ) -> dict[str, Any]:
        if "_parse_error" in tool_call.arguments:
            tool_result = {"ok": False, "error": tool_call.arguments["_parse_error"]}

        tool_message = {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(tool_result, ensure_ascii=False),
        }
        state.append(tool_message)
        return tool_message
