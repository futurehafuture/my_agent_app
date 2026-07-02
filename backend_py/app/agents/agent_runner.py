from pathlib import Path
from uuid import uuid4

from app.agents.openai_agents_runtime import agents_sdk_available, run_with_openai_agents
from app.agents.profiles import get_agent_profile
from app.agents.router_agent import route_task
from app.agents.sdk_toolkit import AgentWorkspace, prepare_code_workspace, prepare_data_workspace, prepare_file_workspace
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
    """Run every task through OpenAI Agents SDK.

    The app still prepares local workspaces and stores approval metadata, but the agent
    loop, handoffs, tool calls, and final answer are handled by OpenAI Agents SDK Runner.
    """
    task_id = f"task-{uuid4().hex[:10]}"
    decision = route_task(message, preferred_agent=selected_agent)
    profile = get_agent_profile(decision.task_type)
    workspace_info = create_task_workspace(decision.task_type)
    workspace = AgentWorkspace(root=Path(workspace_info.root))

    events = [
        RunEvent(id="route", title="Router Agent prepared", detail=decision.reason, state="done", meta=decision.task_type),
        RunEvent(id="profile", title="Specialist profile available", detail=f"{profile.display_name}: {profile.instructions[:120]}", state="done", meta="Agent"),
        RunEvent(id="workspace", title="Workspace created", detail=workspace_info.root, state="done", meta="scoped"),
    ]

    try:
        if not agents_sdk_available():
            raise RuntimeError("openai-agents is required. Run: pip install -r backend_py/requirements.txt")

        if decision.task_type == "code":
            prepare_code_workspace(workspace, project_path)
            if not workspace.repo:
                return _missing_input(task_id, decision.task_type, workspace_info, "Code Agent needs an authorized project folder. Click 授权目录 first.")
        elif decision.task_type == "data":
            prepare_data_workspace(workspace, data_path)
        elif decision.task_type == "file":
            prepare_file_workspace(workspace, allowed_folder)

        sdk_output = run_with_openai_agents(
            task_id=task_id,
            task_type=decision.task_type,
            message=message,
            workspace_info=workspace_info,
            workspace=workspace,
            base_events=events,
        )
        save_run(sdk_output.result, source_path=sdk_output.source_path, workspace_repo=sdk_output.workspace_repo)
        return sdk_output.result

    except Exception as exc:
        result = AgentRunResult(
            task_id=task_id,
            task_type=decision.task_type,
            workspace=workspace_info,
            summary="OpenAI Agents SDK run failed before completion.",
            events=events + [RunEvent(id="error", title="SDK run failed", detail=str(exc), state="blocked", meta="openai-agents")],
            approvals=[ApprovalRequest(id="manual-review", title="Manual review", reason="The SDK run failed and should be inspected before retrying.", risk="needs_approval")],
            error=str(exc),
        )
        save_run(result)
        return result


def _missing_input(task_id: str, task_type: str, workspace_info, message: str) -> AgentRunResult:
    return AgentRunResult(
        task_id=task_id,
        task_type=task_type,  # type: ignore[arg-type]
        workspace=workspace_info,
        summary=message,
        events=[RunEvent(id="missing-input", title="Missing required input", detail=message, state="blocked", meta="approval")],
        approvals=[ApprovalRequest(id="choose-folder", title="Authorize folder", reason=message, risk="needs_approval")],
    )
