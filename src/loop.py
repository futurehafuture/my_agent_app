import json
from dataclasses import dataclass, field
from typing import Any

from providers.base import Provider
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


def run_agent_loop(
    *,
    provider: Provider,
    user_input: str,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> AgentRun:
    state = provider.build_initial_state(
        system_prompt=SYSTEM_PROMPT,
        history=history or [],
        user_input=user_input,
    )
    tool_schemas = provider.build_tool_schemas(TOOLS)
    trace: list[dict[str, Any]] = []
    tool_iterations = 0

    while True:
        iteration = tool_iterations + 1
        trace.append(
            {
                "type": "model_request",
                "api": provider.api_name,
                "iteration": iteration,
                "state": list(state),
            }
        )

        model_output = provider.call_model(
            model=model,
            state=state,
            tool_schemas=tool_schemas,
        )
        provider.append_model_output(state, model_output)

        trace.append(
            {
                "type": "model_response",
                "api": provider.api_name,
                "iteration": iteration,
                "output": model_output.raw,
                "output_text": model_output.text,
            }
        )

        if not model_output.tool_calls:
            return AgentRun(answer=model_output.text, trace=trace)

        tool_iterations += 1
        if tool_iterations > max_tool_iterations:
            raise RuntimeError(f"Agent exceeded max_tool_iterations={max_tool_iterations}")

        for tool_call in model_output.tool_calls:
            tool_result = run_local_tool(tool_call.name, tool_call.arguments)
            tool_message = provider.append_tool_result(state, tool_call, tool_result)

            trace.append(
                {
                    "type": "tool_result",
                    "api": provider.api_name,
                    "iteration": iteration,
                    "tool_name": tool_call.name,
                    "tool_call_id": tool_call.id,
                    "arguments": tool_call.arguments,
                    "result": tool_result,
                    "message": tool_message,
                }
            )


def dump_tool_result(tool_result: dict[str, Any]) -> str:
    return json.dumps(tool_result, ensure_ascii=False)
