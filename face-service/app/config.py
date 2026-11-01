from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Secrets come from the environment, never from source."""

    api_key: str = ""
    model_dir: str = "models"
    model_pack: str = "buffalo_l"
    detector_file: str = "det_10g.onnx"
    recognition_file: str = "w600k_r50.onnx"
    liveness_file: str = "liveness.onnx"
    recognition_model_name: str = "w600k_r50"
    embedding_version: str = "buffalo_l-arcface-r50"
    onnx_providers: str = "CPUExecutionProvider"
    det_thresh: float = 0.5
    det_size: int = 640
    max_image_bytes: int = 2_000_000
    max_image_side: int = 1280
    max_body_bytes: int = 8_000_000
    default_match_threshold: float = 0.40
    default_quality_threshold: float = 0.55
    liveness_threshold: float = 0.80
    min_frame_delta: float = 0.6
    max_frame_delta: float = 40.0
    min_blur_variance: float = 18.0
    min_brightness: float = 50.0
    max_brightness: float = 230.0
    min_face_ratio: float = 0.14
    max_face_ratio: float = 0.82
    max_center_offset: float = 0.30
    max_roll_degrees: float = 22.0
    max_yaw_ratio: float = 0.28

    model_config = SettingsConfigDict(
        env_prefix="FACE_",
        env_file=".env",
        extra="ignore",
        protected_namespaces=(),
    )

    def provider_list(self) -> list[str]:
        providers = [item.strip() for item in self.onnx_providers.split(",") if item.strip()]
        return providers or ["CPUExecutionProvider"]
