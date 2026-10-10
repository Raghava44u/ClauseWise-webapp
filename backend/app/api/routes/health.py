from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.services.ocr_service import OCRService
from backend.app.services.grok_service import GrokService

router = APIRouter(tags=["Health"])

@router.get("/health")
@router.get("/api/v1/health")
async def health_check():
    ai_configured = bool(GrokService.get_api_key())
    ocr_status = OCRService.get_status()

    return {
        "status": "healthy",
        "service": "ClauseWise Legal Contract Analysis Platform",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "ai": {
            "provider": settings.AI_PROVIDER,
            "model": settings.AI_MODEL,
            "configured": ai_configured
        },
        "ocr": ocr_status,
        "storage": {
            "backend": settings.STORAGE_BACKEND,
            "upload_dir": settings.UPLOAD_DIR
        }
    }
