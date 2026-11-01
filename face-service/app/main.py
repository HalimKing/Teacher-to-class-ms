import logging

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.schemas.face import (
    EnrollRequest,
    FaceResponse,
    FramesRequest,
    HealthResponse,
    ImageRequest,
    VerifyRequest,
)
from app.security import require_api_key
from app.services.pipeline import PipelineResult
from app.state import get_pipeline, get_settings, init_runtime

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("face-service")

app = FastAPI(title="Attendance Face Service", version="1.0.0", docs_url=None, redoc_url=None)


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > get_settings().max_body_bytes:
        return JSONResponse(
            status_code=413,
            content={"success": False, "status": "IMAGE_TOO_LARGE", "message": "Image is too large."},
        )
    return await call_next(request)


@app.on_event("startup")
def startup() -> None:
    init_runtime()
    logger.info("FACE_SERVICE_STARTED")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    runtime = get_pipeline()
    loaded = runtime.engine.ready()
    return HealthResponse(
        status="ok" if loaded else "degraded",
        model_loaded=loaded,
        model="ArcFace",
        runtime="onnxruntime",
        embedding_dimension=runtime.engine.dimension,
        liveness_model_loaded=runtime.checker.model_loaded,
    )


@app.post("/v1/face/detect", response_model=FaceResponse, dependencies=[Depends(require_api_key)])
def detect(payload: ImageRequest) -> FaceResponse:
    logger.info("FACE_VERIFICATION_STARTED operation=detect")
    return _response(get_pipeline().detect(payload.image), include_embedding=False)


@app.post("/v1/face/liveness", response_model=FaceResponse, dependencies=[Depends(require_api_key)])
def liveness(payload: FramesRequest) -> FaceResponse:
    return _response(get_pipeline().liveness(payload.frames), include_embedding=False)


@app.post("/v1/face/enroll", response_model=FaceResponse, dependencies=[Depends(require_api_key)])
def enroll(payload: EnrollRequest) -> FaceResponse:
    logger.info("FACE_VERIFICATION_STARTED operation=enroll")
    return _response(get_pipeline().enroll(payload.images, payload.liveness_required), include_embedding=True)


@app.post("/v1/face/verify", response_model=FaceResponse, dependencies=[Depends(require_api_key)])
def verify(payload: VerifyRequest) -> FaceResponse:
    logger.info("FACE_VERIFICATION_STARTED operation=verify")
    return _response(
        get_pipeline().verify(
            payload.image,
            payload.liveness_frames,
            payload.stored_embedding,
            payload.threshold,
            payload.quality_threshold,
            payload.liveness_required,
        ),
        include_embedding=False,
    )


def _response(result: PipelineResult, include_embedding: bool) -> FaceResponse:
    status_code_message = {
        "NO_FACE": "No face detected.",
        "MULTIPLE_FACES": "Multiple faces detected.",
        "FACE_TOO_SMALL": "Face is too small.",
        "FACE_TOO_DARK": "Face is too dark.",
        "FACE_TOO_BLURRY": "Face is too blurry.",
        "FACE_POOR_POSITION": "Face position is not suitable.",
        "LIVENESS_FAILED": "A live face could not be verified.",
        "LIVENESS_UNAVAILABLE": "Face verification is temporarily unavailable.",
        "PRESENTATION_ATTACK": "A possible photograph or screen presentation was detected.",
        "INCONSISTENT_SAMPLES": "Enrollment samples do not match.",
        "SERVICE_UNAVAILABLE": "Face service is unavailable.",
        "MALFORMED_IMAGE": "Image could not be read.",
        "IMAGE_TOO_LARGE": "Image is too large.",
    }
    settings = get_settings()
    embedding = result.embedding if include_embedding else None
    return FaceResponse(
        success=result.success and result.status == "READY",
        status=result.status,
        face_detected=result.face_count == 1,
        face_count=result.face_count,
        quality_score=result.quality_score,
        liveness=result.liveness,
        liveness_score=result.liveness_score,
        verified=result.verified,
        match_score=result.match_score,
        threshold=result.threshold,
        embedding=embedding,
        embedding_dimension=len(embedding) if embedding else None,
        embedding_model=settings.recognition_model_name,
        embedding_version=settings.embedding_version,
        processing_time_ms=result.processing_time_ms,
        timings_ms=result.timings_ms,
        message=None if result.status == "READY" else status_code_message.get(result.status, "Face service request failed."),
    )
