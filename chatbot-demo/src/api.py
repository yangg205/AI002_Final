"""FastAPI contract consumed by the JoyfulMind Expo frontend."""
import os
import logging
import re
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

_configured_log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_configured_log_level,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger().setLevel(_configured_log_level)

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
import storage


logger = logging.getLogger("joyfulmind.api")


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
    conversation_id: int | None = None


class AssessmentScoreRequest(BaseModel):
    answers: list[int] = Field(..., min_length=10, max_length=10)


class TrustedContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    phone: str = Field(..., min_length=7, max_length=32)


app = FastAPI(title="JoyfulMind API", version="1.0.0")
origins = [x.strip() for x in os.getenv("API_CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request_lifecycle(request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request failed id=%s method=%s path=%s", request_id, request.method, request.url.path)
        raise
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info("request complete id=%s method=%s path=%s status=%d elapsed_ms=%.1f", request_id, request.method, request.url.path, response.status_code, elapsed_ms)
    return response

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
        logger.exception("account registration failed")
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
        logger.exception("account login failed")
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
        logger.exception("current account lookup failed")
        raise _account_service_error() from error


def optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict | None:
    if credentials is None:
        return None
    return current_user(credentials)


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: dict = Depends(current_user)) -> dict:
    return {"user": user}


