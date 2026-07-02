from app.models import RouteDecision


def route_task(message: str) -> RouteDecision:
    """Deterministic placeholder until the OpenAI Agents SDK router is wired in."""
    text = message.lower()

    if any(word in text for word in ["code", "项目", "代码", "bug", "build", "test", "swift", "react"]):
        return RouteDecision(
            task_type="code",
            reason="The request appears to involve source code or a software project.",
            requires_sandbox=True,
            requires_approval=True,
        )

    if any(word in text for word in ["csv", "excel", "data", "数据", "表格", "分析"]):
        return RouteDecision(
            task_type="data",
            reason="The request appears to involve tabular data analysis.",
            requires_sandbox=True,
            requires_approval=False,
        )

    if any(word in text for word in ["folder", "file", "文件", "下载", "整理"]):
        return RouteDecision(
            task_type="file",
            reason="The request appears to involve local file management.",
            requires_sandbox=False,
            requires_approval=True,
        )

    if any(word in text for word in ["ppt", "slides", "presentation", "演示", "幻灯片"]):
        return RouteDecision(
            task_type="ppt",
            reason="The request appears to involve slide or document generation.",
            requires_sandbox=True,
            requires_approval=False,
        )

    if any(word in text for word in ["search", "research", "调研", "搜索", "新闻"]):
        return RouteDecision(
            task_type="research",
            reason="The request appears to require search or research.",
            requires_sandbox=False,
            requires_approval=False,
        )

    return RouteDecision(
        task_type="chat",
        reason="Defaulted to ordinary conversation.",
        requires_sandbox=False,
        requires_approval=False,
    )
