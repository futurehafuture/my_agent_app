import os

from chat_agent import run_chat_agent
from responses_agent import run_responses_agent


def run_agent(
    user_input: str,
    *,
    model: str | None = None,
    max_turns: int = 8,
) -> str:
    model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    try:
        return run_responses_agent(
            user_input,
            model=model,
            max_turns=max_turns,
        )
    except Exception as responses_error:
        print(
            "[agent] Responses API failed. Falling back to Chat Completions API.",
        )
        print(f"[agent] Responses error: {responses_error}")

        return run_chat_agent(
            user_input,
            model=model,
            max_turns=max_turns,
        )