@app.post("/api/auth/consent", response_model=UserResponse)
def consent_to_storage(user: dict = Depends(current_user)) -> dict:
    try:
        auth.record_consent(user["id"])
        return {"user": auth.get_user(user["id"])}
    except Exception as error:
        logger.exception("consent update failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.post("/api/auth/consent/revoke", response_model=UserResponse)
def revoke_storage_consent(user: dict = Depends(current_user)) -> dict:
    try:
        auth.revoke_consent(user["id"])
        return {"user": auth.get_user(user["id"])}
    except Exception as error:
        logger.exception("consent revoke failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.get("/api/history/latest")
def latest_history(user: dict = Depends(current_user)) -> dict:
    if not user.get("consent_at"):
        return {"conversation_id": None, "messages": []}
    try:
        conversations = storage.list_conversations(user["id"], limit=1)
        if not conversations:
            return {"conversation_id": None, "messages": []}
        conversation_id = conversations[0]["id"]
        return {
            "conversation_id": conversation_id,
            "messages": storage.load_messages(user["id"], conversation_id),
        }
    except Exception as error:
        logger.exception("latest history load failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.get("/api/history")
def conversation_history(user: dict = Depends(current_user)) -> dict:
    if not user.get("consent_at"):
        return {"conversations": []}
    try:
        return {"conversations": storage.list_conversations(user["id"])}
    except Exception as error:
        logger.exception("history list failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.get("/api/history/{conversation_id}")
def conversation_detail(conversation_id: int, user: dict = Depends(current_user)) -> dict:
    if not user.get("consent_at"):
        raise HTTPException(status_code=403, detail="Bạn chưa bật lưu lịch sử trò chuyện.")
    try:
        messages = storage.load_messages(user["id"], conversation_id)
        if not messages:
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")
        return {"conversation_id": conversation_id, "messages": messages}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("history detail failed user_id=%s conversation_id=%s", user["id"], conversation_id)
        raise _account_service_error() from error


@app.get("/api/profile/trusted-contact")
def trusted_contact(user: dict = Depends(current_user)) -> dict:
    try:
        return {"contact": storage.get_trusted_contact(user["id"])}
    except Exception as error:
        logger.exception("trusted contact load failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.put("/api/profile/trusted-contact")
def save_trusted_contact(request: TrustedContactRequest, user: dict = Depends(current_user)) -> dict:
    name = request.name.strip()
    phone = "".join(char for char in request.phone if char not in " ()-.")
    if not name or not re.fullmatch(r"\+?[0-9]{7,15}", phone):
        raise HTTPException(status_code=422, detail="Tên hoặc số điện thoại liên hệ chưa hợp lệ.")
    try:
        contact = storage.save_trusted_contact(user["id"], name, phone)
        logger.info("trusted contact saved user_id=%s", user["id"])
        return {"contact": contact}
    except Exception as error:
        logger.exception("trusted contact save failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.delete("/api/profile/trusted-contact")
def delete_trusted_contact(user: dict = Depends(current_user)) -> dict:
    try:
        storage.delete_trusted_contact(user["id"])
        logger.info("trusted contact deleted user_id=%s", user["id"])
        return {"contact": None}
    except Exception as error:
        logger.exception("trusted contact delete failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.post("/api/history/delete")
def delete_history(user: dict = Depends(current_user)) -> dict:
    try:
        deleted = storage.delete_all_history(user["id"])
        return {"deleted_conversations": deleted}
    except Exception as error:
        logger.exception("history delete failed user_id=%s", user["id"])
        raise _account_service_error() from error


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "engine": "chatbot-demo",
        "ai_available": llm.is_available(),
        "rag_available": bool(rag_engine.gemini_api_key()) and rag_engine.collection_count() > 0,
    }


def _persist_turn(user: dict | None, request: ChatRequest, reply: str, risk: dict, result: dict | None) -> dict:
    if not user or not user.get("consent_at"):
        logger.info("chat history persistence skipped reason=no_consent")
        return {"conversation_id": request.conversation_id, "history_saved": False}

    try:
        db.init_schema()
        conversation_id = storage.save_turn(
            user_id=user["id"],
            conversation_id=request.conversation_id,
            user_text=request.message.strip(),
            assistant_text=reply,
            user_meta=storage.build_user_meta(risk, (result or {}).get("intent_decision")),
            assistant_meta=storage.build_assistant_meta(
                (result or {}).get("retrieval"), (result or {}).get("reply_source", "crisis_block")
            ),
            is_risk=bool(risk.get("risk")),
            risk_layer=risk.get("layer"),
            intent=(result or {}).get("intent"),
            reply_source=(result or {}).get("reply_source", "crisis_block"),
        )
        return {"conversation_id": conversation_id, "history_saved": True}
    except Exception:
        logger.exception("chat history persistence failed user_id=%s", user.get("id"))
        return {
            "conversation_id": request.conversation_id,
            "history_saved": False,
            "history_error": "Lịch sử chưa lưu được. Bạn có thể thử lại sau.",
        }


@app.post("/api/chat")
def chat(request: ChatRequest, user: dict | None = Depends(optional_current_user)) -> dict:
    text = request.message.strip()
    logger.info("chat pipeline started user_id=%s chars=%d history_messages=%d", user.get("id") if user else None, len(text), min(len(request.history), 12))
    started = time.perf_counter()
    try:
        risk = chat_pipeline.assess_risk(text)
    except Exception as error:
        logger.exception("chat pipeline failed during safety assessment user_id=%s", user.get("id") if user else None)
        raise HTTPException(status_code=503, detail="Joy chưa xử lý được tin nhắn này. Bạn thử lại sau nhé.") from error
    if risk["risk"]:
        logger.info("chat pipeline stopped at safety gate layer=%s", risk.get("layer"))
        reply = "\n".join(guardrails.crisis_message_lines())
        persistence = _persist_turn(user, request, reply, risk, None)
        logger.info("chat pipeline finished route=crisis elapsed_ms=%.1f history_saved=%s", (time.perf_counter() - started) * 1000, persistence.get("history_saved"))
        return {
            "reply": reply,
            "risk": True,
            "mode": "crisis",
            "engine": "chatbot-demo",
            "suggest_assessment": True,
            **persistence,
        }
    try:
        result = chat_pipeline.generate_reply(
            text, request.history[-12:], include_citation=True
        )
    except Exception as error:
        logger.exception("chat pipeline failed during intent or response generation user_id=%s", user.get("id") if user else None)
        raise HTTPException(status_code=503, detail="Joy chưa tạo được phản hồi lúc này. Bạn thử lại sau nhé.") from error
    source = result.get("reply_source")
    if source == "rag_error":
        mode = "unavailable"
    elif source in {"rag", "llm", "extractive"} and (result.get("retrieval") or {}).get("hits"):
        mode = "rag"
    elif source in {"fallback", "meta", "scripted", "out_of_scope"}:
        mode = "scripted"
    else:
        mode = "ai"
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
    persistence = _persist_turn(user, request, result["reply"], risk, result)
    logger.info("chat pipeline finished intent=%s source=%s elapsed_ms=%.1f history_saved=%s", result.get("intent"), source, (time.perf_counter() - started) * 1000, persistence.get("history_saved"))
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
        **persistence,
    }


@app.get("/api/assessment/questions")
def assessment_questions() -> dict:
    return {"questions": assessment.load_questions()}


@app.post("/api/assessment/score")
def assessment_score(request: AssessmentScoreRequest) -> dict:
    started = time.perf_counter()
    logger.info("PSS-10 scoring started: answers=%d", len(request.answers))
    try:
        total, level = assessment.score(request.answers)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    skill_ids = config.LEVEL_TO_SKILLS.get(level, ())
    try:
        skills = rag_engine.skill_summaries(skill_ids)
    except Exception:
        logger.exception("assessment recommendation summary retrieval failed skills=%s", skill_ids)
        skills = []
    skills_by_id = {skill.get("skill"): skill for skill in skills if skill.get("skill")}
    if any(skill_id not in skills_by_id or not skills_by_id[skill_id].get("body") for skill_id in skill_ids):
        try:
            pages = rag_engine.extract_pages()
            for skill_id in skill_ids:
                if skill_id in skills_by_id and skills_by_id[skill_id].get("body"):
                    continue
                page = config.DWM_SUMMARY_PAGES[skill_id]
                body = pages.get(page, "").strip()
                if body:
                    skills_by_id[skill_id] = {
                        "skill": skill_id,
                        "title": config.SKILL_TITLES_VI.get(skill_id, skill_id),
                        "pages": str(page),
                        "body": body,
                    }
        except Exception:
            logger.exception("assessment recommendation PDF fallback failed skills=%s", skill_ids)
    skills = [skills_by_id[skill_id] for skill_id in skill_ids if skill_id in skills_by_id]
    logger.info(
        "PSS-10 recommendations ready: available=%d elapsed_ms=%.1f",
        len(skills),
        (time.perf_counter() - started) * 1000,
    )
    return {
        "total": total,
        "maximum": config.PSS10_SCORE_MAX,
        "level": level,
        "explanation": "Kết quả tham khảo, không phải chẩn đoán y khoa.",
        "skills": [
            {
                "id": skill["skill"],
                "title": skill["title"],
                "body": skill["body"],
                "pages": skill["pages"],
                "source": "Tài liệu WHO: Những Việc Cần Làm Khi Căng Thẳng",
            }
            for skill in skills
        ],
        "needs_support": level in config.LEVELS_SHOWING_SUPPORT_BLOCK,
    }
