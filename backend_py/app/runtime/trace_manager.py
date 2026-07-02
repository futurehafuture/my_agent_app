import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models import AgentRunResult
from app.runtime.settings_manager import load_settings

TRACE_ROOT = Path("agent_workspaces/traces")


def save_trace(result: AgentRunResult, *, request: dict[str, Any] | None = None, extra: dict[str, Any] | None = None) -> str | None:
    settings = load_settings(mask_secrets=False)
    if not settings.get("save_traces", True):
        return None

    TRACE_ROOT.mkdir(parents=True, exist_ok=True)
    path = TRACE_ROOT / f"{result.task_id}.json"
    payload = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "request": request or {},
        "result": result.model_dump(),
        "extra": extra or {},
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path.resolve())


def list_traces(limit: int = 50) -> list[dict[str, Any]]:
    if not TRACE_ROOT.exists():
        return []
    items: list[dict[str, Any]] = []
    for path in sorted(TRACE_ROOT.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)[:limit]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            result = data.get("result", {})
            items.append({
                "task_id": result.get("task_id", path.stem),
                "task_type": result.get("task_type", "unknown"),
                "summary": str(result.get("summary", ""))[:240],
                "path": str(path.resolve()),
                "saved_at": data.get("saved_at", ""),
            })
        except Exception:
            items.append({"task_id": path.stem, "task_type": "unknown", "summary": "Failed to parse trace", "path": str(path.resolve()), "saved_at": ""})
    return items


def read_trace(task_id: str) -> dict[str, Any] | None:
    path = TRACE_ROOT / f"{task_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
