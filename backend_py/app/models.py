from typing import Literal
from pydantic import BaseModel

TaskType = Literal["code", "data", "file", "ppt", "research", "chat"]
RiskLevel = Literal["safe", "needs_approval", "dangerous"]


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
    payload: dict[str, object]
