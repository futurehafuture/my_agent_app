import argparse

from dotenv import load_dotenv

from agent import run_agent


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Run a minimal OpenAI-compatible agent loop."
    )
    parser.add_argument("input", nargs="+", help="User input for the agent.")
    parser.add_argument("--max-turns", type=int, default=8)

    args = parser.parse_args()

    answer = run_agent(
        " ".join(args.input),
        max_turns=args.max_turns,
    )

    print(answer)


if __name__ == "__main__":
    main()
