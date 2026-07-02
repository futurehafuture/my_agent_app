from pathlib import Path


def create_file_management_plan(task: str, allowed_folder: Path) -> dict[str, object]:
    """Create a plan before any move/delete/rename action is executed."""
    return {
        "task": task,
        "allowed_folder": str(allowed_folder),
        "requires_approval": True,
        "status": "plan_only",
    }
