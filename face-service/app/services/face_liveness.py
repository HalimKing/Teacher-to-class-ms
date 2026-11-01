"""Anti-spoof liveness.

The decision comes from the InsightFace liveness ONNX model, which scores
whether the aligned face looks like a live person rather than a print or screen.
Frame differences only reject an obvious frozen image. They are not a substitute
for the model. This does not detect every replay or high-quality spoof.
"""

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import Settings

logger = logging.getLogger("face-service")


@dataclass
class LivenessAssessment:
    passed: bool
    score: float
    reason: str


class LivenessChecker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.adapter = None
        self._load_model()

    @property
    def model_loaded(self) -> bool:
        return self.adapter is not None

    def _load_model(self) -> None:
        from pathlib import Path

        path = Path(self.settings.model_dir) / self.settings.liveness_file
        if not path.is_file():
            logger.info("FACE_LIVENESS_MODEL_MISSING path=%s", path)
            return

        try:
            from app.services.face_recognition import _allow_insightface_import

            _allow_insightface_import()
            from insightface.addons.liveness import Liveness

            self.adapter = Liveness(
                str(path),
                threshold=self.settings.liveness_threshold,
                providers=self.settings.provider_list(),
            )
            logger.info("FACE_LIVENESS_MODEL_LOADED")
        except Exception:
            logger.exception("FACE_SERVICE_ERROR liveness model could not be loaded")
            self.adapter = None

    def assess(
        self,
        frames: list[np.ndarray],
        image: np.ndarray | None,
        landmarks: np.ndarray | None = None,
    ) -> LivenessAssessment:
        if self.adapter is None:
            return LivenessAssessment(False, 0.0, "model_unavailable")

        temporal = self._temporal(frames)
        if not temporal.passed:
            return temporal

        if image is None or landmarks is None:
            return LivenessAssessment(False, 0.0, "model_unavailable")

        try:
            result = self.adapter.predict(image, landmarks)
        except Exception:
            logger.exception("FACE_SERVICE_ERROR liveness inference failed")
            return LivenessAssessment(False, 0.0, "model_unavailable")

        if result.get("status") != "ok" or result.get("is_live") is None:
            return LivenessAssessment(False, float(result.get("live_score") or 0.0), "input_rejected")

        score = float(result["live_score"])
        if result["is_live"] is True:
            return LivenessAssessment(True, score, "ok")

        return LivenessAssessment(False, score, "model_rejected")

    def _temporal(self, frames: list[np.ndarray]) -> LivenessAssessment:
        if len(frames) < 2:
            return LivenessAssessment(False, 0.0, "insufficient_frames")

        deltas: list[float] = []
        for left, right in zip(frames, frames[1:]):
            left_small = cv2.resize(left, (160, 120))
            right_small = cv2.resize(right, (160, 120))
            deltas.append(float(np.mean(cv2.absdiff(left_small, right_small))))

        mean_delta = float(np.mean(deltas))
        if mean_delta < self.settings.min_frame_delta:
            return LivenessAssessment(False, mean_delta / 10.0, "static_image")
        if mean_delta > self.settings.max_frame_delta:
            return LivenessAssessment(False, 0.2, "unstable_motion")

        score = max(0.0, min(1.0, mean_delta / 12.0))
        return LivenessAssessment(True, score, "ok")
