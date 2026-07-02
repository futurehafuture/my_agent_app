from pathlib import Path
from typing import Any

from app.agents.profiles import get_agent_profile


def agents_sdk_available() -> bool:
    try:
        import agents  # noqa: F401
        return True
    except Exception:
        return False


def build_sdk_agent(agent_name: str, workspace: Path | None = None) -> Any:
    """Create a real OpenAI Agents SDK Agent when the package is installed.

    Specialist agents are not pipeline steps. Each profile becomes its own Agent with
    its own instructions and tool surface. The deterministic local workflows remain as
    a fallback so the app can run without credentials.
    """
    profile = get_agent_profile(agent_name)
    try:
        from agents import Agent
    except Exception as exc:
        raise RuntimeError("openai-agents is not installed. Install backend requirements first.") from exc

    return Agent(
        name=profile.display_name,
        instructions=profile.instructions,
        tools=[],
    )


def build_sandbox_agent(agent_name: str, workspace: Path) -> Any:
    """Create SandboxAgent if the installed SDK version supports it.

    The exact OpenAI Agents SDK sandbox provider APIs have changed across versions, so
    this adapter isolates the import path. The local Docker/workspace fallback is used
    if SandboxAgent is unavailable.
    """
    profile = get_agent_profile(agent_name)
    try:
        from agents.sandbox import Manifest, SandboxAgent
        from agents.sandbox.entries import LocalDir
    except Exception as exc:
        raise RuntimeError("SandboxAgent is unavailable in this openai-agents installation.") from exc

    return SandboxAgent(
        name=profile.display_name,
        instructions=profile.instructions,
        default_manifest=Manifest(entries={"repo": LocalDir(src=str(workspace))}),
    )
