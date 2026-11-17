# Face API Models

The attendance camera loads these files from `/models/face-api` once per browser session.

- `tiny_face_detector_model-*` — live face finding only. It is not used to build the stored descriptor.
- `ssd_mobilenetv1_model-*` — used when a suitable face is captured, together with the landmark and recognition nets.
- `face_landmark_68_model-*`
- `face_recognition_model-*`

The recognition descriptor stays a 128-number vector from the same landmark and recognition networks used for enrollment. Detection speed settings live in `resources/js/lib/face-recognition.ts` (`FACE_PIPELINE`).
