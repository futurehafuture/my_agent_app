from pathlib import Path

from app.runtime.permissions import ensure_within_root


def list_files(root: Path, relative_path: str = ".") -> list[str]:
    target = ensure_within_root(root, root / relative_path)
    return sorted(item.name for item in target.iterdir())


def read_text_file(root: Path, relative_path: str, max_chars: int = 20000) -> str:
    target = ensure_within_root(root, root / relative_path)
    return target.read_text(encoding="utf-8", errors="replace")[:max_chars]
