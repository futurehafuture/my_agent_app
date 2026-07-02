from loop import AgentRun, run_agent_loop
from providers.responses import ResponsesProvider


def run_responses_agent(
    user_input: str,
    *,
    model: str,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> AgentRun:
    return run_agent_loop(
        provider=ResponsesProvider(),
        user_input=user_input,
        model=model,
        history=history,
        max_tool_iterations=max_tool_iterations,
    )


__all__ = ["AgentRun", "run_responses_agent"]
