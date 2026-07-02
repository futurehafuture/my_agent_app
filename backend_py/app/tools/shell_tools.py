import json
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


def suggest_validation_commands(repo: Path) -> list[str]:
    package_json = repo / "package.json"
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text(encoding="utf-8"))
            scripts = data.get("scripts", {})
            commands: list[str] = []
            for name in ["typecheck", "lint", "test", "build"]:
                if name in scripts:
                    commands.append(f"npm run {name}")
            return commands or ["npm run build"]
        except Exception:
            return ["npm run build"]
    if (repo / "pyproject.toml").exists():
        return ["python -m pytest"]
    if (repo / "Cargo.toml").exists():
        return ["cargo test"]
    return []
