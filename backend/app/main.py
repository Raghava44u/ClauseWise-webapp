import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.core.database import init_db
from backend.app.services.ocr_service import OCRService
from backend.app.services.grok_service import GrokAPIError

from backend.app.api.routes.health import router as health_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.conversations import router as conversations_router
from backend.app.api.routes.chat import router as chat_router
from backend.app.api.routes.research import router as research_router
from backend.app.api.routes.comparison import router as comparison_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("clausewise")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ClauseWise backend services...")
    # Initialize database tables
    await init_db()
    # Ensure uploads directory exists
    _ = settings.upload_path
    logger.info(f"ClauseWise storage initialized at: {settings.upload_path}")
    
    # Pre-check OCR readiness (non-blocking)
    if settings.ENABLE_OCR:
        try:
            available = OCRService.is_available()
            logger.info(f"OCR readiness check: {'Available' if available else 'Unavailable'}")
        except Exception as e:
            logger.warning(f"OCR background initialization warning: {e}")

    yield
    logger.info("ClauseWise backend shutting down...")

app = FastAPI(
    title="ClauseWise Legal Tech API",
    description="Enterprise legal contract analysis with deterministic quotation verification and agentic document research.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
origins = settings.allowed_origins_list
logger.info(f"Configuring CORS for permitted origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized Exception Handlers
@app.exception_handler(GrokAPIError)
async def grok_api_exception_handler(request: Request, exc: GrokAPIError):
    return JSONResponse(
        status_code=exc.status_code or 500,
        content={"error": "AI Provider Error", "detail": str(exc)}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception during request {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)}
    )

# Include API Routers
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(conversations_router)
app.include_router(chat_router)
app.include_router(research_router)
app.include_router(comparison_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
