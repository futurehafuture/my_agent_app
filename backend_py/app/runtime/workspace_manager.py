from pathlib import Path
from uuid import uuid4

from app.models import TaskType, WorkspaceInfo

WORKSPACE_ROOT = Path("agent_workspaces")


def create_task_workspace(task_type: TaskType) -> WorkspaceInfo:
    workspace_id = f"{task_type}-{uuid4().hex[:10]}"
    root = WORKSPACE_ROOT / workspace_id
    root.mkdir(parents=True, exist_ok=True)
    return WorkspaceInfo(id=workspace_id, task_type=task_type, root=str(root.resolve()))
