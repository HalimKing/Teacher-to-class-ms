# Face API Models

Place the `face-api.js` model files in this directory before enabling facial recognition.

Required model groups:

- `ssd_mobilenetv1_model-*`
- `face_landmark_68_model-*`
- `face_recognition_model-*`

The frontend lazy-loads these files from `/models/face-api` only when enrollment or verification starts.
