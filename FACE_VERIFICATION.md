# Face verification

Staff attendance can verify a face with either the existing browser `face-api.js` flow or the ArcFace face service. Laravel remains the only component that records attendance.

## What each part does

| Part | Responsibility |
| --- | --- |
| Browser | Opens the camera, shows guidance, and sends captured frames |
| Laravel | Enrollment permission, encrypted storage, match decision, one-time token, attendance |
| Face service | Detection, quality, liveness, embedding, cosine similarity |

The browser cannot mark a face as verified. A captured image is not stored. An embedding is not returned to the browser, written to logs, or placed in a URL.

## Install the face service

See `face-service/README.md`. Laravel reads:

```env
FACE_SERVICE_URL=http://127.0.0.1:8090
FACE_SERVICE_API_KEY=
FACE_SERVICE_TIMEOUT=15
FACE_SERVICE_ENABLED=true
```

Set the same API key in `face-service/.env` as `FACE_API_KEY`. Leave both empty only on a machine with no face service. An empty key makes `/v1` requests fail.

`FACE_RECOGNITION_ENGINE=face_api` or `FACE_RECOGNITION_ENGINE=arcface` overrides the database setting. Leave it unset to use the admin setting.

Apply the new tables and settings:

```bash
php artisan migrate
```

The default engine is `face_api`, so existing attendance continues until an administrator switches it.

## Models

Put locally supplied ONNX files in `face-service/models/`:

- `det_10g.onnx` — face detection
- `w600k_r50.onnx` — ArcFace embedding
- `liveness.onnx` — optional MiniFASNet-style anti-spoof model

The service never downloads weights. Do not commit ONNX files.

CPU is the default execution provider. A later GPU deployment can set `FACE_ONNX_PROVIDERS=CUDAExecutionProvider,CPUExecutionProvider` without changing attendance code.

## Enrollment

1. Choose **ArcFace** under Admin → System Settings.
2. Open the staff profile and enroll from the camera. Two or three samples are required. A file upload is not accepted for ArcFace.
3. Laravel sends the samples to the face service and stores one active encrypted embedding in `staff_face_profiles`.
4. The old `teachers.face_descriptor` value is left in place so the system can return to `face-api.js`.

People who enrolled with `face-api.js` appear as **Re-enrollment required**. Their old descriptor is not converted. **Require Re-enrollment** deactivates the ArcFace profile and keeps the old descriptor. **Remove Enrollment** clears both.

## Verification

1. The staff member selects a class. If geofence enforcement is on, location is confirmed before the camera opens.
2. The camera captures three frames. The browser may show local guidance, but only the face service result counts.
3. Laravel loads the stored embedding and asks the face service to compare it.
4. Laravel accepts the attempt only when the cosine score meets `arcface_match_threshold`, the quality score is high enough, and liveness passes when liveness is enabled.
5. Laravel issues a short-lived single-use token. Check-in consumes that token. The image is not sent again.

ArcFace scores are cosine similarity from -1 to 1. Higher is better. The old `face_match_threshold` of 0.45 is a Euclidean distance and does not apply. `arcface_match_threshold` defaults to 0.40 and must be calibrated on real camera images before enforcement.

Attendance stores `face_model=arcface` so a cosine score is not mistaken for a historical distance score.

## Liveness

Face matching and liveness are separate. A high ArcFace score does not prove that a live person is present.

When **Face Liveness Detection** is enabled, the face service must load `models/liveness.onnx`. That file is the InsightFace liveness add-on. It scores an aligned 80×80 face and returns a live probability. The default acceptance threshold is 0.80. A printed photo or a face shown on a screen should score below that threshold, but the model does not label which kind of attack it saw, and it does not stop every video replay or high-quality mask.

If the setting is on and the model file is missing, verification fails closed. Attendance is not recorded. Frame-to-frame motion is only an extra check for a frozen image. It cannot approve an attempt by itself.

Download the add-on from the InsightFace add-on release and place it at `face-service/models/liveness.onnx`, then restart the face service:

https://github.com/deepinsight/insightface-model-addons/releases/download/addons/liveness.onnx

The published weights follow InsightFace's non-commercial research terms. Confirm that license before using them for institutional attendance. `liveness_model_loaded` on `/health` becomes true after a successful load.

When the setting is off, ArcFace verification continues without the liveness decision.

## Quality messages

| Code | Staff message |
| --- | --- |
| `NO_FACE` | No face detected. Please center your face in the camera. |
| `MULTIPLE_FACES` | Multiple faces detected. Only one person should be in the camera. |
| `FACE_TOO_SMALL` | Move closer to the camera. |
| `FACE_TOO_DARK` | Lighting is too low. Move to a brighter area. |
| `FACE_TOO_BLURRY` | Hold still. The image is blurry. |
| `FACE_POOR_POSITION` | Center your face and look directly at the camera. |
| `LIVENESS_FAILED` | A live face could not be verified. Please try again. |
| `PRESENTATION_ATTACK` | A possible photograph or screen presentation was detected. |
| `LIVENESS_UNAVAILABLE` | Face verification is temporarily unavailable. Please try again shortly. |
| `NOT_MATCHED` | Face not recognized. Please try again. |
| `READY` | Face looks good. |
| `SERVICE_UNAVAILABLE` | Face verification is temporarily unavailable. Please try again. |

## Security

- Bind the face service to localhost or a private network.
- Require `X-Api-Key` on `/v1` routes.
- Keep embeddings encrypted in the database.
- Do not log images, embeddings, or API keys.
- A failed or unavailable face service never records attendance.
- Replay of a token fails because the token is single-use and bound to the staff member and class.

## Rollback

Set **Face recognition engine** back to `face-api.js`, or set `FACE_RECOGNITION_ENGINE=face_api`. Existing descriptors are still used by that engine. ArcFace profiles remain stored and inactive for matching until the engine is switched back.

## Performance

ArcFace runs on the server, so recognition no longer depends on downloading browser models. Expect roughly 100–300 ms per comparison on a CPU once the models are loaded. The first request loads ONNX and is slower. The camera sends one request at a time.
