from dataclasses import dataclass

import numpy as np


@dataclass
class Detection:
    bbox: tuple[int, int, int, int]
    score: float
    keypoints: np.ndarray | None
    embedding: np.ndarray | None = None


class FaceDetector:
    """Detects faces. The concrete ONNX detector lives in the recognition engine."""

    def detect(self, image: np.ndarray) -> list[Detection]:
        raise NotImplementedError
