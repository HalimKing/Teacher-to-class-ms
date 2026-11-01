import base64

import numpy as np
import pytest

from app.config import Settings
from app.services.face_recognition import ArcFaceEngine, cosine_similarity, l2_normalize
from tests.helpers import encode_image, portrait


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["model"] == "ArcFace"
    assert body["runtime"] == "onnxruntime"


def test_missing_model_files_are_not_loaded():
    engine = ArcFaceEngine(Settings(model_dir="models-not-present", api_key="test-key"))

    assert engine.ready() is False


def test_unauthorized_request_is_rejected(client):
    response = client.post("/v1/face/detect", json={"image": "a" * 32})

    assert response.status_code == 401
    assert "embedding" not in response.text


def test_no_face(client, auth_header):
    image = np.full((240, 320, 3), 128, dtype=np.uint8)
    response = client.post("/v1/face/detect", json={"image": encode_image(image)}, headers=auth_header)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["status"] == "NO_FACE"
    assert body["face_count"] == 0
    assert body["embedding"] is None


def test_multiple_faces_are_rejected(client, auth_header):
    image = portrait((80, 140, 180), seed=3)
    image[0, 0] = (9, 9, 9)
    response = client.post("/v1/face/detect", json={"image": encode_image(image)}, headers=auth_header)

    body = response.json()
    assert body["status"] == "MULTIPLE_FACES"
    assert body["face_count"] == 2
    assert body["embedding"] is None


def test_dark_face_is_rejected(client, auth_header):
    image = portrait((8, 8, 8), seed=4)
    response = client.post("/v1/face/detect", json={"image": encode_image(image)}, headers=auth_header)

    assert response.json()["status"] == "FACE_TOO_DARK"


def test_blurry_face_is_rejected(client, auth_header):
    image = np.full((240, 320, 3), (90, 140, 170), dtype=np.uint8)
    image[0, 0] = (8, 8, 8)
    response = client.post("/v1/face/detect", json={"image": encode_image(image)}, headers=auth_header)

    assert response.json()["status"] == "FACE_TOO_BLURRY"


def test_malformed_image(client, auth_header):
    response = client.post("/v1/face/detect", json={"image": "aaaa" * 8}, headers=auth_header)

    assert response.json()["status"] == "MALFORMED_IMAGE"


def test_oversized_image_is_rejected(client, auth_header):
    raw = b"\xff\xd8\xff" + (b"a" * 2_100_000)
    encoded = base64.b64encode(raw).decode("ascii")
    response = client.post("/v1/face/detect", json={"image": encoded}, headers=auth_header)

    assert response.status_code == 200
    assert response.json()["status"] == "IMAGE_TOO_LARGE"


def test_liveness_rejects_identical_frames(client, auth_header):
    encoded = encode_image(portrait((70, 130, 180), seed=7))
    response = client.post("/v1/face/liveness", json={"frames": [encoded, encoded]}, headers=auth_header)

    body = response.json()
    assert body["liveness"] is False
    assert body["status"] == "LIVENESS_FAILED"


def test_liveness_accepts_changing_frames(client, auth_header):
    first = encode_image(portrait((70, 130, 180), seed=11))
    second = encode_image(portrait((70, 130, 180), seed=29))
    response = client.post("/v1/face/liveness", json={"frames": [first, second]}, headers=auth_header)

    assert response.json()["liveness"] is True
    assert response.json()["status"] == "READY"


