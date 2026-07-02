from typing import Any

from loop import AgentRun, run_agent_loop
from providers.chat import ChatCompletionsProvider


def run_chat_agent(
    user_input: str,
    *,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> AgentRun:
    return run_agent_loop(
        provider=ChatCompletionsProvider(),
        user_input=user_input,
        model=model,
        history=history,
        max_tool_iterations=max_tool_iterations,
    )


__all__: list[str] = ["Any", "AgentRun", "run_chat_agent"]
