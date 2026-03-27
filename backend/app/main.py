import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.database import connect_db, close_db
from app.services.private_db_service import close_all_private_clients
from app.routers import auth, documents, chat, settings as settings_router, api_keys, public_api, voice_call, website, embed, shared, bookmarks, analytics, teams, workspace, sharespace
from app.routers.webhooks import router as webhooks_api_router, user_router as webhooks_user_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_all_private_clients()
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    description="Chat with your PDF documents using AI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handle Pydantic validation errors as user-friendly strings
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for err in errors:
        field = " > ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        msg = err.get("msg", "Validation error")
        messages.append(f"{field}: {msg}" if field else msg)
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(messages)},
    )


# Global exception handler to surface errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


# Routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(settings_router.router)
app.include_router(api_keys.router)
app.include_router(public_api.router)
app.include_router(voice_call.router)
app.include_router(website.router)
app.include_router(embed.router)
app.include_router(shared.router)
app.include_router(bookmarks.router)
app.include_router(analytics.router)
app.include_router(webhooks_api_router)
app.include_router(webhooks_user_router)
app.include_router(workspace.router)
app.include_router(sharespace.router)
app.include_router(teams.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/health/db")
async def health_db():
    """Diagnostic endpoint to check DB connectivity."""
    from app.database import get_db, client
    import traceback
    try:
        db = get_db()
        if db is None:
            return {"status": "error", "detail": "db is None"}
        # Ping the database
        result = await client.admin.command("ping")
        return {"status": "ok", "ping": result}
    except Exception as e:
        return {"status": "error", "detail": str(e), "type": type(e).__name__, "trace": traceback.format_exc()}


@app.get("/api/health/smtp")
async def health_smtp():
    """Diagnostic endpoint to test SMTP connectivity."""
    import asyncio
    import smtplib
    try:
        def _test_smtp():
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                return "SMTP login successful"

        result = await asyncio.get_event_loop().run_in_executor(None, _test_smtp)
        return {
            "status": "ok",
            "detail": result,
            "smtp_host": settings.SMTP_HOST,
            "smtp_port": settings.SMTP_PORT,
            "smtp_user": settings.SMTP_USER,
            "smtp_from": settings.SMTP_FROM_EMAIL,
            "frontend_url": settings.FRONTEND_URL,
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "detail": str(e),
            "type": type(e).__name__,
            "smtp_host": settings.SMTP_HOST,
            "smtp_port": settings.SMTP_PORT,
            "smtp_user": settings.SMTP_USER,
            "trace": traceback.format_exc(),
        }
