from app.models import AgentRunResult, RunEvent


def run_research_agent(task_id: str, task: str) -> AgentRunResult:
    notes = f"""# Research Task

{task}

This minimal local version does not browse the web from the backend yet. Recommended next step: add a search provider tool and require citations for sourced claims.
"""
    return AgentRunResult(
        task_id=task_id,
        task_type="research",
        summary="Research Agent created a research brief placeholder. Add web/search tools next.",
        events=[RunEvent(id="brief", title="Research brief", detail="Generated local placeholder", state="done", meta="offline")],
        artifacts={"research_brief.md": notes},
    )
