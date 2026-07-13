"""Application settings loaded from environment via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repository root = backend/.. ; backend dir = this file's parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Central configuration. Values come from environment or a .env file."""

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "local"
    app_name: str = "Equipment Additional Information Tool"
    log_level: str = "INFO"

    # Database — a full URL wins; otherwise it is assembled from parts.
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5544
    postgres_db: str = "equipment_addl_info"
    postgres_user: str = "eai_app"
    postgres_password: str = "change_me_local_only"

    # Security
    secret_key: str = "dev-only-insecure-secret-change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 1440
    jwt_algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Storage
    storage_dir: str = str(REPO_ROOT / "storage")
    upload_dir: str = str(REPO_ROOT / "storage" / "uploads")
    export_dir: str = str(REPO_ROOT / "storage" / "exports")

    # Upload / import
    max_upload_size_mb: int = 25
    header_search_rows: int = 25

    # Tag claiming
    claim_expiry_minutes: int = 30
    heartbeat_interval_seconds: int = 120

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, value: str) -> str:
        return value.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    def ensure_storage_dirs(self) -> None:
        for path in (self.storage_dir, self.upload_dir, self.export_dir):
            Path(path).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
