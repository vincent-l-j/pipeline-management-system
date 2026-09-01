"""Response schemas for the liveness and readiness probes."""

from pydantic import BaseModel


class LivenessOut(BaseModel):
    status: str
    app: str


class ReadinessOut(BaseModel):
    status: str
    database: str
    version: str