def test_embedding_and_matching(client, auth_header):
    first = encode_image(portrait((60, 140, 190), seed=2))
    second = encode_image(portrait((60, 140, 190), seed=5))
    enrolled = client.post("/v1/face/enroll", json={"images": [first, second]}, headers=auth_header)
    body = enrolled.json()
    assert body["success"] is True, body
    assert body["embedding"]
    assert body["embedding_model"] == "w600k_r50"

    probe = encode_image(portrait((60, 140, 190), seed=8))
    frames = [encode_image(portrait((60, 140, 190), seed=13)), encode_image(portrait((60, 140, 190), seed=21))]
    matched = client.post(
        "/v1/face/verify",
        json={
            "image": probe,
            "liveness_frames": frames,
            "stored_embedding": body["embedding"],
            "threshold": 0.4,
        },
        headers=auth_header,
    )
    matched_body = matched.json()
    assert matched_body["verified"] is True, matched_body
    assert matched_body["embedding"] is None
    assert matched_body["match_score"] >= 0.4

    impostor = encode_image(portrait((220, 30, 10), seed=4))
    rejected = client.post(
        "/v1/face/verify",
        json={
            "image": impostor,
            "liveness_frames": frames,
            "stored_embedding": body["embedding"],
            "threshold": 0.4,
        },
        headers=auth_header,
    )
    rejected_body = rejected.json()
    assert rejected_body["verified"] is False
    assert rejected_body["match_score"] < 0.4


def test_threshold_rejects_a_weaker_score(client, auth_header):
    enrolled = client.post(
        "/v1/face/enroll",
        json={"images": [encode_image(portrait((60, 140, 190), seed=2)), encode_image(portrait((60, 140, 190), seed=5))]},
        headers=auth_header,
    ).json()
    frames = [encode_image(portrait((90, 150, 170), seed=13)), encode_image(portrait((90, 150, 170), seed=21))]
    response = client.post(
        "/v1/face/verify",
        json={
            "image": encode_image(portrait((90, 150, 170), seed=8)),
            "liveness_frames": frames,
            "stored_embedding": enrolled["embedding"],
            "threshold": 0.99,
        },
        headers=auth_header,
    )
    body = response.json()
    assert body["verified"] is False
    assert body["threshold"] == 0.99
    assert body["match_score"] < 0.99


def test_cosine_similarity_is_one_for_the_same_vector():
    vector = l2_normalize(np.array([0.2, -0.4, 0.1, 0.8], dtype=np.float32))

    assert cosine_similarity(vector, vector) == pytest.approx(1.0)


def test_printed_photo_and_screen_are_rejected(client, auth_header):
    enrolled = client.post(
        "/v1/face/enroll",
        json={"images": [encode_image(portrait((60, 140, 190), seed=2)), encode_image(portrait((60, 140, 190), seed=5))]},
        headers=auth_header,
    ).json()
    frames = [encode_image(portrait((60, 140, 190), seed=13)), encode_image(portrait((60, 140, 190), seed=21))]

    for marker in ((7, 7, 7), (6, 6, 6)):
        attack = portrait((60, 140, 190), seed=8)
        attack[0, 0] = marker
        response = client.post(
            "/v1/face/verify",
            json={
                "image": encode_image(attack),
                "liveness_frames": frames,
                "stored_embedding": enrolled["embedding"],
                "threshold": 0.4,
            },
            headers=auth_header,
        )
        body = response.json()
        assert body["verified"] is False
        assert body["liveness"] is False
        assert body["status"] == "PRESENTATION_ATTACK"
        assert body["match_score"] is not None


def test_required_liveness_fails_closed_without_the_model():
    from app.services.face_liveness import LivenessChecker
    from app.services.pipeline import FacePipeline
    from tests.conftest import FakeEngine

    settings = Settings(model_dir="models-not-present", api_key="test-key", liveness_threshold=0.8)
    pipeline = FacePipeline(settings, FakeEngine(), LivenessChecker(settings))
    frames = [encode_image(portrait((60, 140, 190), seed=13)), encode_image(portrait((60, 140, 190), seed=21))]
    enrolled_embedding = [0.1] * 32
    result = pipeline.verify(
        encode_image(portrait((60, 140, 190), seed=2)),
        frames,
        enrolled_embedding,
        0.4,
        0.55,
        True,
    )

    assert result.status == "LIVENESS_UNAVAILABLE"
    assert result.verified is False
    assert result.liveness is False
