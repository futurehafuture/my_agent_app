from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agents.agent_runner import run_task
from app.agents.router_agent import route_task
from app.runtime.workspace_manager import create_task_workspace

app = FastAPI(title="My Agent App Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "file://"],
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    message: str
    selected_agent: str | None = None
    project_path: str | None = None
    data_path: str | None = None
    allowed_folder: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "my-agent-app-backend"}


@app.post("/tasks/plan")
def plan_task(request: TaskRequest) -> dict[str, object]:
    decision = route_task(request.message, preferred_agent=request.selected_agent)
    workspace = create_task_workspace(decision.task_type)
    return {
        "decision": decision.model_dump(),
        "workspace": workspace.model_dump(),
        "next": "POST /tasks/run to execute a safe minimal agent workflow.",
    }


@app.post("/tasks/run")
def execute_task(request: TaskRequest) -> dict[str, object]:
    result = run_task(
        message=request.message,
        selected_agent=request.selected_agent,
        project_path=request.project_path,
        data_path=request.data_path,
        allowed_folder=request.allowed_folder,
    )
    return result.model_dump()
