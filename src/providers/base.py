import json
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    raw: Any | None = None


@dataclass
class ModelOutput:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: Any | None = None


class Provider(Protocol):
    api_name: str

    def build_initial_state(
        self,
        *,
        system_prompt: str,
        history: list[dict[str, str]],
        user_input: str,
    ) -> list[dict[str, Any]]:
        ...

    def build_tool_schemas(self, tools: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        ...

    def call_model(
        self,
        *,
        model: str,
        state: list[dict[str, Any]],
        tool_schemas: list[dict[str, Any]],
    ) -> ModelOutput:
        ...

    def append_model_output(
        self,
        state: list[dict[str, Any]],
        model_output: ModelOutput,
    ) -> None:
        ...

    def append_tool_result(
        self,
        state: list[dict[str, Any]],
        tool_call: ToolCall,
        tool_result: dict[str, Any],
    ) -> dict[str, Any]:
        ...


def parse_tool_arguments(raw_arguments: str | None) -> tuple[dict[str, Any], str | None]:
    try:
        arguments = json.loads(raw_arguments or "{}")
    except json.JSONDecodeError as error:
        return {}, f"Invalid tool arguments JSON: {error}"

    if not isinstance(arguments, dict):
        return {}, "Tool arguments must decode to a JSON object."

    return arguments, None
