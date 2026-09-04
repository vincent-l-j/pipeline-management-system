"""Application configuration — loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://rozetta:change_me_to_a_strong_password@db:5432/rozetta_pms"

    # Security. No default: a missing SECRET_KEY must crash the app at boot rather
    # than fall back to a known value that would let anyone forge valid JWTs.
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Azure AD / Microsoft OAuth. CLIENT_ID/TENANT_ID are public identifiers, but
    # the CLIENT_SECRET is a real credential — required, no default, same reasoning
    # as SECRET_KEY.
    AZURE_CLIENT_ID: str = "placeholder-client-id"
    AZURE_CLIENT_SECRET: str
    AZURE_TENANT_ID: str = "placeholder-tenant-id"
    AZURE_AUTHORITY: str = ""
    AZURE_REDIRECT_URI: str = "http://localhost:8000/api/auth/callback"

    # DigitalOcean Spaces, the object store pitch attachments live in. Region and
    # bucket are public identifiers; the key pair is a real credential and both
    # halves are set as secrets. Named SPACES_* rather than AWS_*, which is what an
    # S3 client would silently pick up from the environment on its own.
    # Empty means attachments are not configured — one feature degrades, and the
    # app still boots, which is why these have defaults and SECRET_KEY does not.
    SPACES_REGION: str = ""
    SPACES_BUCKET: str = ""
    # An override for a compatible store; otherwise derived from the region.
    SPACES_ENDPOINT: str = ""
    # Everything lands under this, and each pitch gets a subfolder named by its id,
    # so retitling a pitch never moves or orphans its files.
    SPACES_ROOT_PREFIX: str = "pitches"
    SPACES_ACCESS_KEY_ID: str = ""
    SPACES_SECRET_ACCESS_KEY: str = ""

    # Where to send the user after a successful login (the frontend origin)
    FRONTEND_URL: str = "http://localhost:5173"

    # Dev-only test login. MUST stay False in production.
    ENABLE_DEV_LOGIN: bool = False

    # Comma-separated emails granted ADMIN automatically on first sign-in.
    ADMIN_EMAILS: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    # Observability
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"
    # Hand-bumped per environment: App Platform exposes no bindable commit hash.
    APP_VERSION: str = "dev"

    class Config:
        env_file = ".env"

    @property
    def azure_authority_url(self) -> str:
        if self.AZURE_AUTHORITY:
            return self.AZURE_AUTHORITY
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}"

    @property
    def spaces_endpoint_url(self) -> str:
        if self.SPACES_ENDPOINT:
            return self.SPACES_ENDPOINT
        return f"https://{self.SPACES_REGION}.digitaloceanspaces.com"


settings = Settings()
