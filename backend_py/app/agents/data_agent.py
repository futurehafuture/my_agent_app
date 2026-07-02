import shutil
from pathlib import Path

from app.models import AgentRunResult, RunEvent

DATA_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def run_data_agent(task_id: str, task: str, workspace_root: Path, data_path: str | None) -> AgentRunResult:
    if not data_path:
        return AgentRunResult(
            task_id=task_id,
            task_type="data",
            summary="Data Agent needs a selected CSV/XLSX file or a folder containing data files.",
            events=[RunEvent(id="missing-data", title="Missing data", detail="No data_path was provided.", state="blocked", meta="input")],
        )

    source = Path(data_path).expanduser().resolve()
    if not source.exists():
        raise FileNotFoundError(f"Data path does not exist: {source}")

    data_dir = workspace_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    copied_files = _copy_data(source, data_dir)
    report = _summarize_files(copied_files)

    return AgentRunResult(
        task_id=task_id,
        task_type="data",
        summary=f"Data Agent analyzed {len(copied_files)} file(s). {task}",
        events=[
            RunEvent(id="copy-data", title="Data copied", detail=str(data_dir), state="done", meta="workspace"),
            RunEvent(id="analyze-data", title="Data summarized", detail=f"{len(copied_files)} supported files", state="done", meta="pandas"),
        ],
        artifacts={"data_report.md": report},
    )


def _copy_data(source: Path, data_dir: Path) -> list[Path]:
    files: list[Path] = []
    if source.is_file() and source.suffix.lower() in DATA_EXTENSIONS:
        target = data_dir / source.name
        shutil.copy2(source, target)
        return [target]

    if source.is_dir():
        for child in source.iterdir():
            if child.is_file() and child.suffix.lower() in DATA_EXTENSIONS:
                target = data_dir / child.name
                shutil.copy2(child, target)
                files.append(target)
    return files


def _summarize_files(files: list[Path]) -> str:
    if not files:
        return "No CSV/XLSX files found in the selected path."

    try:
        import pandas as pd
    except Exception:
        return "pandas is not installed. Install backend requirements to enable data summaries."

    sections: list[str] = ["# Data Report"]
    for file in files:
        try:
            if file.suffix.lower() == ".csv":
                df = pd.read_csv(file)
            else:
                df = pd.read_excel(file)
            sections.append(f"\n## {file.name}")
            sections.append(f"Rows: {len(df)}")
            sections.append(f"Columns: {len(df.columns)}")
            sections.append("Columns: " + ", ".join(map(str, df.columns[:20])))
            numeric = df.select_dtypes(include="number")
            if not numeric.empty:
                sections.append("\nNumeric summary:\n" + numeric.describe().to_markdown())
        except Exception as exc:
            sections.append(f"\n## {file.name}\nFailed to read file: {exc}")
    return "\n".join(sections)
