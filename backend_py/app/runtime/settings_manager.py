import json
import os
from pathlib import Path
from typing import Any

SETTINGS_PATH = Path("agent_workspaces/app_settings.json")
SECRET_FIELDS = {"openai_api_key", "deepseek_api_key"}

DEFAULT_SETTINGS: dict[str, Any] = {
    "provider": "openai",
    "agent_model": "gpt-4.1-mini",
    "openai_api_key": "",
    "deepseek_api_key": "",
    "deepseek_base_url": "https://api.deepseek.com",
    "deepseek_model": "deepseek/deepseek-chat",
    "save_traces": True,
}


def load_settings(mask_secrets: bool = False) -> dict[str, Any]:
    settings = dict(DEFAULT_SETTINGS)
    if SETTINGS_PATH.exists():
        try:
            loaded = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                settings.update(loaded)
        except Exception:
            pass
    return _mask(settings) if mask_secrets else settings


def save_settings(update: dict[str, Any]) -> dict[str, Any]:
    current = load_settings(mask_secrets=False)
    for key, value in update.items():
        if key not in DEFAULT_SETTINGS or value is None:
            continue
        if key in SECRET_FIELDS and _looks_masked(str(value)):
            continue
        current[key] = value
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_settings_to_env(current)
    return _mask(current)


def apply_settings_to_env(settings: dict[str, Any] | None = None) -> None:
    settings = settings or load_settings(mask_secrets=False)

    if settings.get("openai_api_key"):
        os.environ["OPENAI_API_KEY"] = str(settings["openai_api_key"])
    if settings.get("agent_model"):
        os.environ["AGENT_MODEL"] = str(settings["agent_model"])

    if settings.get("deepseek_api_key"):
        os.environ["DEEPSEEK_API_KEY"] = str(settings["deepseek_api_key"])
    if settings.get("deepseek_base_url"):
        os.environ["DEEPSEEK_BASE_URL"] = str(settings["deepseek_base_url"])
    if settings.get("deepseek_model"):
        os.environ["DEEPSEEK_MODEL"] = str(settings["deepseek_model"])


def _looks_masked(value: str) -> bool:
    return value == "***" or "..." in value


def _mask(settings: dict[str, Any]) -> dict[str, Any]:
    masked = dict(settings)
    for field in SECRET_FIELDS:
        value = str(masked.get(field) or "")
        if value:
            masked[field] = value[:4] + "..." + value[-4:] if len(value) > 8 else "***"
    return masked
