from pathlib import Path


def build_code_agent_instructions() -> str:
    return """
You are the Code Agent for My Agent App.

Rules:
1. Work only inside the copied repo workspace.
2. Inspect files before editing.
3. Prefer small patches over broad rewrites.
4. Run appropriate validation commands when available.
5. Return a summary, changed files, validation commands, and whether validation passed.
6. Never apply sandbox changes to the real project without explicit user approval.
""".strip()


def create_project_copy(original_project: Path, workspace_root: Path) -> Path:
    """Placeholder: copy a project into a workspace before handing it to SandboxAgent."""
    raise NotImplementedError("Implement safe project copy and ignore node_modules/.git/build outputs.")


def run_code_agent(task: str, workspace_repo: Path) -> dict[str, object]:
    """Placeholder for OpenAI Agents SDK SandboxAgent integration.

    Target implementation:
    - Create SandboxAgent(default_manifest=Manifest(entries={"repo": LocalDir(src=str(workspace_repo))}))
    - Configure DeepSeek through LiteLLMProvider or a custom ModelProvider
    - Run with SandboxRunConfig(client=UnixLocalSandboxClient() for local dev)
    - Return final_output plus generated diff/artifacts
    """
    return {
        "task": task,
        "workspace_repo": str(workspace_repo),
        "status": "not_implemented",
        "instructions": build_code_agent_instructions(),
    }
