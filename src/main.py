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
        help="Optional JSON file used to load and save user/assistant conversation history.",
    )
    parser.add_argument(
        "--max-tool-iterations",
        type=int,
        default=16,
        help="Safety limit for repeated tool calls inside one user turn.",
    )

    args = parser.parse_args()
    user_input = " ".join(args.input)

    history = load_history(args.session_file)

    result = run_agent(
        user_input,
        history=history,
        max_tool_iterations=args.max_tool_iterations,
    )

    if args.session_file:
        save_history(args.session_file, result.history)

    print(result.answer)


def load_history(session_file: str | None) -> list[dict[str, str]]:
    if not session_file:
        return []

    path = Path(session_file)
    if not path.exists():
        return []

    raw_history: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_history, list):
        raise ValueError("Session file must contain a JSON list.")

    return normalize_history(raw_history)


def save_history(session_file: str, history: list[dict[str, str]]) -> None:
    path = Path(session_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(history, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
