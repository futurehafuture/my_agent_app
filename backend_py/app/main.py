from fastapi import FastAPI
from pydantic import BaseModel

from app.agents.router_agent import route_task
from app.runtime.workspace_manager import create_task_workspace

app = FastAPI(title="My Agent App Backend", version="0.1.0")


class TaskRequest(BaseModel):
    message: str
    project_path: str | None = None
    data_path: str | None = None
    allowed_folder: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tasks/plan")
def plan_task(request: TaskRequest) -> dict[str, object]:
    decision = route_task(request.message)
    workspace = create_task_workspace(decision.task_type)
    return {
        "decision": decision.model_dump(),
        "workspace": workspace.model_dump(),
        "next": "Connect this endpoint to the specialist agent runner.",
    }
