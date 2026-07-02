from pathlib import Path

from app.models import AgentRunResult, RunEvent


def run_ppt_agent(task_id: str, task: str, workspace_root: Path) -> AgentRunResult:
    outline = f"""# Draft Slide Outline

Task: {task}

1. Problem and user need
2. Agent platform architecture
3. Router Agent flow
4. Code sandbox workflow
5. Data analysis workflow
6. File permission workflow
7. MCP integration
8. Approval and audit model
9. Demo scenario
10. Roadmap
"""
    return AgentRunResult(
        task_id=task_id,
        task_type="ppt",
        summary="PPT Agent generated a slide outline artifact. PPTX export is the next integration step.",
        events=[RunEvent(id="outline", title="Outline generated", detail="10 slide draft", state="done", meta="artifact")],
        artifacts={"outline.md": outline},
    )
