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
from app.routers import auth, documents, chat, settings as settings_router, api_keys, public_api


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
