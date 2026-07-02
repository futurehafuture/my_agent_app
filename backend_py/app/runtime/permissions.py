from pathlib import Path


class PermissionError(Exception):
    pass


def ensure_within_root(root: Path, candidate: Path) -> Path:
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    if resolved_root != resolved_candidate and resolved_root not in resolved_candidate.parents:
        raise PermissionError(f"Path escapes allowed root: {resolved_candidate}")
    return resolved_candidate


def is_risky_command(command: str) -> bool:
    risky_tokens = ["rm ", "sudo", "chmod", "chown", "curl |", "wget |", "dd ", "mkfs"]
    normalized = command.lower()
    return any(token in normalized for token in risky_tokens)
