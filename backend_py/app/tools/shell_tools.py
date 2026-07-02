import subprocess
from pathlib import Path

from app.runtime.permissions import is_risky_command


def run_command(workspace_root: Path, command: list[str], timeout_seconds: int = 30) -> dict[str, object]:
    joined = " ".join(command)
    if is_risky_command(joined):
        return {"blocked": True, "reason": "Command requires approval", "command": joined}

    completed = subprocess.run(
        command,
        cwd=workspace_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout_seconds,
        check=False,
    )
    return {
        "blocked": False,
        "returncode": completed.returncode,
        "stdout": completed.stdout[-20000:],
        "stderr": completed.stderr[-20000:],
    }
