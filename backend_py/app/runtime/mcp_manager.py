import json
from pathlib import Path
from typing import Any
from uuid import uuid4

MCP_REGISTRY = Path("agent_workspaces/mcp_servers.json")


def list_mcp_servers() -> list[dict[str, Any]]:
    if not MCP_REGISTRY.exists():
        return []
    try:
        return json.loads(MCP_REGISTRY.read_text(encoding="utf-8"))
    except Exception:
        return []


def add_mcp_server(name: str, command: str, args: list[str] | None = None, env: dict[str, str] | None = None) -> dict[str, Any]:
    servers = list_mcp_servers()
    item = {
        "id": f"mcp-{uuid4().hex[:10]}",
        "name": name,
        "command": command,
        "args": args or [],
        "env": env or {},
        "enabled": True,
    }
    servers.append(item)
    MCP_REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    MCP_REGISTRY.write_text(json.dumps(servers, ensure_ascii=False, indent=2), encoding="utf-8")
    return item


def remove_mcp_server(server_id: str) -> bool:
    servers = list_mcp_servers()
    next_servers = [server for server in servers if server.get("id") != server_id]
    MCP_REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    MCP_REGISTRY.write_text(json.dumps(next_servers, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(next_servers) != len(servers)
