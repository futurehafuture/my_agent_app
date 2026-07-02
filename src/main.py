import argparse
import json
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from agent import normalize_history, run_agent


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Run a minimal OpenAI-compatible agent loop."
    )
    parser.add_argument("input", nargs="+", help="User input for the agent.")
    parser.add_argument(
        "--session-file",
        help="Optional JSON file used to load and save the full conversation trace.",
    )
    parser.add_argument(
        "--max-tool-iterations",
        type=int,
        default=16,
        help="Safety limit for repeated tool calls inside one user turn.",
    )

    args = parser.parse_args()
    user_input = " ".join(args.input)

    session_data = load_session(args.session_file)
    history = normalize_history(session_data)

    result = run_agent(
        user_input,
        history=history,
        max_tool_iterations=args.max_tool_iterations,
    )

    if args.session_file:
        save_session(args.session_file, session_data, result.turn)

    print(result.answer)


def load_session(session_file: str | None) -> Any:
    if not session_file:
        return {"version": 1, "turns": []}

    path = Path(session_file)
    if not path.exists():
        return {"version": 1, "turns": []}

    return json.loads(path.read_text(encoding="utf-8"))


def save_session(session_file: str, session_data: Any, new_turn: dict[str, Any]) -> None:
    path = Path(session_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    if isinstance(session_data, dict) and isinstance(session_data.get("turns"), list):
        trace_session = session_data
    elif isinstance(session_data, list):
        trace_session = migrate_old_history(session_data)
    else:
        trace_session = {"version": 1, "turns": []}

    trace_session["turns"].append(new_turn)

    path.write_text(
        json.dumps(trace_session, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def migrate_old_history(history: list[dict[str, Any]]) -> dict[str, Any]:
    turns: list[dict[str, Any]] = []
    pending_user: dict[str, Any] | None = None

    for message in history:
        if not isinstance(message, dict):
            continue

        role = message.get("role")
        content = message.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue

        if role == "user":
            pending_user = {"role": "user", "content": content}
        elif role == "assistant" and pending_user:
            turns.append(
                {
                    "type": "turn",
                    "backend": "unknown",
                    "model": "unknown",
                    "user": pending_user,
                    "assistant": {"role": "assistant", "content": content},
                    "trace": [],
                    "migrated_from": "legacy_message_history",
                }
            )
            pending_user = None

    return {"version": 1, "turns": turns}


if __name__ == "__main__":
    main()
