from typing import Literal
from pydantic import BaseModel, Field

TaskType = Literal["code", "data", "file", "ppt", "research", "chat"]
RiskLevel = Literal["safe", "needs_approval", "dangerous"]
EventState = Literal["pending", "running", "done", "blocked"]


class RouteDecision(BaseModel):
    task_type: TaskType
    reason: str
    requires_sandbox: bool
    requires_approval: bool


class WorkspaceInfo(BaseModel):
    id: str
    task_type: TaskType
    root: str


class ApprovalRequest(BaseModel):
    id: str
    title: str
    reason: str
    risk: RiskLevel
    payload: dict[str, object] = Field(default_factory=dict)


class RunEvent(BaseModel):
    id: str
    title: str
    detail: str
    state: EventState
    meta: str = ""


class AgentRunResult(BaseModel):
    task_id: str
    task_type: TaskType
    summary: str
    workspace: WorkspaceInfo | None = None
    events: list[RunEvent] = Field(default_factory=list)
    artifacts: dict[str, str] = Field(default_factory=dict)
    approvals: list[ApprovalRequest] = Field(default_factory=list)
    diff: str = ""
    error: str | None = None
