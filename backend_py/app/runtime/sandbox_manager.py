import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SandboxPlan:
    provider: str
    workspace_root: Path
    notes: str
    available: bool = True


def local_unix_sandbox_plan(workspace_root: Path) -> SandboxPlan:
    return SandboxPlan(
        provider="LocalWorkspace",
        workspace_root=workspace_root,
        notes="Use only for local development. Switch to Docker or OpenAI SandboxAgent for stronger isolation.",
    )


def docker_sandbox_plan(workspace_root: Path) -> SandboxPlan:
    docker = shutil.which("docker")
    available = bool(docker)
    return SandboxPlan(
        provider="Docker",
        workspace_root=workspace_root,
        notes="Docker is available. Run commands through docker_run_command for stronger filesystem/process isolation." if available else "Docker is not installed or not on PATH.",
        available=available,
    )


def docker_run_command(workspace_root: Path, command: list[str], image: str = "python:3.12-slim", timeout_seconds: int = 120) -> dict[str, object]:
    if not shutil.which("docker"):
        return {"blocked": True, "reason": "Docker is not installed"}
    docker_cmd = [
        "docker",
        "run",
        "--rm",
        "--network",
        "none",
        "-v",
        f"{workspace_root.resolve()}:/workspace",
        "-w",
        "/workspace",
        image,
        *command,
    ]
    completed = subprocess.run(docker_cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_seconds, check=False)
    return {"blocked": False, "returncode": completed.returncode, "stdout": completed.stdout[-20000:], "stderr": completed.stderr[-20000:]}


def openai_sandbox_available() -> bool:
    try:
        from agents.sandbox import SandboxAgent  # noqa: F401
        return True
    except Exception:
        return False
