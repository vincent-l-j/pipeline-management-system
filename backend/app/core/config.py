"""Application configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://rozetta:change_me_to_a_strong_password@db:5432/rozetta_pms"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Azure AD / Microsoft OAuth
    AZURE_CLIENT_ID: str = "placeholder-client-id"
    AZURE_CLIENT_SECRET: str = "placeholder-client-secret"
    AZURE_TENANT_ID: str = "placeholder-tenant-id"
    AZURE_AUTHORITY: str = ""
    AZURE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    @property
    def azure_authority_url(self) -> str:
        if self.AZURE_AUTHORITY:
            return self.AZURE_AUTHORITY
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"


settings = Settings()
