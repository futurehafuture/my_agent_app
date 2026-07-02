import os
from dataclasses import dataclass, field
from typing import Any

from chat_agent import run_chat_agent
from responses_agent import run_responses_agent


@dataclass
class AgentResult:
    answer: str
    backend: str
    history: list[dict[str, str]] = field(default_factory=list)
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
        answer = run_responses_agent(
            user_input,
            model=model,
            history=history,
            max_tool_iterations=max_tool_iterations,
        )
        return AgentResult(
            answer=answer,
            backend="responses",
            history=append_turn(history, user_input, answer),
        )
    except Exception as responses_error:
        print("[agent] Responses API failed. Falling back to Chat Completions API.")
        print(f"[agent] Responses error: {responses_error}")

        answer = run_chat_agent(
            user_input,
            model=model,
            history=history,
            max_tool_iterations=max_tool_iterations,
        )
        return AgentResult(
            answer=answer,
            backend="chat",
            history=append_turn(history, user_input, answer),
            fallback_error=str(responses_error),
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


def normalize_history(history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []

    for item in history or []:
        role = item.get("role")
        content = item.get("content")

        if role not in {"user", "assistant"}:
            continue
        if not isinstance(content, str):
            continue

        normalized.append({"role": role, "content": content})

    return normalized
