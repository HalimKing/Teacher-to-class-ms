from app.config import Settings
from app.services.face_liveness import LivenessChecker
from app.services.face_recognition import ArcFaceEngine
from app.services.pipeline import FacePipeline

settings = Settings()
engine: ArcFaceEngine | None = None
pipeline: FacePipeline | None = None


def init_runtime() -> FacePipeline:
    global engine, pipeline
    if pipeline is not None and engine is not None:
        return pipeline

    engine = ArcFaceEngine(settings)
    pipeline = FacePipeline(settings, engine, LivenessChecker(settings))
    return pipeline


def get_pipeline() -> FacePipeline:
    if pipeline is None:
        return init_runtime()
    return pipeline


def get_settings() -> Settings:
    return settings


def set_runtime(custom_engine: ArcFaceEngine, custom_pipeline: FacePipeline) -> None:
    global engine, pipeline
    engine = custom_engine
    pipeline = custom_pipeline
