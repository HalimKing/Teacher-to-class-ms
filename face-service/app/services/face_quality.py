import math
from dataclasses import dataclass

import cv2
import numpy as np

from app.config import Settings


@dataclass
class QualityAssessment:
    status: str
    quality_score: float
    guidance: str


def assess_face(
    image: np.ndarray,
    bbox: tuple[int, int, int, int],
    keypoints: np.ndarray | None,
    settings: Settings,
) -> QualityAssessment:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = _clip_box(bbox, width, height)
    face_width = x2 - x1
    face_height = y2 - y1

    if face_width < 80 or face_height < 80 or face_width / float(width) < settings.min_face_ratio:
        return QualityAssessment("FACE_TOO_SMALL", 0.2, "Move closer")

    if face_width / float(width) > settings.max_face_ratio or face_height / float(height) > 0.92:
        return QualityAssessment("FACE_POOR_POSITION", 0.35, "Move farther away")

    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return QualityAssessment("NO_FACE", 0.0, "No face detected")

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if brightness < settings.min_brightness:
        return QualityAssessment("FACE_TOO_DARK", 0.25, "Lighting is too low")

    if brightness > settings.max_brightness:
        return QualityAssessment("FACE_POOR_POSITION", 0.3, "Lighting is too strong")

    if blur < settings.min_blur_variance:
        return QualityAssessment("FACE_TOO_BLURRY", 0.3, "Image is blurry")

    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    offset_x = abs(center_x - (width / 2)) / width
    offset_y = abs(center_y - (height / 2)) / height
    if offset_x > settings.max_center_offset or offset_y > settings.max_center_offset:
        return QualityAssessment("FACE_POOR_POSITION", 0.4, "Center your face")

    if keypoints is not None and keypoints.shape[0] >= 3:
        roll = abs(math.degrees(math.atan2(
            float(keypoints[1][1] - keypoints[0][1]),
            float(keypoints[1][0] - keypoints[0][0]),
        )))
        eye_mid_x = float((keypoints[0][0] + keypoints[1][0]) / 2)
        yaw = abs(float(keypoints[2][0]) - eye_mid_x) / max(face_width, 1)
        if roll > settings.max_roll_degrees or yaw > settings.max_yaw_ratio:
            return QualityAssessment("FACE_POOR_POSITION", 0.45, "Look directly at the camera")

    sharpness = min(blur / 120.0, 1.0)
    brightness_score = 1.0 - min(abs(brightness - 140.0) / 140.0, 1.0)
    size_score = min(face_width / float(width) / 0.35, 1.0)
    quality = max(0.0, min(1.0, (0.4 * sharpness) + (0.3 * brightness_score) + (0.3 * size_score)))

    if quality < settings.default_quality_threshold:
        return QualityAssessment("FACE_POOR_POSITION", quality, "Hold still and face the camera")

    return QualityAssessment("READY", quality, "Ready")


def _clip_box(bbox: tuple[int, int, int, int], width: int, height: int) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        max(0, min(width - 1, int(x1))),
        max(0, min(height - 1, int(y1))),
        max(1, min(width, int(x2))),
        max(1, min(height, int(y2))),
    )
