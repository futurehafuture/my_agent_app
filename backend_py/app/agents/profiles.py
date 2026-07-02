from dataclasses import dataclass, field
from typing import Literal

AgentName = Literal["router", "code", "data", "file", "ppt", "research", "chat"]


@dataclass(frozen=True)
class AgentProfile:
    name: AgentName
    display_name: str
    instructions: str
    tools: list[str] = field(default_factory=list)
    needs_sandbox: bool = False
    approval_required: bool = False


AGENT_PROFILES: dict[str, AgentProfile] = {
    "router": AgentProfile(
        name="router",
        display_name="Router Agent",
        instructions="Classify the user request and hand it to the best specialist agent. Do not execute tools directly.",
        tools=["route_task"],
    ),
    "code": AgentProfile(
        name="code",
        display_name="Code Agent",
        instructions="""
You are a specialist Code Agent.
Work only inside the provided sandbox repo.
Inspect files before editing.
Use tools to list, read, patch, and validate code.
Prefer small, reversible changes.
After validation, summarize changed files, commands, and remaining risk.
Never write to the original source project directly.
""".strip(),
        tools=["list_files", "read_file", "write_file", "run_command", "git_diff"],
        needs_sandbox=True,
        approval_required=True,
    ),
    "data": AgentProfile(
        name="data",
        display_name="Data Analysis Agent",
        instructions="Analyze copied CSV/XLSX data in a workspace, generate summaries, charts, and reusable reports.",
        tools=["summarize_data", "write_report", "export_artifact"],
        needs_sandbox=True,
    ),
    "file": AgentProfile(
        name="file",
        display_name="File Manager Agent",
        instructions="Scan only approved folders and create a plan. Do not move, rename, or delete real files without approval.",
        tools=["scan_folder", "create_plan"],
        approval_required=True,
    ),
    "ppt": AgentProfile(
        name="ppt",
        display_name="PPT Agent",
        instructions="Turn notes, research, or data into a real PPTX artifact with clear slide structure.",
        tools=["create_pptx", "export_artifact"],
        needs_sandbox=True,
    ),
    "research": AgentProfile(
        name="research",
        display_name="Browser Research Agent",
        instructions="Search the web, collect source snippets, and return a cited research brief.",
        tools=["web_search", "read_page", "write_brief"],
    ),
    "chat": AgentProfile(
        name="chat",
        display_name="Chat Agent",
        instructions="Answer directly when no tool or sandbox is needed.",
    ),
}


def get_agent_profile(name: str) -> AgentProfile:
    return AGENT_PROFILES.get(name, AGENT_PROFILES["chat"])
