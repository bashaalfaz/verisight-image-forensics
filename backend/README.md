# Flask API

The Flask API provides session authentication, CSRF-protected JSON endpoints, MongoDB persistence, private image storage and model inference.

Run from this directory:
```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

Configure `SECRET_KEY` and `MONGO_URI` in `.env`. The app loads `.env` automatically. MongoDB indexes are initialized on the first request and also work under Gunicorn.

The model must be copied to `models/deepsight_detector.keras` along with `models/deepsight_model_config.json`. Model input is RGB float32 `(1,224,224,3)` in `[0,255]`; pixel scaling is embedded in the trained custom CNN. The JSON config provides the validation-selected threshold and model name.

All `/api` POST/DELETE requests require the CSRF token obtained from `GET /api/csrf` in the `X-CSRFToken` header. The React client handles this automatically.

Prediction images are private files under `instance/uploads`. MongoDB stores metadata and ownership references. Never expose the uploads directory as a public static folder.

Run the full integration smoke test after starting MongoDB, Flask and installing the trained model:
```bash
python scripts/e2e_smoke_test.py
```
