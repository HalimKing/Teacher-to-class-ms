from typing import Literal

from pydantic import BaseModel, Field

FaceStatus = Literal[
    "NO_FACE",
    "MULTIPLE_FACES",
    "FACE_TOO_SMALL",
    "FACE_TOO_DARK",
    "FACE_TOO_BLURRY",
    "FACE_POOR_POSITION",
    "LIVENESS_FAILED",
    "LIVENESS_UNAVAILABLE",
    "PRESENTATION_ATTACK",
    "INCONSISTENT_SAMPLES",
    "READY",
    "SERVICE_UNAVAILABLE",
    "MALFORMED_IMAGE",
    "IMAGE_TOO_LARGE",
]


class ImageRequest(BaseModel):
    image: str = Field(min_length=16, max_length=3_000_000)


class FramesRequest(BaseModel):
    frames: list[str] = Field(min_length=2, max_length=3)


class EnrollRequest(BaseModel):
    images: list[str] = Field(min_length=2, max_length=3)
    liveness_required: bool = True


class VerifyRequest(BaseModel):
    image: str = Field(min_length=16, max_length=3_000_000)
    liveness_frames: list[str] = Field(min_length=2, max_length=3)
    stored_embedding: list[float] = Field(min_length=32, max_length=1024)
    threshold: float = Field(default=0.40, ge=0.2, le=0.99)
    quality_threshold: float = Field(default=0.55, ge=0.2, le=0.95)
    liveness_required: bool = True


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model: str
    runtime: str
    embedding_dimension: int | None = None
    liveness_model_loaded: bool = False


class FaceResponse(BaseModel):
    success: bool
    status: FaceStatus | str
    face_detected: bool = False
    face_count: int = 0
    quality_score: float | None = None
    liveness: bool | None = None
    liveness_score: float | None = None
    verified: bool | None = None
    match_score: float | None = None
    threshold: float | None = None
    embedding: list[float] | None = None
    embedding_dimension: int | None = None
    embedding_model: str | None = None
    embedding_version: str | None = None
    processing_time_ms: int = 0
    timings_ms: dict[str, int] = Field(default_factory=dict)
    message: str | None = None
