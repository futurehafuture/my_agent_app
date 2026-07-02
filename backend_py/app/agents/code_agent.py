import os
import shutil
from pathlib import Path

from app.models import AgentRunResult, ApprovalRequest, RunEvent
from app.runtime.permissions import PermissionError
from app.tools.diff_tools import directory_diff, git_diff
from app.tools.shell_tools import suggest_validation_commands

IGNORE_DIRS = {".git", "node_modules", ".next", "dist", "build", "out", ".venv", "__pycache__"}


def run_code_agent(task_id: str, task: str, workspace_root: Path, project_path: str | None) -> AgentRunResult:
    if not project_path:
        return AgentRunResult(
            task_id=task_id,
            task_type="code",
            summary="Code Agent needs an authorized project folder. Click '授权目录' and choose a project.",
            events=[RunEvent(id="missing-project", title="Missing project", detail="No project_path was provided.", state="blocked", meta="approval")],
            approvals=[ApprovalRequest(id="choose-project", title="Authorize project folder", reason="Code tasks require a project folder to copy into the sandbox.", risk="needs_approval")],
        )

    source = Path(project_path).expanduser().resolve()
    if not source.exists() or not source.is_dir():
        raise FileNotFoundError(f"Project folder does not exist: {source}")

    repo = workspace_root / "repo"
    _copy_project(source, repo)
    tree = _project_tree(repo)
    commands = suggest_validation_commands(repo)
    diff = git_diff(repo) or directory_diff(source, repo)

    events = [
        RunEvent(id="copy", title="Project copied", detail=f"{source} -> {repo}", state="done", meta="sandbox"),
        RunEvent(id="inspect", title="Project inspected", detail=f"Found {len(tree.splitlines())} visible entries.", state="done", meta="read-only"),
        RunEvent(id="validate-plan", title="Validation planned", detail=", ".join(commands) if commands else "No obvious build/test command detected.", state="done", meta="commands"),
    ]

    ai_summary = _run_optional_deepseek_loop(task, repo, tree, commands)
    summary = ai_summary or (
        "Code Agent completed a safe project inspection. The project was copied into a sandbox workspace, "
        "visible structure was summarized, and likely validation commands were detected. Real source files were not changed."
    )

    approvals = [
        ApprovalRequest(id="run-command", title="Run validation command", reason="Shell commands should be reviewed before execution.", risk="needs_approval", payload={"commands": commands}),
        ApprovalRequest(id="apply-diff", title="Apply sandbox diff", reason="Changes should be reviewed before writing back to the real project.", risk="dangerous"),
    ]

    artifacts = {
        "project_tree.txt": tree,
        "validation_commands.txt": "\n".join(commands) or "No obvious command detected.",
        "agent_notes.md": summary,
    }

    return AgentRunResult(task_id=task_id, task_type="code", summary=summary, events=events, artifacts=artifacts, approvals=approvals, diff=diff)


def _copy_project(source: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)

    def ignore(_: str, names: list[str]) -> set[str]:
        return {name for name in names if name in IGNORE_DIRS or name.endswith(".log")}

    shutil.copytree(source, destination, ignore=ignore)


def _project_tree(root: Path, max_entries: int = 180) -> str:
    lines: list[str] = []
    count = 0
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS][:20]
        rel = Path(current).relative_to(root)
        depth = 0 if str(rel) == "." else len(rel.parts)
        if depth > 4:
            dirs[:] = []
            continue
        indent = "  " * depth
        name = "repo" if str(rel) == "." else rel.name
        lines.append(f"{indent}{name}/")
        count += 1
        for file_name in sorted(files)[:24]:
            if count >= max_entries:
                lines.append("  ...")
                return "\n".join(lines)
            lines.append(f"{indent}  {file_name}")
            count += 1
    return "\n".join(lines)


def _run_optional_deepseek_loop(task: str, repo: Path, tree: str, commands: list[str]) -> str | None:
    """Use DeepSeek/OpenAI-compatible chat if configured.

    This is intentionally read-only in the current version. Editing and command execution remain approval-gated.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
        model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a cautious local code agent. Inspect only; do not claim to modify files. Reply in Chinese."},
                {"role": "user", "content": f"Task:\n{task}\n\nProject tree:\n{tree}\n\nSuggested commands:\n{commands}\n\nGive a concise implementation plan and safety notes."},
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content or None
    except Exception as exc:
        return f"DeepSeek call failed, local inspection still completed. Error: {exc}"
