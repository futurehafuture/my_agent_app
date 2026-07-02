import difflib
import subprocess
from pathlib import Path

TEXT_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html", ".yml", ".yaml", ".toml"}


def git_diff(repo_path: Path) -> str:
    if not (repo_path / ".git").exists():
        return ""
    completed = subprocess.run(
        ["git", "diff", "--no-ext-diff"],
        cwd=repo_path,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
        check=False,
    )
    return completed.stdout if completed.returncode == 0 else completed.stderr


def directory_diff(original: Path, modified: Path, max_files: int = 80) -> str:
    chunks: list[str] = []
    checked = 0
    for mod_file in sorted(modified.rglob("*")):
        if checked >= max_files:
            chunks.append("\n... diff truncated ...")
            break
        if not mod_file.is_file() or mod_file.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        rel = mod_file.relative_to(modified)
        orig_file = original / rel
        if not orig_file.exists():
            chunks.append(f"Added file: {rel}")
            continue
        try:
            before = orig_file.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
            after = mod_file.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
        except Exception:
            continue
        if before != after:
            checked += 1
            chunks.extend(difflib.unified_diff(before, after, fromfile=str(orig_file), tofile=str(mod_file), n=3))
    return "".join(chunks) or "No file changes detected."
