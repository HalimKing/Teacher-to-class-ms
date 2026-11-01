"""ArcFace embedding and cosine comparison.

The recognizer loads local ONNX weights only. It does not download model packs.
InsightFace library code is MIT. Official buffalo_l weights are research-licensed
and must be supplied by the operator in FACE_MODEL_DIR.
"""

import logging
import sys
import types
from pathlib import Path

import cv2
import numpy as np

from app.config import Settings
from app.services.face_detector import Detection

logger = logging.getLogger("face-service")


class _CvSimilarityTransform:
    """Five-point face alignment without scikit-image.

    Windows Application Control can block SciPy, which InsightFace imports
    through scikit-image. OpenCV estimates the same similarity transform.
    """

    def __init__(self) -> None:
        self.params = np.eye(3, dtype=np.float64)

    def estimate(self, src: np.ndarray, dst: np.ndarray) -> bool:
        matrix, _ = cv2.estimateAffinePartial2D(
            np.asarray(src, dtype=np.float32),
            np.asarray(dst, dtype=np.float32),
            method=cv2.LMEDS,
        )
        if matrix is None:
            return False
        self.params = np.eye(3, dtype=np.float64)
        self.params[:2, :] = matrix
        return True


def _allow_insightface_import() -> None:
    try:
        from skimage.transform import SimilarityTransform  # noqa: F401
    except Exception:
        for name in list(sys.modules):
            if name == "skimage" or name.startswith("skimage."):
                del sys.modules[name]
        transform = types.ModuleType("skimage.transform")
        transform.SimilarityTransform = _CvSimilarityTransform
        skimage = types.ModuleType("skimage")
        skimage.transform = transform
        sys.modules["skimage"] = skimage
        sys.modules["skimage.transform"] = transform


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    array = np.asarray(vector, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(array))
    if norm < 1e-8:
        raise ValueError("Embedding norm is zero.")
    return array / norm


def aggregate_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
    stacked = np.stack([l2_normalize(item) for item in embeddings], axis=0)
    return l2_normalize(stacked.mean(axis=0))


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    if left.shape != right.shape:
        raise ValueError("Embedding dimensions do not match.")
    return float(np.dot(l2_normalize(left), l2_normalize(right)))


class ArcFaceEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.detector = None
        self.recognizer = None
        self.loaded = False
        self.dimension: int | None = None
        self.load_error: str | None = None
        self._load()

    def ready(self) -> bool:
        return self.loaded

    def model_name(self) -> str:
        return self.settings.recognition_model_name

    def analyze(self, image: np.ndarray) -> list[Detection]:
        if not self.loaded or self.detector is None or self.recognizer is None:
            raise RuntimeError("MODEL_NOT_LOADED")

        bboxes, keypoints = self.detector.detect(
            image,
            input_size=(self.settings.det_size, self.settings.det_size),
            max_num=5,
            metric="default",
        )
        detections: list[Detection] = []
        if bboxes is None:
            return detections

        for index, bbox in enumerate(bboxes):
            score = float(bbox[4]) if len(bbox) > 4 else 0.0
            if score < self.settings.det_thresh:
                continue
            points = None
            if keypoints is not None and index < len(keypoints):
                points = np.asarray(keypoints[index], dtype=np.float32)
            box = (int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3]))
            embedding = None
            if points is not None:
                embedding = self._embed(image, box, points, score)
            detections.append(Detection(bbox=box, score=score, keypoints=points, embedding=embedding))

        return detections

    def _embed(self, image: np.ndarray, box: tuple[int, int, int, int], keypoints: np.ndarray, score: float) -> np.ndarray:
        from insightface.app.common import Face

        face = Face(bbox=np.array(box, dtype=np.float32), kps=keypoints, det_score=score)
        feature = np.asarray(self.recognizer.get(image, face), dtype=np.float32).reshape(-1)
        normalized = l2_normalize(feature)
        self.dimension = int(normalized.shape[0])
        return normalized

    def _load(self) -> None:
        root = Path(self.settings.model_dir)
        detector_path = root / self.settings.detector_file
        recognition_path = root / self.settings.recognition_file
        if not detector_path.is_file() or not recognition_path.is_file():
            self.load_error = "model files are not installed"
            logger.info("FACE_SERVICE_ERROR model files missing from %s", root)
            return

        try:
            _allow_insightface_import()
            from insightface.model_zoo import get_model

            providers = self.settings.provider_list()
            detector = get_model(str(detector_path), providers=providers)
            recognizer = get_model(str(recognition_path), providers=providers)
            detector.prepare(ctx_id=-1, input_size=(self.settings.det_size, self.settings.det_size), det_thresh=self.settings.det_thresh)
            recognizer.prepare(ctx_id=-1)
            self.detector = detector
            self.recognizer = recognizer
            output_shape = getattr(recognizer, "output_shape", None)
            if output_shape and isinstance(output_shape[-1], int):
                self.dimension = int(output_shape[-1])
            self.loaded = True
            logger.info(
                "FACE_MODEL_LOADED model=%s runtime=onnxruntime providers=%s",
                self.settings.recognition_model_name,
                ",".join(providers),
            )
        except Exception:
            self.loaded = False
            self.load_error = "model failed to load"
            logger.exception("FACE_SERVICE_ERROR model load failed")
