from collections import defaultdict
from pathlib import Path

from app.models import AgentRunResult, ApprovalRequest, RunEvent


def run_file_agent(task_id: str, task: str, allowed_folder: str | None) -> AgentRunResult:
    if not allowed_folder:
        return AgentRunResult(
            task_id=task_id,
            task_type="file",
            summary="File Agent needs an authorized folder. Click '授权目录' first.",
            events=[RunEvent(id="missing-folder", title="Missing folder", detail="No allowed_folder was provided.", state="blocked", meta="approval")],
        )

    root = Path(allowed_folder).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise FileNotFoundError(f"Allowed folder does not exist: {root}")

    groups: dict[str, list[str]] = defaultdict(list)
    for child in root.iterdir():
        if child.is_file():
            suffix = child.suffix.lower() or "no-extension"
            groups[suffix].append(child.name)

    plan_lines = [f"# File Management Plan for {root}", "", f"Task: {task}", ""]
    for suffix, names in sorted(groups.items()):
        folder_name = suffix.replace('.', '').upper() or "MISC"
        plan_lines.append(f"- Move {len(names)} `{suffix}` file(s) into `{folder_name}/` after approval.")

    if not groups:
        plan_lines.append("No files found to organize.")

    return AgentRunResult(
        task_id=task_id,
        task_type="file",
        summary="File Agent created a plan only. No files were moved, renamed, or deleted.",
        events=[RunEvent(id="scan-folder", title="Folder scanned", detail=str(root), state="done", meta="read-only")],
        artifacts={"file_plan.md": "\n".join(plan_lines)},
        approvals=[ApprovalRequest(id="execute-file-plan", title="Execute file plan", reason="Moving or renaming files affects the real computer and needs confirmation.", risk="dangerous")],
    )
