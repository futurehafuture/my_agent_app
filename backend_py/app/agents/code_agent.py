import os
import shutil
from pathlib import Path

from app.agents.deepseek_tool_agent import DeepSeekToolAgent
from app.models import AgentRunResult, ApprovalRequest, RunEvent
from app.runtime.run_store import save_run
from app.tools.diff_tools import directory_diff, git_diff
from app.tools.shell_tools import run_command, suggest_validation_commands

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

    events = [
        RunEvent(id="copy", title="Project copied", detail=f"{source} -> {repo}", state="done", meta="sandbox"),
        RunEvent(id="inspect", title="Project inspected", detail=f"Found {len(tree.splitlines())} visible entries.", state="done", meta="read-only"),
    ]

    agent = DeepSeekToolAgent(repo)
    ai_summary = agent.run(task, tree)
    if ai_summary:
        events.append(RunEvent(id="deepseek-tools", title="DeepSeek tool loop", detail=f"{len(agent.logs)} tool call(s)", state="done", meta="tool-calling"))
    else:
        events.append(RunEvent(id="deepseek-skipped", title="DeepSeek skipped", detail="Set DEEPSEEK_API_KEY to enable full tool-calling loop.", state="pending", meta="offline"))

    validation_log = _run_validation_and_repair(task, repo, commands, agent, events)
    diff = git_diff(repo) or directory_diff(source, repo)

    summary = ai_summary or (
        "Code Agent completed a safe project inspection. The project was copied into a sandbox workspace, "
        "visible structure was summarized, and likely validation commands were detected. Real source files were not changed."
    )
    if validation_log:
        summary += "\n\nValidation summary:\n" + validation_log[:3000]

    approvals = [
        ApprovalRequest(id="run-command", title="Run more validation commands", reason="Additional shell commands should be reviewed before execution.", risk="needs_approval", payload={"commands": commands}),
        ApprovalRequest(id="apply-diff", title="Apply sandbox diff", reason="Changes should be reviewed before writing back to the real project.", risk="dangerous", payload={"task_id": task_id}),
    ]

    artifacts = {
        "project_tree.txt": tree,
        "validation_commands.txt": "\n".join(commands) or "No obvious command detected.",
        "agent_notes.md": summary,
        "tool_logs.txt": "\n".join(agent.logs) or "No model tool calls captured.",
        "validation.log": validation_log or "Validation was not run.",
    }

    result = AgentRunResult(task_id=task_id, task_type="code", summary=summary, events=events, artifacts=artifacts, approvals=approvals, diff=diff)
    save_run(result, source_path=str(source), workspace_repo=str(repo))
    return result


def _copy_project(source: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)

    def ignore(_: str, names: list[str]) -> set[str]:
        return {name for name in names if name in IGNORE_DIRS or name.endswith(".log")}

    shutil.copytree(source, destination, ignore=ignore)


def _project_tree(root: Path, max_entries: int = 240) -> str:
    lines: list[str] = []
    count = 0
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS][:24]
        rel = Path(current).relative_to(root)
        depth = 0 if str(rel) == "." else len(rel.parts)
        if depth > 4:
            dirs[:] = []
            continue
        indent = "  " * depth
        name = "repo" if str(rel) == "." else rel.name
        lines.append(f"{indent}{name}/")
        count += 1
        for file_name in sorted(files)[:28]:
            if count >= max_entries:
                lines.append("  ...")
                return "\n".join(lines)
            lines.append(f"{indent}  {file_name}")
            count += 1
    return "\n".join(lines)


def _run_validation_and_repair(task: str, repo: Path, commands: list[str], agent: DeepSeekToolAgent, events: list[RunEvent]) -> str:
    if not commands:
        events.append(RunEvent(id="validate-none", title="Validation skipped", detail="No obvious validation command detected.", state="pending", meta="none"))
        return ""

    should_auto_run = os.getenv("AUTO_RUN_TESTS", "true").lower() == "true"
    if not should_auto_run:
        events.append(RunEvent(id="validate-approval", title="Validation needs approval", detail=", ".join(commands), state="blocked", meta="approval"))
        return "Validation commands were detected but AUTO_RUN_TESTS=false."

    logs: list[str] = []
    for command in commands[:2]:
        result = run_command(repo, command.split(), timeout_seconds=90)
        logs.append(f"$ {command}\n{return_result_text(result)}")
        if result.get("blocked"):
            events.append(RunEvent(id="validate-blocked", title="Validation blocked", detail=command, state="blocked", meta="risk"))
            continue
        state = "done" if result.get("returncode") == 0 else "blocked"
        events.append(RunEvent(id=f"validate-{command}", title="Validation run", detail=command, state=state, meta=str(result.get("returncode"))))
        if result.get("returncode") != 0 and agent.enabled:
            repair_prompt = task + "\n\nValidation failed. Fix the issue using tools, then summarize.\n\n" + return_result_text(result)
            repair = agent.run(repair_prompt, _project_tree(repo), max_turns=5)
            logs.append("\nRepair attempt:\n" + (repair or "No repair output."))
            events.append(RunEvent(id="repair", title="Repair loop", detail="DeepSeek attempted one repair cycle after validation failure.", state="done", meta="repair"))
            retry = run_command(repo, command.split(), timeout_seconds=90)
            logs.append(f"\nRetry: $ {command}\n{return_result_text(retry)}")
            events.append(RunEvent(id="validate-retry", title="Validation retry", detail=command, state="done" if retry.get("returncode") == 0 else "blocked", meta=str(retry.get("returncode"))))
        break
    return "\n\n".join(logs)


def return_result_text(result: dict[str, object]) -> str:
    if result.get("blocked"):
        return f"BLOCKED: {result.get('reason')}"
    return f"exit={result.get('returncode')}\nSTDOUT:\n{result.get('stdout', '')}\nSTDERR:\n{result.get('stderr', '')}"
