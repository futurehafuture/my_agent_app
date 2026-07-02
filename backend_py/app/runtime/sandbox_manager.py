from dataclasses import dataclass
from pathlib import Path


@dataclass
class SandboxPlan:
    provider: str
    workspace_root: Path
    notes: str


def local_unix_sandbox_plan(workspace_root: Path) -> SandboxPlan:
    return SandboxPlan(
        provider="UnixLocalSandboxClient",
        workspace_root=workspace_root,
        notes="Use only for local development. Switch to Docker or a hosted sandbox for stronger isolation.",
    )
