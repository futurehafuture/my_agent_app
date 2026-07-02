import subprocess
from pathlib import Path


def git_diff(repo_path: Path) -> str:
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
