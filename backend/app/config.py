from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "pdf_gyan"

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Encryption
    ENCRYPTION_KEY: str

    # Platform OpenAI Key
    PLATFORM_OPENAI_KEY: str = ""
    DEFAULT_OPENAI_CHAT_MODEL: str = "gpt-4o"
    DEFAULT_OPENAI_INDEX_MODEL: str = "gpt-4o-2024-11-20"
    OPENAI_TTS_MODEL: str = "gpt-4o-mini-tts"
    OPENAI_TTS_VOICE: str = "coral"

    # Ollama
    DEFAULT_OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    DEFAULT_OLLAMA_MODEL: str = "llama3.1:latest"
    OLLAMA_REQUEST_TIMEOUT_SECONDS: int = 5

    # App
    APP_NAME: str = "PDF Gyan"
    CORS_ORIGINS: str = "http://localhost:5173"

    # SMTP / Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@pdfgyan.com"
    FRONTEND_URL: str = "http://localhost:5173"

    # Password Reset
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # Signup Email Verification
    SIGNUP_OTP_EXPIRE_MINUTES: int = 10
    SIGNUP_OTP_RESEND_COOLDOWN_SECONDS: int = 60
    SIGNUP_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 20

    # Upload
    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "uploads"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
