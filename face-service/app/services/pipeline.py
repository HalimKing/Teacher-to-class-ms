import logging
import time
from dataclasses import dataclass, field

import numpy as np

from app.config import Settings
from app.services.face_liveness import LivenessAssessment, LivenessChecker
from app.services.face_quality import assess_face
from app.services.face_recognition import ArcFaceEngine, aggregate_embeddings, cosine_similarity
from app.utils.image import ImageDecodeError, decode_image

logger = logging.getLogger("face-service")


@dataclass
class PipelineResult:
    success: bool
    status: str
    face_count: int = 0
    quality_score: float | None = None
    liveness: bool | None = None
    liveness_score: float | None = None
    embedding: list[float] | None = None
    match_score: float | None = None
    verified: bool | None = None
    threshold: float | None = None
    processing_time_ms: int = 0
    timings_ms: dict[str, int] = field(default_factory=dict)


class FacePipeline:
    def __init__(self, settings: Settings, engine: ArcFaceEngine, liveness: LivenessChecker) -> None:
        self.settings = settings
        self.engine = engine
        self.checker = liveness

    def detect(self, image_payload: str) -> PipelineResult:
        started = time.perf_counter()
        timings: dict[str, int] = {}
        try:
            image, decode_ms = self._decode(image_payload)
        except ImageDecodeError as error:
            return self._finish(PipelineResult(success=False, status=error.code), started, timings)

        timings["decode"] = decode_ms
        if not self.engine.ready():
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE"), started, timings)

        detection_started = time.perf_counter()
        try:
            faces = self.engine.analyze(image)
        except Exception:
            logger.exception("FACE_SERVICE_ERROR detection failed")
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE"), started, timings)
        timings["detection"] = _elapsed(detection_started)

        result = self._single_face_result(image, faces, timings)
        if result.status == "READY":
            logger.info("FACE_DETECTED face_count=1 quality=%.3f", result.quality_score or 0)
        return self._finish(result, started, timings)

    def liveness(self, frames_payload: list[str]) -> PipelineResult:
        started = time.perf_counter()
        timings: dict[str, int] = {}
        frames, error = self._decode_many(frames_payload, timings)
        if error is not None:
            return self._finish(PipelineResult(success=False, status=error), started, timings)

        landmarks = None
        if self.engine.ready():
            try:
                faces = self.engine.analyze(frames[0])
            except Exception:
                logger.exception("FACE_SERVICE_ERROR liveness detection failed")
                return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE"), started, timings)
            if len(faces) != 1:
                return self._finish(
                    PipelineResult(success=False, status="NO_FACE" if len(faces) == 0 else "MULTIPLE_FACES", face_count=len(faces)),
                    started,
                    timings,
                )
            landmarks = faces[0].keypoints
            if landmarks is None:
                return self._finish(PipelineResult(success=False, status="FACE_POOR_POSITION", face_count=1), started, timings)

        live = self._live_check(frames, frames[0], timings, landmarks)
        return self._finish(
            PipelineResult(
                success=live.passed,
                status="READY" if live.passed else _liveness_status(live.reason),
                liveness=live.passed,
                liveness_score=round(live.score, 4),
            ),
            started,
            timings,
        )

    def enroll(self, images_payload: list[str], require_liveness: bool = True) -> PipelineResult:
        started = time.perf_counter()
        timings: dict[str, int] = {}
        frames, error = self._decode_many(images_payload, timings)
        if error is not None:
            return self._finish(PipelineResult(success=False, status=error), started, timings)
        if not self.engine.ready():
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE"), started, timings)

        embeddings = []
        qualities = []
        primary = None
        landmarks = None
        for frame in frames:
            detection_started = time.perf_counter()
            try:
                faces = self.engine.analyze(frame)
            except Exception:
                logger.exception("FACE_SERVICE_ERROR enrollment detection failed")
                return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE"), started, timings)
            timings["detection"] = timings.get("detection", 0) + _elapsed(detection_started)
            if landmarks is None and faces:
                landmarks = faces[0].keypoints
            outcome = self._single_face_result(frame, faces, timings, keep_embedding=True)
            if outcome.status != "READY" or outcome.embedding is None:
                outcome.success = False
                return self._finish(outcome, started, timings)
            embeddings.append(np.asarray(outcome.embedding, dtype=np.float32))
            qualities.append(outcome.quality_score or 0)
            primary = outcome

        if len(embeddings) >= 2:
            similarity = cosine_similarity(embeddings[0], embeddings[1])
            for other in embeddings[2:]:
                similarity = min(similarity, cosine_similarity(embeddings[0], other))
            if similarity < 0.45:
                return self._finish(PipelineResult(success=False, status="INCONSISTENT_SAMPLES", face_count=1), started, timings)

        live = self._live_check(frames, frames[0], timings, landmarks) if require_liveness else None
        if require_liveness and (live is None or not live.passed):
            reason = live.reason if live is not None else "model_unavailable"
            logger.info("FACE_LIVENESS_FAILED reason=%s", reason)
            return self._finish(
                PipelineResult(
                    success=False,
                    status=_liveness_status(reason),
                    face_count=1,
                    liveness=False,
                    liveness_score=round(live.score, 4) if live is not None else 0.0,
                ),
                started,
                timings,
            )

        combined = aggregate_embeddings(embeddings)
        logger.info("FACE_ENROLLMENT_SUCCESS samples=%d", len(embeddings))
        assert primary is not None
        return self._finish(
            PipelineResult(
                success=True,
                status="READY",
                face_count=1,
                quality_score=round(min(qualities), 4),
                liveness=True if require_liveness else None,
                liveness_score=round(live.score, 4) if live is not None else None,
                embedding=[float(value) for value in combined.tolist()],
            ),
            started,
            timings,
        )

    def verify(
        self,
        image_payload: str,
        frame_payloads: list[str],
        stored_embedding: list[float],
        threshold: float,
        quality_threshold: float,
        require_liveness: bool = True,
    ) -> PipelineResult:
        started = time.perf_counter()
        timings: dict[str, int] = {}
        frames, error = self._decode_many(frame_payloads, timings)
        if error is not None:
            return self._finish(PipelineResult(success=False, status=error, threshold=threshold), started, timings)

        try:
            image, decode_ms = self._decode(image_payload)
        except ImageDecodeError as decode_error:
            return self._finish(PipelineResult(success=False, status=decode_error.code, threshold=threshold), started, timings)
        timings["decode"] = timings.get("decode", 0) + decode_ms

        if not self.engine.ready():
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE", threshold=threshold), started, timings)

        detection_started = time.perf_counter()
        try:
            faces = self.engine.analyze(image)
        except Exception:
            logger.exception("FACE_SERVICE_ERROR verification detection failed")
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE", threshold=threshold), started, timings)
        timings["detection"] = _elapsed(detection_started)

        outcome = self._single_face_result(image, faces, timings, keep_embedding=True, quality_threshold=quality_threshold)
        outcome.threshold = threshold
        landmarks = faces[0].keypoints if len(faces) == 1 else None
        if outcome.status != "READY" or outcome.embedding is None:
            logger.info("FACE_VERIFICATION_FAILED status=%s", outcome.status)
            outcome.success = False
            outcome.verified = False
            outcome.embedding = None
            return self._finish(outcome, started, timings)

        if require_liveness:
            live = self._live_check(frames, image, timings, landmarks)
            outcome.liveness = live.passed
            outcome.liveness_score = round(live.score, 4)
        else:
            live = None
            outcome.liveness = None
            outcome.liveness_score = None

        compare_started = time.perf_counter()
        try:
            stored = np.asarray(stored_embedding, dtype=np.float32)
            score = cosine_similarity(np.asarray(outcome.embedding, dtype=np.float32), stored)
        except ValueError:
            logger.info("FACE_VERIFICATION_FAILED status=EMBEDDING_MISMATCH")
            return self._finish(PipelineResult(success=False, status="SERVICE_UNAVAILABLE", threshold=threshold), started, timings)
        timings["comparison"] = _elapsed(compare_started)
        outcome.match_score = round(score, 6)
        outcome.embedding = None

        if require_liveness and (live is None or not live.passed):
            reason = live.reason if live is not None else "model_unavailable"
            logger.info("FACE_LIVENESS_FAILED reason=%s match_score=%.3f", reason, score)
            outcome.success = False
            outcome.verified = False
            outcome.status = _liveness_status(reason)
            return self._finish(outcome, started, timings)

        if require_liveness:
            logger.info("FACE_LIVENESS_PASSED")

        verified = score >= threshold
        if verified:
            logger.info("FACE_VERIFICATION_SUCCESS match_score=%.3f quality=%.3f", score, outcome.quality_score or 0)
        else:
            logger.info("FACE_VERIFICATION_FAILED status=NOT_MATCHED match_score=%.3f", score)

        outcome.success = verified
        outcome.verified = verified
        if not verified:
            outcome.status = "NOT_MATCHED"
        return self._finish(outcome, started, timings)

    def _single_face_result(
        self,
        image: np.ndarray,
        faces: list,
        timings: dict[str, int],
        keep_embedding: bool = False,
        quality_threshold: float | None = None,
    ) -> PipelineResult:
        if len(faces) == 0:
            return PipelineResult(success=False, status="NO_FACE", face_count=0)
        if len(faces) > 1:
            logger.info("FACE_DETECTED face_count=%d", len(faces))
            return PipelineResult(success=False, status="MULTIPLE_FACES", face_count=len(faces))

        face = faces[0]
        if face.keypoints is None or face.embedding is None:
            return PipelineResult(success=False, status="FACE_POOR_POSITION", face_count=1, quality_score=0.2)

        quality_started = time.perf_counter()
        settings = self.settings
        if quality_threshold is not None:
            settings = settings.model_copy(update={"default_quality_threshold": quality_threshold})
        quality = assess_face(image, face.bbox, face.keypoints, settings)
        timings["quality"] = timings.get("quality", 0) + _elapsed(quality_started)

        return PipelineResult(
            success=quality.status == "READY",
            status=quality.status,
            face_count=1,
            quality_score=round(quality.quality_score, 4),
            embedding=[float(value) for value in face.embedding.tolist()] if keep_embedding else None,
        )

    def _live_check(
        self,
        frames: list[np.ndarray],
        sample: np.ndarray,
        timings: dict[str, int],
        landmarks: np.ndarray | None,
    ) -> LivenessAssessment:
        started = time.perf_counter()
        result = self.checker.assess(frames, sample, landmarks)
        timings["liveness"] = _elapsed(started)
        return result

    def _decode(self, payload: str) -> tuple[np.ndarray, int]:
        started = time.perf_counter()
        image = decode_image(payload, self.settings)
        return image, _elapsed(started)

    def _decode_many(self, payloads: list[str], timings: dict[str, int]) -> tuple[list[np.ndarray], str | None]:
        frames: list[np.ndarray] = []
        total = 0
        for payload in payloads:
            try:
                image, elapsed = self._decode(payload)
            except ImageDecodeError as error:
                return [], error.code
            frames.append(image)
            total += elapsed
        timings["decode"] = timings.get("decode", 0) + total
        return frames, None

    def _finish(self, result: PipelineResult, started: float, timings: dict[str, int]) -> PipelineResult:
        result.timings_ms = timings
        result.processing_time_ms = _elapsed(started)
        timings["total"] = result.processing_time_ms
        return result


def _liveness_status(reason: str) -> str:
    if reason == "model_unavailable":
        return "LIVENESS_UNAVAILABLE"
    if reason in {"model_rejected", "presentation_print", "presentation_screen"}:
        return "PRESENTATION_ATTACK"
    return "LIVENESS_FAILED"


def _elapsed(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
