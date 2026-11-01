# Face verification service

This process detects a face, scores image quality, checks liveness, creates an ArcFace embedding, and compares embeddings. Laravel decides whether attendance is verified.

Official InsightFace `buffalo_l` weights are not included. The code license and the weight license are different, and the published weights are not licensed for general commercial redistribution. Place your own ONNX files in `models/`.

Expected files:

- `models/det_10g.onnx`
- `models/w600k_r50.onnx`
- `models/liveness.onnx` — InsightFace anti-spoof model. Required when Face Liveness Detection is enabled.

## Run locally

Windows:

```powershell
cd face-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

Linux:

```bash
cd face-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

`GET /health` does not require an API key. Every `/v1/face/*` route requires `X-Api-Key`.

## Docker

From the Laravel project root:

```bash
docker compose -f docker-compose.face.yml up --build
```

The compose file starts only this service. It does not run Laravel or MySQL.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

Tests use a fake detector so they do not need model files.
