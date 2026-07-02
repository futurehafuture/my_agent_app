from pathlib import Path
from uuid import uuid4

from app.agents.code_agent import run_code_agent
from app.agents.data_agent import run_data_agent
from app.agents.file_agent import run_file_agent
from app.agents.openai_agents_runtime import agents_sdk_available, build_sdk_agent
from app.agents.ppt_agent import run_ppt_agent
from app.agents.profiles import get_agent_profile
from app.agents.research_agent import run_research_agent
from app.agents.router_agent import route_task
from app.models import AgentRunResult, ApprovalRequest, RunEvent
from app.runtime.run_store import save_run
from app.runtime.workspace_manager import create_task_workspace


def run_task(
    message: str,
    selected_agent: str | None = None,
    project_path: str | None = None,
    data_path: str | None = None,
    allowed_folder: str | None = None,
) -> AgentRunResult:
    task_id = f"task-{uuid4().hex[:10]}"
    decision = route_task(message, preferred_agent=selected_agent)
    profile = get_agent_profile(decision.task_type)
    workspace = create_task_workspace(decision.task_type)

    sdk_note = "available" if agents_sdk_available() else "fallback runtime"
    events = [
        RunEvent(id="route", title="Router Agent handoff", detail=decision.reason, state="done", meta=decision.task_type),
        RunEvent(id="profile", title="Specialist Agent selected", detail=f"{profile.display_name}: {profile.instructions[:120]}", state="done", meta=sdk_note),
        RunEvent(id="workspace", title="Workspace created", detail=workspace.root, state="done", meta="scoped"),
    ]

    if agents_sdk_available():
        try:
            build_sdk_agent(decision.task_type, Path(workspace.root))
            events.append(RunEvent(id="sdk-agent", title="OpenAI Agents SDK profile built", detail=profile.display_name, state="done", meta="agents-sdk"))
        except Exception as exc:
            events.append(RunEvent(id="sdk-agent", title="OpenAI Agents SDK fallback", detail=str(exc), state="pending", meta="local"))

    try:
        if decision.task_type == "code":
            result = run_code_agent(task_id, message, Path(workspace.root), project_path)
        elif decision.task_type == "data":
            result = run_data_agent(task_id, message, Path(workspace.root), data_path)
        elif decision.task_type == "file":
            result = run_file_agent(task_id, message, allowed_folder)
        elif decision.task_type == "ppt":
            result = run_ppt_agent(task_id, message, Path(workspace.root))
        elif decision.task_type == "research":
            result = run_research_agent(task_id, message)
        else:
            result = AgentRunResult(
                task_id=task_id,
                task_type="chat",
                workspace=workspace,
                summary="Chat Agent ready. Ask a question or choose Code/Data/File/Research/PPT for tool use.",
                events=[RunEvent(id="chat", title="Chat response", detail="No sandbox required.", state="done", meta="chat")],
                artifacts={"agent_profile.txt": profile.instructions},
            )

        result.workspace = result.workspace or workspace
        result.events = events + result.events
        result.artifacts.setdefault("agent_profile.txt", profile.instructions)
        save_run(result)
        return result

    except Exception as exc:  # keep UI alive and visible
        result = AgentRunResult(
            task_id=task_id,
            task_type=decision.task_type,
            workspace=workspace,
            summary="The agent run failed before completion.",
            events=events + [RunEvent(id="error", title="Run failed", detail=str(exc), state="blocked", meta="error")],
            approvals=[ApprovalRequest(id="manual-review", title="Manual review", reason="The run failed and should be inspected before retrying.", risk="needs_approval")],
            error=str(exc),
        )
        save_run(result)
        return result
