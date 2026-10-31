from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from typing import Any

from app.core.license import require_feature
from app.api.deps import get_current_user, get_lang, require_operator
from app.models.user import User
from app.db.session import get_db
from app.services.ai_service import AIService, OllamaError

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)


class ApplyPlanRequest(BaseModel):
    operations: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    lang: str = Depends(get_lang),
    user: User = Depends(get_current_user),
):
    """Assistant NL : répond à partir de l'état courant du périmètre de l'utilisateur."""
    try:
        return AIService(db).chat(
            payload.question, [m.model_dump() for m in payload.history], lang, user
        )
    except OllamaError as exc:
        raise HTTPException(503, str(exc))


@router.post("/apply-plan", dependencies=[Depends(require_operator), Depends(require_feature("remediation"))])
def apply_plan(payload: ApplyPlanRequest, db: Session = Depends(get_db), user: User = Depends(require_operator)):
    """Crée l'hôte + checks proposés par l'assistant (validé par un opérateur), dans son périmètre."""
    try:
        return AIService(db).apply_plan(payload.model_dump(), user)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
