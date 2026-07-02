import json
import os
from pathlib import Path
from typing import Any

from app.runtime.permissions import ensure_within_root
from app.tools.shell_tools import run_command


class DeepSeekToolAgent:
    """OpenAI-compatible tool-calling loop for DeepSeek.

    This is deliberately sandbox-bound: every filesystem operation is rooted in repo.
    """

    def __init__(self, repo: Path):
        self.repo = repo.resolve()
        self.logs: list[str] = []

    @property
    def enabled(self) -> bool:
        return bool(os.getenv("DEEPSEEK_API_KEY"))

    def run(self, task: str, tree: str, max_turns: int = 8) -> str | None:
        if not self.enabled:
            return None

        try:
            from openai import OpenAI
        except Exception as exc:
            return f"OpenAI Python package is missing: {exc}"

        client = OpenAI(api_key=os.getenv("DEEPSEEK_API_KEY"), base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
        model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": (
                    "你是一个代码 Agent。你只能在 repo 沙箱目录里工作。"
                    "需要先读文件再改文件。可以写入沙箱文件，可以运行安全验证命令。"
                    "最后用中文总结：改了什么、验证结果、风险。"
                ),
            },
            {"role": "user", "content": f"任务：{task}\n\n项目结构：\n{tree}"},
        ]

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "list_files",
                    "description": "List files under a repo-relative directory.",
                    "parameters": {
                        "type": "object",
                        "properties": {"path": {"type": "string", "description": "Repo-relative path"}},
                        "required": ["path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read a UTF-8 text file from the repo sandbox.",
                    "parameters": {
                        "type": "object",
                        "properties": {"path": {"type": "string"}},
                        "required": ["path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "Write a UTF-8 text file inside the repo sandbox.",
                    "parameters": {
                        "type": "object",
                        "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
                        "required": ["path", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "run_command",
                    "description": "Run a safe command in the repo sandbox. Risky commands are blocked.",
                    "parameters": {
                        "type": "object",
                        "properties": {"command": {"type": "array", "items": {"type": "string"}}},
                        "required": ["command"],
                    },
                },
            },
        ]

        for _ in range(max_turns):
            response = client.chat.completions.create(model=model, messages=messages, tools=tools, tool_choice="auto", temperature=0.1)
            message = response.choices[0].message
            messages.append(message.model_dump(exclude_none=True))
            tool_calls = message.tool_calls or []
            if not tool_calls:
                return message.content or "DeepSeek completed without a final message."

            for call in tool_calls:
                name = call.function.name
                args = json.loads(call.function.arguments or "{}")
                output = self._invoke(name, args)
                self.logs.append(f"{name}({args}) -> {str(output)[:800]}")
                messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(output, ensure_ascii=False)})

        return "DeepSeek tool loop reached max turns. Partial tool logs were captured."

    def _invoke(self, name: str, args: dict[str, Any]) -> object:
        if name == "list_files":
            target = ensure_within_root(self.repo, self.repo / args.get("path", "."))
            if not target.exists():
                return {"error": "path not found"}
            return sorted(item.name for item in target.iterdir())[:200]
        if name == "read_file":
            target = ensure_within_root(self.repo, self.repo / args["path"])
            return target.read_text(encoding="utf-8", errors="replace")[:30000]
        if name == "write_file":
            target = ensure_within_root(self.repo, self.repo / args["path"])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(args["content"], encoding="utf-8")
            return {"ok": True, "path": str(target.relative_to(self.repo))}
        if name == "run_command":
            return run_command(self.repo, list(args["command"]), timeout_seconds=60)
        return {"error": f"unknown tool {name}"}
