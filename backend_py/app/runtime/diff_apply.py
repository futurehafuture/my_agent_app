import filecmp
import shutil
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".next", "dist", "build", "out", ".venv", "__pycache__"}


def apply_workspace_to_source(source: Path, workspace_repo: Path) -> dict[str, object]:
    """Apply changed files from sandbox workspace back to the authorized source.

    This function intentionally copies only files that exist in the sandbox. It does not
    delete source files automatically. Deletions should be a separate explicit approval.
    """
    if not source.exists() or not source.is_dir():
        raise FileNotFoundError(f"Source folder not found: {source}")
    if not workspace_repo.exists() or not workspace_repo.is_dir():
        raise FileNotFoundError(f"Workspace repo not found: {workspace_repo}")

    copied: list[str] = []
    skipped: list[str] = []

    for file in workspace_repo.rglob("*"):
        if not file.is_file():
            continue
        rel = file.relative_to(workspace_repo)
        if any(part in SKIP_DIRS for part in rel.parts):
            skipped.append(str(rel))
            continue
        target = source / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and filecmp.cmp(file, target, shallow=False):
            continue
        shutil.copy2(file, target)
        copied.append(str(rel))

    return {"copied": copied, "skipped": skipped, "deleted": []}
