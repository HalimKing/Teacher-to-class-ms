import os

os.environ.setdefault("FACE_API_KEY", "test-key")
os.environ.setdefault("FACE_MODEL_DIR", "models-not-present")

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.face_detector import Detection
from app.services.face_liveness import LivenessAssessment, LivenessChecker
from app.services.face_recognition import l2_normalize
from app.services.pipeline import FacePipeline
from app.state import set_runtime, settings


class FakeEngine:
    dimension = 32

    def ready(self) -> bool:
        return True

    def model_name(self) -> str:
        return "ArcFace"

    def analyze(self, image: np.ndarray) -> list[Detection]:
        marker = tuple(int(value) for value in image[0, 0])
        if marker == (9, 9, 9):
            return [self._face(image), self._face(image)]

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blank = float(gray.std()) < 2 and float(cv2.Laplacian(gray, cv2.CV_64F).var()) < 1
        if marker != (8, 8, 8) and blank:
            return []

        return [self._face(image)]

    def _face(self, image: np.ndarray) -> Detection:
        height, width = image.shape[:2]
        box_width = width // 3
        box_height = height // 3
        x1 = width // 3
        y1 = height // 3
        crop = image[y1 : y1 + box_height, x1 : x1 + box_width]
        mean = crop.reshape(-1, 3).mean(axis=0)
        raw = np.zeros(32, dtype=np.float32)
        raw[0] = mean[0] / 255.0
        raw[1] = mean[1] / 255.0
        raw[2] = mean[2] / 255.0
        raw[3] = 0.2
        raw[4] = (mean[0] / 255.0) ** 2
        raw[5] = (mean[1] / 255.0) ** 2
        raw[6] = (mean[2] / 255.0) ** 2
        return Detection(
            bbox=(x1, y1, x1 + box_width, y1 + box_height),
            score=0.99,
            keypoints=np.array(
                [
                    [x1 + box_width * 0.35, y1 + box_height * 0.40],
                    [x1 + box_width * 0.65, y1 + box_height * 0.40],
                    [x1 + box_width * 0.50, y1 + box_height * 0.55],
                    [x1 + box_width * 0.40, y1 + box_height * 0.72],
                    [x1 + box_width * 0.60, y1 + box_height * 0.72],
                ],
                dtype=np.float32,
            ),
            embedding=l2_normalize(raw),
        )


class FakeLiveness:
    """Test stand-in for the anti-spoof model.

    Marker pixels simulate attacks. They are not real print or screen images.
    """

    model_loaded = True

    def assess(self, frames: list[np.ndarray], image: np.ndarray | None, landmarks: np.ndarray | None = None) -> LivenessAssessment:
        if image is None:
            return LivenessAssessment(False, 0.0, "model_unavailable")

        marker = tuple(int(value) for value in image[0, 0])
        if marker == (7, 7, 7):
            return LivenessAssessment(False, 0.04, "presentation_print")
        if marker == (6, 6, 6):
            return LivenessAssessment(False, 0.06, "presentation_screen")

        if len(frames) < 2:
            return LivenessAssessment(False, 0.0, "insufficient_frames")

        delta = float(np.mean(np.abs(frames[0].astype(np.int16) - frames[1].astype(np.int16))))
        if delta < 0.6:
            return LivenessAssessment(False, delta / 10.0, "static_image")

        return LivenessAssessment(True, 0.92, "ok")


@pytest.fixture(scope="session")
def client():
    settings.api_key = "test-key"
    engine = FakeEngine()
    set_runtime(engine, FacePipeline(settings, engine, FakeLiveness()))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_header():
    return {"X-Api-Key": "test-key"}
