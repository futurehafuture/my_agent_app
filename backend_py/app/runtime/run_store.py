from pathlib import Path
from threading import RLock
from typing import Any

from app.models import AgentRunResult

_lock = RLock()
_runs: dict[str, dict[str, Any]] = {}


def save_run(result: AgentRunResult, *, source_path: str | None = None, workspace_repo: str | None = None) -> None:
    with _lock:
        previous = _runs.get(result.task_id, {})
        _runs[result.task_id] = {
            "result": result,
            "source_path": source_path if source_path is not None else previous.get("source_path"),
            "workspace_repo": workspace_repo if workspace_repo is not None else previous.get("workspace_repo"),
        }


def get_run(task_id: str) -> dict[str, Any] | None:
    with _lock:
        return _runs.get(task_id)


def get_result(task_id: str) -> AgentRunResult | None:
    record = get_run(task_id)
    return record["result"] if record else None


def get_paths(task_id: str) -> tuple[Path | None, Path | None]:
    record = get_run(task_id)
    if not record:
        return None, None
    source = Path(record["source_path"]) if record.get("source_path") else None
    workspace = Path(record["workspace_repo"]) if record.get("workspace_repo") else None
    return source, workspace
