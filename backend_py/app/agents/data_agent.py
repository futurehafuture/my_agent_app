from pathlib import Path


def run_data_agent(task: str, data_workspace: Path) -> dict[str, object]:
    """Run data analysis in an isolated workspace.

    Future implementation should let the agent write and execute Python analysis scripts,
    generate charts, export cleaned files, and return artifacts to the UI.
    """
    return {"task": task, "data_workspace": str(data_workspace), "status": "not_implemented"}
