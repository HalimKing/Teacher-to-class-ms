import base64

import cv2
import numpy as np


def encode_image(image: np.ndarray) -> str:
    ok, buffer = cv2.imencode(".png", image)
    assert ok
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def portrait(color: tuple[int, int, int], seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    image = np.zeros((240, 320, 3), dtype=np.uint8)
    image[:, :] = color
    noise = rng.integers(0, 25, size=image.shape, dtype=np.uint8)
    return cv2.add(image, noise)
