import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from app.agents.profiles import get_agent_profile
from app.agents.sdk_toolkit import AgentWorkspace, create_tools
from app.models import AgentRunResult, ApprovalRequest, RunEvent, WorkspaceInfo
from app.tools.diff_tools import directory_diff, git_diff


@dataclass
class SDKRunOutput:
    result: AgentRunResult
    source_path: str | None = None
    workspace_repo: str | None = None


def agents_sdk_available() -> bool:
    try:
        import agents  # noqa: F401
        return True
    except Exception:
        return False


def build_agent_network(workspace: AgentWorkspace) -> Any:
    """Build the whole app as OpenAI Agents SDK agents and handoffs.

    Router is the entry agent. Specialists are real SDK Agents with their own
    instructions and shared sandbox-bound function tools.
    """
    from agents import Agent

    tools = create_tools(workspace)

    code_profile = get_agent_profile("code")
    data_profile = get_agent_profile("data")
    file_profile = get_agent_profile("file")
    ppt_profile = get_agent_profile("ppt")
    research_profile = get_agent_profile("research")
    chat_profile = get_agent_profile("chat")

    model = os.getenv("AGENT_MODEL") or os.getenv("DEEPSEEK_MODEL") or None

    code_agent = Agent(
        name=code_profile.display_name,
        handoff_description="Use for reading, editing, validating, and diffing code inside the sandbox repo.",
        instructions=code_profile.instructions + "\nYou must use tools for file inspection, edits, validation, and diff review.",
        tools=tools,
        model=model,
    )
    data_agent = Agent(
        name=data_profile.display_name,
        handoff_description="Use for CSV/XLSX data analysis and report artifacts.",
        instructions=data_profile.instructions + "\nUse summarize_data when data files are available.",
        tools=tools,
        model=model,
    )
    file_agent = Agent(
        name=file_profile.display_name,
        handoff_description="Use for local approved-folder inspection and plan-only file management.",
        instructions=file_profile.instructions + "\nUse scan_allowed_folder. Never claim files were moved unless an apply endpoint confirms it.",
        tools=tools,
        model=model,
    )
    ppt_agent = Agent(
        name=ppt_profile.display_name,
        handoff_description="Use for slide outlines and real PPTX generation.",
        instructions=ppt_profile.instructions + "\nCall create_pptx with a concise deck title and slide titles.",
        tools=tools,
        model=model,
    )
    research_agent = Agent(
        name=research_profile.display_name,
        handoff_description="Use for web research and source collection.",
        instructions=research_profile.instructions + "\nUse browser_search for current web information and cite URLs in the final answer.",
        tools=tools,
        model=model,
    )
    chat_agent = Agent(
        name=chat_profile.display_name,
        handoff_description="Use for ordinary questions that need no tools.",
        instructions=chat_profile.instructions,
        model=model,
    )

    router_profile = get_agent_profile("router")
    return Agent(
        name=router_profile.display_name,
        instructions=(
            router_profile.instructions
            + "\nYou are the only entry point. Decide which specialist should take over. "
            + "Use handoffs; do not solve specialist tasks yourself. "
            + "For code, hand off to Code Agent. For spreadsheets or data, Data Agent. "
            + "For local file organization, File Manager Agent. For slide creation, PPT Agent. "
            + "For web research, Browser Research Agent. Otherwise Chat Agent."
        ),
        handoffs=[code_agent, data_agent, file_agent, ppt_agent, research_agent, chat_agent],
        model=model,
    )


def get_run_config() -> Any | None:
    """Return RunConfig for non-OpenAI providers when configured.

    For DeepSeek, use the Agents SDK LiteLLM provider path. If no DeepSeek key is set,
    the SDK uses its default OpenAI provider and OPENAI_API_KEY.
    """
    if not os.getenv("DEEPSEEK_API_KEY"):
        return None
    os.environ.setdefault("LITELLM_LOG", "ERROR")
    os.environ.setdefault("DEEPSEEK_API_KEY", os.getenv("DEEPSEEK_API_KEY", ""))
    try:
        from agents import RunConfig
        from agents.extensions.models.litellm_provider import LitellmProvider
    except Exception:
        return None
    return RunConfig(model_provider=LitellmProvider())


def run_with_openai_agents(
    *,
    task_id: str,
    task_type: str,
    message: str,
    workspace_info: WorkspaceInfo,
    workspace: AgentWorkspace,
    base_events: list[RunEvent],
) -> SDKRunOutput:
    from agents import Runner

    router = build_agent_network(workspace)
    run_config = get_run_config()
    kwargs: dict[str, Any] = {"max_turns": 30}
    if run_config is not None:
        kwargs["run_config"] = run_config

    result = Runner.run_sync(router, message, **kwargs)
    final_output = str(result.final_output)
    events = base_events + [RunEvent(id="sdk-run", title="OpenAI Agents SDK Runner", detail="Runner completed agent loop, tools, and handoffs.", state="done", meta="Runner.run_sync")]
    artifacts = dict(workspace.artifacts)
    artifacts["tool_logs.txt"] = "\n".join(workspace.tool_logs) or "No tool calls captured."

    diff = ""
    if workspace.repo and workspace.source_project:
        diff = git_diff(workspace.repo) or directory_diff(workspace.source_project, workspace.repo)
        artifacts["diff.patch"] = diff

    approvals: list[ApprovalRequest] = []
    if task_type == "code":
        approvals.append(ApprovalRequest(id="apply-diff", title="Apply sandbox diff", reason="OpenAI Agents SDK modified the sandbox. Review before applying to the real project.", risk="dangerous", payload={"task_id": task_id}))
    if task_type == "file":
        approvals.append(ApprovalRequest(id="execute-file-plan", title="Execute file plan", reason="File changes affect the real computer and require confirmation.", risk="dangerous", payload={"task_id": task_id}))

    output = AgentRunResult(
        task_id=task_id,
        task_type=task_type,  # type: ignore[arg-type]
        summary=final_output,
        workspace=workspace_info,
        events=events,
        artifacts=artifacts,
        approvals=approvals,
        diff=diff,
    )
    return SDKRunOutput(
        result=output,
        source_path=str(workspace.source_project) if workspace.source_project else None,
        workspace_repo=str(workspace.repo) if workspace.repo else None,
    )


def stream_with_openai_agents(
    *,
    message: str,
    workspace: AgentWorkspace,
) -> Iterable[dict[str, object]]:
    """Yield coarse SDK stream events.

    The frontend receives SSE from FastAPI. We expose SDK stream event types where
    possible without leaking provider internals.
    """
    from agents import Runner

    router = build_agent_network(workspace)
    run_config = get_run_config()
    kwargs: dict[str, Any] = {"max_turns": 30}
    if run_config is not None:
        kwargs["run_config"] = run_config
    result = Runner.run_streamed(router, message, **kwargs)
    yield {"id": "sdk-stream", "title": "OpenAI Agents SDK stream", "detail": "SDK stream started.", "state": "running", "meta": "run_streamed"}
    # The SDK stream is async; FastAPI sync endpoints use the run_sync path for final output.
    # This marker keeps the app using the SDK architecture while avoiding event-loop conflicts.
