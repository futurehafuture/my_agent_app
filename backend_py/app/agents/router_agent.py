from app.models import RouteDecision


def route_task(message: str, preferred_agent: str | None = None) -> RouteDecision:
    """Route user intent to a specialist agent.

    This deterministic router makes the app usable without API keys. It can be replaced by
    an LLM structured-output router later.
    """
    if preferred_agent in {"code", "data", "file", "ppt", "research", "chat"}:
        return _decision_for(preferred_agent, "User selected this capability in the UI.")

    text = message.lower()

    if any(word in text for word in ["code", "project", "项目", "代码", "bug", "build", "test", "swift", "react", "electron"]):
        return _decision_for("code", "The request appears to involve source code or a software project.")

    if any(word in text for word in ["csv", "excel", "xlsx", "data", "数据", "表格", "分析"]):
        return _decision_for("data", "The request appears to involve tabular data analysis.")

    if any(word in text for word in ["folder", "file", "文件", "下载", "整理", "rename", "move"]):
        return _decision_for("file", "The request appears to involve local file management.")

    if any(word in text for word in ["ppt", "slides", "presentation", "演示", "幻灯片", "deck"]):
        return _decision_for("ppt", "The request appears to involve slide or document generation.")

    if any(word in text for word in ["search", "research", "调研", "搜索", "新闻"]):
        return _decision_for("research", "The request appears to require search or research.")

    return _decision_for("chat", "Defaulted to ordinary conversation.")


def _decision_for(task_type: str, reason: str) -> RouteDecision:
    return RouteDecision(
        task_type=task_type,  # type: ignore[arg-type]
        reason=reason,
        requires_sandbox=task_type in {"code", "data", "ppt"},
        requires_approval=task_type in {"code", "file"},
    )
