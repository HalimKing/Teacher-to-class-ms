import base64
import binascii

import cv2
import numpy as np

from app.config import Settings


class ImageDecodeError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def decode_image(payload: str, settings: Settings) -> np.ndarray:
    encoded = payload.strip()
    if encoded.startswith("data:"):
        parts = encoded.split(",", 1)
        if len(parts) != 2:
            raise ImageDecodeError("MALFORMED_IMAGE")
        encoded = parts[1]

    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ImageDecodeError("MALFORMED_IMAGE") from error

    if len(raw) > settings.max_image_bytes:
        raise ImageDecodeError("IMAGE_TOO_LARGE")

    buffer = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise ImageDecodeError("MALFORMED_IMAGE")

    height, width = image.shape[:2]
    longest = max(height, width)
    if longest > settings.max_image_side:
        scale = settings.max_image_side / float(longest)
        image = cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))), interpolation=cv2.INTER_AREA)

    return image
