import os
from dataclasses import dataclass, field
from typing import Any

from loop import run_agent_loop
from providers import ChatCompletionsProvider, ResponsesProvider
from providers.base import Provider


@dataclass
class AgentResult:
    answer: str
    backend: str
    history: list[dict[str, str]] = field(default_factory=list)
    trace: list[dict[str, Any]] = field(default_factory=list)
    turn: dict[str, Any] = field(default_factory=dict)
    fallback_error: str | None = None


def run_agent(
    user_input: str,
    *,
    model: str | None = None,
    history: list[dict[str, str]] | None = None,
    max_tool_iterations: int = 16,
) -> AgentResult:
    model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    history = history or []

    try:
        provider: Provider = ResponsesProvider()
        run = run_agent_loop(
            provider=provider,
            user_input=user_input,
            model=model,
            history=history,
            max_tool_iterations=max_tool_iterations,
        )
        backend = provider.api_name
        fallback_error = None
    except Exception as responses_error:
        print("[agent] Responses API failed. Falling back to Chat Completions API.")
        print(f"[agent] Responses error: {responses_error}")

        provider = ChatCompletionsProvider()
        run = run_agent_loop(
            provider=provider,
            user_input=user_input,
            model=model,
            history=history,
            max_tool_iterations=max_tool_iterations,
        )
        backend = provider.api_name
        fallback_error = str(responses_error)

    new_history = append_turn(history, user_input, run.answer)
    turn = build_trace_turn(
        user_input=user_input,
        assistant_answer=run.answer,
        backend=backend,
        model=model,
        trace=run.trace,
        fallback_error=fallback_error,
    )

    return AgentResult(
        answer=run.answer,
        backend=backend,
        history=new_history,
        trace=run.trace,
        turn=turn,
        fallback_error=fallback_error,
    )


def append_turn(
    history: list[dict[str, str]],
    user_input: str,
    assistant_answer: str,
) -> list[dict[str, str]]:
    return [
        *history,
        {"role": "user", "content": user_input},
        {"role": "assistant", "content": assistant_answer},
    ]


def build_trace_turn(
    *,
    user_input: str,
    assistant_answer: str,
    backend: str,
    model: str,
    trace: list[dict[str, Any]],
    fallback_error: str | None,
) -> dict[str, Any]:
    turn: dict[str, Any] = {
        "type": "turn",
        "backend": backend,
        "model": model,
        "user": {"role": "user", "content": user_input},
        "assistant": {"role": "assistant", "content": assistant_answer},
        "trace": trace,
    }

    if fallback_error:
        turn["fallback_error"] = fallback_error

    return turn


def normalize_history(session_data: Any) -> list[dict[str, str]]:
    """Extract clean user/assistant messages for model context.

    Supports both the old session format:
        [{"role": "user", "content": "..."}, ...]

    and the full trace format:
        {"turns": [{"user": {...}, "assistant": {...}, "trace": [...]}, ...]}
    """
    if isinstance(session_data, list):
        return normalize_messages(session_data)

    if isinstance(session_data, dict):
        turns = session_data.get("turns")
        if isinstance(turns, list):
            messages: list[dict[str, Any]] = []
            for turn in turns:
                if not isinstance(turn, dict):
                    continue
                user_message = turn.get("user")
                assistant_message = turn.get("assistant")
                if isinstance(user_message, dict):
                    messages.append(user_message)
                if isinstance(assistant_message, dict):
                    messages.append(assistant_message)
            return normalize_messages(messages)

    return []


def normalize_messages(messages: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []

    for item in messages or []:
        role = item.get("role")
        content = item.get("content")

        if role not in {"user", "assistant"}:
            continue
        if not isinstance(content, str):
            continue

        normalized.append({"role": role, "content": content})

    return normalized
