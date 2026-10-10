import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    AI_PROVIDER: str = "xai"
    AI_API_KEY: str = ""
    AI_BASE_URL: str = "https://api.x.ai/v1"
    AI_MODEL: str = "grok-2-latest"

    DATABASE_URL: str = "sqlite+aiosqlite:///./clausewise.db"
    
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    
    # Allowed CORS origins
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    MAX_AGENT_ROUNDS: int = 6
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_OCR_PAGES: int = 200
    
    STORAGE_BACKEND: str = "local"
    UPLOAD_DIR: str = "./uploads"
    
    ENVIRONMENT: str = "development"
    
    # OCR toggle
    ENABLE_OCR: bool = True
    
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def allowed_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL.strip())
        return origins

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

settings = Settings()
