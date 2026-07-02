from app.models import AgentRunResult, RunEvent
from app.tools.browser_tools import web_search


def run_research_agent(task_id: str, task: str) -> AgentRunResult:
    results = web_search(task, max_results=6)
    lines = ["# Research Brief", "", f"Query: {task}", ""]
    for index, item in enumerate(results, start=1):
        lines.append(f"## {index}. {item.get('title', 'Untitled')}")
        lines.append(item.get("url", ""))
        lines.append(item.get("snippet", ""))
        lines.append("")

    return AgentRunResult(
        task_id=task_id,
        task_type="research",
        summary=f"Research Agent searched the web and collected {len(results)} result(s).",
        events=[RunEvent(id="search", title="Browser search", detail=f"{len(results)} result cards", state="done", meta="web")],
        artifacts={"research_brief.md": "\n".join(lines)},
    )
