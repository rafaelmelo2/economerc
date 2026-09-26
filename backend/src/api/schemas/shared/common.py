from pydantic import BaseModel


class DependencyStatus(BaseModel):
    database: str
    valkey: str
    nats: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    dependencies: DependencyStatus
