import json
from urllib.parse import unquote

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents.agent_runner import run_task
from app.agents.router_agent import route_task
from app.runtime.diff_apply import apply_workspace_to_source
from app.runtime.mcp_manager import add_mcp_server, list_mcp_servers, remove_mcp_server
from app.runtime.run_store import get_paths
from app.runtime.settings_manager import apply_settings_to_env, load_settings, save_settings
from app.runtime.trace_manager import list_traces, read_trace
from app.runtime.workspace_manager import create_task_workspace
from app.tools.browser_tools import web_search

load_dotenv()
apply_settings_to_env()

app = FastAPI(title="My Agent App Backend", version="0.4.0")

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


class ApplyDiffRequest(BaseModel):
    task_id: str
    confirm: bool = False


class McpServerRequest(BaseModel):
    name: str
    command: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)


class LlmSettingsRequest(BaseModel):
    provider: str | None = None
    agent_model: str | None = None
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str | None = None
    deepseek_model: str | None = None
    save_traces: bool | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "my-agent-app-backend"}


@app.get("/settings/llm")
def get_llm_settings() -> dict[str, object]:
    return load_settings(mask_secrets=True)


@app.post("/settings/llm")
def update_llm_settings(request: LlmSettingsRequest) -> dict[str, object]:
    return save_settings(request.model_dump(exclude_none=True))


@app.get("/traces")
def get_traces(limit: int = 50) -> list[dict[str, object]]:
    return list_traces(limit=limit)


@app.get("/traces/{task_id}")
def get_trace(task_id: str) -> dict[str, object]:
    trace = read_trace(task_id)
    return trace or {"error": "trace not found", "task_id": task_id}


@app.post("/tasks/plan")
def plan_task(request: TaskRequest) -> dict[str, object]:
    decision = route_task(request.message, preferred_agent=request.selected_agent)
    workspace = create_task_workspace(decision.task_type)
    return {"decision": decision.model_dump(), "workspace": workspace.model_dump(), "next": "POST /tasks/run or GET /tasks/stream."}


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


@app.get("/tasks/stream")
def stream_task(
    message: str = Query(...),
    selected_agent: str | None = None,
    project_path: str | None = None,
    data_path: str | None = None,
    allowed_folder: str | None = None,
) -> StreamingResponse:
    def event_stream():
        yield _sse("event", {"id": "start", "title": "Run started", "detail": "Router is selecting a specialist Agent.", "state": "running", "meta": selected_agent or "router"})
        result = run_task(
            message=unquote(message),
            selected_agent=selected_agent,
            project_path=project_path,
            data_path=data_path,
            allowed_folder=allowed_folder,
        )
        for event in result.events:
            yield _sse("event", event.model_dump())
        yield _sse("result", result.model_dump())
        yield _sse("done", {"ok": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/tasks/apply-diff")
def apply_diff(request: ApplyDiffRequest) -> dict[str, object]:
    if not request.confirm:
        return {"ok": False, "reason": "confirm=true is required"}
    source, workspace = get_paths(request.task_id)
    if not source or not workspace:
        return {"ok": False, "reason": "No stored code run found for task_id"}
    applied = apply_workspace_to_source(source, workspace)
    return {"ok": True, "task_id": request.task_id, "applied": applied}


@app.get("/mcp/servers")
def mcp_servers() -> list[dict[str, object]]:
    return list_mcp_servers()


@app.post("/mcp/servers")
def create_mcp_server(request: McpServerRequest) -> dict[str, object]:
    return add_mcp_server(request.name, request.command, request.args, request.env)


@app.delete("/mcp/servers/{server_id}")
def delete_mcp_server(server_id: str) -> dict[str, object]:
    return {"ok": remove_mcp_server(server_id)}


@app.get("/browser/search")
def browser_search(q: str) -> list[dict[str, str]]:
    return web_search(q)


def _sse(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
