from uuid import uuid4

from app.models import ApprovalRequest, RiskLevel


def create_approval(title: str, reason: str, risk: RiskLevel, payload: dict[str, object]) -> ApprovalRequest:
    return ApprovalRequest(id=f"approval-{uuid4().hex[:10]}", title=title, reason=reason, risk=risk, payload=payload)
