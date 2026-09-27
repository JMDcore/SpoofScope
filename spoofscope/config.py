from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SPOOFSCOPE_", extra="ignore")
    database_url: str = "sqlite:///./spoofscope.db"
    redis_url: str = "redis://redis:6379/0"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    scan_timeout_seconds: float = Field(8.0, ge=1, le=60)
    user_agent: str = "SpoofScope/0.1 defensive-monitor (+https://github.com/)"
    demo_mode: bool = False
    scan_interval_minutes: int = Field(360, ge=5, le=10_080)
    max_candidates: int = Field(120, ge=1, le=1_000)
    max_ct_hosts: int = Field(200, ge=1, le=1_000)
    ct_enabled: bool = True
    screenshots_enabled: bool = True
    screenshot_dir: str = "./data/screenshots"
    screenshot_threshold: int = Field(35, ge=0, le=100)
    max_screenshots_per_scan: int = Field(8, ge=0, le=50)
    disappearance_grace_scans: int = Field(2, ge=1, le=20)
    retention_days: int = Field(180, ge=1, le=3_650)
    request_rate_per_second: float = Field(4.0, ge=0.1, le=50)
    api_key: str = ""
    log_level: str = "INFO"

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value: str) -> str:
        if value and len(value) < 16:
            raise ValueError("SPOOFSCOPE_API_KEY must contain at least 16 characters")
        return value


settings = Settings()
