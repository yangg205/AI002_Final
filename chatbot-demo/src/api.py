"""FastAPI contract consumed by the JoyfulMind Expo frontend."""
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

import assessment
import auth
import chat_pipeline
import config
import db
import guardrails
import llm
import rag_engine


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=128)


class PublicUser(BaseModel):
    id: int
    username: str
    consent_at: datetime | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: PublicUser


class UserResponse(BaseModel):
    user: PublicUser


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    history: list[dict] = Field(default_factory=list, max_length=12)


class AssessmentScoreRequest(BaseModel):
    answers: list[int] = Field(..., min_length=10, max_length=10)


app = FastAPI(title="JoyfulMind API", version="1.0.0")
origins = [x.strip() for x in os.getenv("API_CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

_bearer = HTTPBearer(auto_error=False)


def _account_service_error() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="Dịch vụ tài khoản tạm thời không khả dụng.",
    )


def _token_config_error(error: auth.AuthTokenConfigError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(error))


def _token_response(user: dict) -> dict:
    try:
        token = auth.issue_access_token(user)
    except auth.AuthTokenConfigError as error:
        raise _token_config_error(error) from error
    return {**token, "user": user}


@app.post("/api/auth/register", status_code=201, response_model=AuthResponse)
def register(request: RegisterRequest, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    problem = auth.validate_username(request.username) or auth.validate_password(
        request.password
    )
    if problem:
        raise HTTPException(status_code=422, detail=problem)

    try:
        auth.ensure_token_signing_configured()
        db.init_schema()
        user = auth.create_user(request.username, request.password)
    except auth.AuthTokenConfigError as error:
        raise _token_config_error(error) from error
    except auth.AuthError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except Exception as error:
        if getattr(error, "sqlstate", None) == "23505":
            raise HTTPException(
                status_code=409,
                detail="Tên đăng nhập này đã có người dùng.",
            ) from error
        raise _account_service_error() from error
    return _token_response(user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(request: LoginRequest, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    try:
        auth.ensure_token_signing_configured()
        db.init_schema()
        user = auth.authenticate(request.username, request.password)
    except auth.AuthTokenConfigError as error:
        raise _token_config_error(error) from error
    except auth.AuthError as error:
        locked = "khóa" in str(error).casefold() or "khoá" in str(error).casefold()
        raise HTTPException(
            status_code=423 if locked else 401,
            detail=str(error),
            headers=None if locked else {"WWW-Authenticate": "Bearer"},
        ) from error
    except Exception as error:
        raise _account_service_error() from error
    return _token_response(user)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Cần access token để sử dụng endpoint này.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = auth.decode_access_token(credentials.credentials)
        db.init_schema()
        return auth.get_user(int(claims["sub"]))
    except auth.AuthTokenConfigError as error:
        raise _token_config_error(error) from error
    except auth.AuthError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except Exception as error:
        raise _account_service_error() from error


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: dict = Depends(current_user)) -> dict:
    return {"user": user}


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "engine": "chatbot-demo",
        "ai_available": llm.is_available(),
        "rag_available": bool(rag_engine.gemini_api_key()),
    }


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict:
    text = request.message.strip()
    risk = chat_pipeline.assess_risk(text)
    if risk["risk"]:
        return {
            "reply": "\n".join(guardrails.crisis_message_lines()),
            "risk": True,
            "mode": "crisis",
            "engine": "chatbot-demo",
            "suggest_assessment": True,
        }
    result = chat_pipeline.generate_reply(
        text, request.history[-12:], include_citation=True
    )
    source = result.get("reply_source")
    mode = (
        "rag"
        if source == "rag"
        else "scripted"
        if source in {"fallback", "meta"}
        else "ai"
    )
    sources = []
    for hit in (result.get("retrieval") or {}).get("hits", []):
        pages = hit.get("pages") or []
        if pages:
            sources.append(
                {
                    "title": config.SKILL_TITLES_VI.get(
                        hit.get("skill"), hit.get("skill", "")
                    ),
                    "pages": ", ".join(str(page) for page in pages),
                }
            )
    lowered = text.casefold()
    suggest = any(
        keyword in lowered for keyword in config.ASSESSMENT_TRIGGER_KEYWORDS
    ) or len(request.history) >= config.TURNS_BEFORE_OFFERING_ASSESSMENT * 2
    return {
        "reply": result["reply"],
        "risk": False,
        "mode": mode,
        "engine": "chatbot-demo",
        "intent": result.get("intent"),
        "suggest_assessment": suggest,
        "sources": sources,
    }


@app.get("/api/assessment/questions")
def assessment_questions() -> dict:
    return {"questions": assessment.load_questions()}


@app.post("/api/assessment/score")
def assessment_score(request: AssessmentScoreRequest) -> dict:
    try:
        total, level = assessment.score(request.answers)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {
        "total": total,
        "maximum": config.PSS10_SCORE_MAX,
        "level": level,
        "explanation": "Kết quả tham khảo, không phải chẩn đoán y khoa.",
        "skills": [
            {"id": skill, "title": config.SKILL_TITLES_VI.get(skill, skill)}
            for skill in config.LEVEL_TO_SKILLS.get(level, ())
        ],
        "needs_support": level in config.LEVELS_SHOWING_SUPPORT_BLOCK,
    }
