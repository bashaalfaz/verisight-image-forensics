import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory
from flask_login import (
    LoginManager, UserMixin, current_user, login_required,
    login_user, logout_user
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_pymongo import PyMongo
from flask_wtf.csrf import CSRFError, CSRFProtect, generate_csrf
from PIL import Image, UnidentifiedImageError
from pymongo.errors import DuplicateKeyError
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE = Path(__file__).resolve().parent
PROJECT_ROOT = BASE.parent
load_dotenv(BASE / ".env")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE / "instance" / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = BASE / "models" / "deepsight_detector.keras"
MODEL_CONFIG_PATH = BASE / "models" / "deepsight_model_config.json"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
IMAGE_SIZE = (224, 224)

app = Flask(__name__, static_folder=None)
secret = os.getenv("SECRET_KEY")
if not secret and os.getenv("FLASK_DEBUG", "false").lower() != "true":
    raise RuntimeError("Set a strong SECRET_KEY in backend/.env before starting Flask.")
app.config.update(
    SECRET_KEY=secret or "local-development-only-change-me",
    MONGO_URI=os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/deepsight"),
    MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "false").lower() == "true",
    REMEMBER_COOKIE_HTTPONLY=True,
    REMEMBER_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 12,
)

mongo = PyMongo(app)
csrf = CSRFProtect(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)
login_manager = LoginManager(app)
login_manager.session_protection = "strong"

_model = None
_model_config = None


class User(UserMixin):
    def __init__(self, document):
        self.id = str(document["_id"])
        self.name = document.get("name", "Member")
        self.email = document["email"]


@login_manager.user_loader
def load_user(user_id):
    try:
        if not ObjectId.is_valid(user_id):
            return None
        document = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        return User(document) if document else None
    except Exception:
        app.logger.exception("Unable to load session user")
        return None


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Authentication required. Please sign in."}), 401


def now_utc():
    return datetime.now(timezone.utc)


def serialize_prediction(document):
    created = document.get("created_at")
    return {
        "id": str(document["_id"]),
        "filename": document.get("filename", "image"),
        "prediction": document.get("prediction"),
        "confidence": float(document.get("confidence", 0)),
        "probability_real": float(document.get("probability_real", 0)),
        "probability_fake": float(document.get("probability_fake", 0)),
        "decision_threshold": float(document.get("decision_threshold", 0.5)),
        "model_version": document.get("model_version", "unknown"),
        "image_bytes": int(document.get("image_bytes", 0)),
        "created_at": created.isoformat() if created else None,
        "image_url": f"/api/predictions/{document['_id']}/image",
        "disclaimer": document.get(
            "disclaimer",
            "AI screening estimate only; not definitive forensic proof."
        ),
    }


def get_model():
    global _model, _model_config
    if _model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(
                "Trained model is missing. Copy deepsight_detector.keras "
                "into backend/models/ and restart the backend."
            )
        import tensorflow as tf
        _model = tf.keras.models.load_model(MODEL_PATH)
        if MODEL_CONFIG_PATH.exists():
            _model_config = json.loads(MODEL_CONFIG_PATH.read_text(encoding="utf-8"))
        else:
            _model_config = {
                "decision_threshold": 0.5,
                "model_name": "DeepSight_CustomCNN",
            }
    return _model


def get_threshold():
    if _model_config is None:
        get_model()
    threshold = float((_model_config or {}).get("decision_threshold", 0.5))
    if not 0 <= threshold <= 1:
        raise RuntimeError("Model decision threshold must be between 0 and 1.")
    return threshold


def preprocess_image(file_storage):
    try:
        with Image.open(file_storage.stream) as source:
            width, height = source.size
            if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are invalid or exceed 40 megapixels.")
            image = source.convert("RGB").resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
            array = np.asarray(image, dtype=np.float32)[None, ...]
        file_storage.stream.seek(0)
        return array
    except UnidentifiedImageError as exc:
        raise ValueError("The uploaded file is not a valid image.") from exc


def save_private_image(file_storage):
    file_storage.stream.seek(0)
    with Image.open(file_storage.stream) as source:
        image = source.convert("RGB")
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        image_key = f"{ObjectId()}.jpg"
        destination = UPLOAD_DIR / image_key
        image.save(destination, "JPEG", quality=88, optimize=True)
    return image_key


def owned_prediction(record_id):
    if not ObjectId.is_valid(record_id):
        return None
    return mongo.db.predictions.find_one({
        "_id": ObjectId(record_id),
        "user_id": ObjectId(current_user.id),
    })


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.errorhandler(CSRFError)
def csrf_error(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Security token expired or invalid. Please retry."}), 400
    return jsonify({"error": "Security token expired or invalid. Refresh the page and retry."}), 400


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "Image exceeds the 12 MB upload limit."}), 413


@app.errorhandler(429)
def rate_limited(_error):
    return jsonify({"error": "Too many requests. Please wait and try again."}), 429


@app.get("/api/csrf")
def csrf_token():
    return jsonify({"csrf_token": generate_csrf()})


@app.get("/api/health")
def health():
    database_ok = False
    database_message = "unavailable"
    try:
        mongo.db.command("ping")
        database_ok = True
        database_message = "connected"
    except Exception:
        app.logger.exception("MongoDB health check failed")
    return jsonify({
        "status": "ok" if database_ok else "degraded",
        "database": database_message,
        "model_file_present": MODEL_PATH.exists(),
        "frontend_built": (FRONTEND_DIST / "index.html").exists(),
    }), (200 if database_ok else 503)


# --------------------------- Authentication API ---------------------------

@app.post("/api/auth/signup")
@limiter.limit("5 per hour")
def api_signup():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()[:80]
    email = str(payload.get("email", "")).strip().lower()[:254]
    password = str(payload.get("password", ""))

    if len(name) < 2:
        return jsonify({"error": "Name must contain at least 2 characters."}), 400
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 10:
        return jsonify({"error": "Password must contain at least 10 characters."}), 400

    document = {
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "created_at": now_utc(),
    }
    try:
        result = mongo.db.users.insert_one(document)
    except DuplicateKeyError:
        return jsonify({"error": "An account with this email already exists."}), 409

    login_user(User({**document, "_id": result.inserted_id}), remember=False)
    return jsonify({
        "user": {"id": str(result.inserted_id), "name": name, "email": email}
    }), 201


@app.post("/api/auth/login")
@limiter.limit("10 per minute")
def api_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    document = mongo.db.users.find_one({"email": email})
    if not document or not check_password_hash(document.get("password_hash", ""), password):
        return jsonify({"error": "Email or password is incorrect."}), 401
    login_user(User(document), remember=False)
    return jsonify({
        "user": {
            "id": str(document["_id"]),
            "name": document.get("name", "Member"),
            "email": document["email"],
        }
    })


@app.get("/api/auth/me")
@login_required
def api_me():
    return jsonify({
        "user": {"id": current_user.id, "name": current_user.name, "email": current_user.email}
    })


@app.post("/api/auth/logout")
@login_required
def api_logout():
    logout_user()
    return jsonify({"message": "Signed out successfully."})


# ------------------------------ Dashboard API -----------------------------

@app.get("/api/dashboard")
@login_required
def api_dashboard():
    user_id = ObjectId(current_user.id)
    query = {"user_id": user_id}
    total = mongo.db.predictions.count_documents(query)
    fake_count = mongo.db.predictions.count_documents({**query, "prediction": "FAKE"})
    real_count = mongo.db.predictions.count_documents({**query, "prediction": "REAL"})
    recent = list(
        mongo.db.predictions.find(query).sort("created_at", -1).limit(6)
    )
    return jsonify({
        "stats": {
            "total": total,
            "fake": fake_count,
            "real": real_count,
        },
        "recent": [serialize_prediction(item) for item in recent],
    })


@app.get("/api/history")
@login_required
def api_history():
    try:
        limit = min(max(int(request.args.get("limit", 100)), 1), 100)
        page = max(int(request.args.get("page", 1)), 1)
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters."}), 400

    query = {"user_id": ObjectId(current_user.id)}
    total = mongo.db.predictions.count_documents(query)
    cursor = (
        mongo.db.predictions.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    return jsonify({
        "items": [serialize_prediction(item) for item in cursor],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    })


@app.get("/api/predictions/<record_id>")
@login_required
def api_prediction_detail(record_id):
    record = owned_prediction(record_id)
    if not record:
        return jsonify({"error": "Prediction not found."}), 404
    return jsonify({"item": serialize_prediction(record)})


@app.get("/api/predictions/<record_id>/image")
@login_required
def api_prediction_image(record_id):
    record = owned_prediction(record_id)
    if not record:
        abort(404)
    image_key = record.get("image_key", "")
    if not image_key or Path(image_key).name != image_key:
        abort(404)
    path = UPLOAD_DIR / image_key
    if not path.is_file():
        abort(404)
    return send_from_directory(UPLOAD_DIR, image_key, mimetype="image/jpeg", max_age=0)


@app.delete("/api/predictions/<record_id>")
@login_required
def api_delete_prediction(record_id):
    record = owned_prediction(record_id)
    if not record:
        return jsonify({"error": "Prediction not found."}), 404
    mongo.db.predictions.delete_one({
        "_id": record["_id"],
        "user_id": ObjectId(current_user.id),
    })
    image_key = record.get("image_key")
    if image_key and Path(image_key).name == image_key:
        try:
            (UPLOAD_DIR / image_key).unlink(missing_ok=True)
        except OSError:
            app.logger.exception("Could not remove private image file")
    return jsonify({"message": "Prediction and stored image deleted."})


# ------------------------------ Prediction API ----------------------------

@app.post("/api/predict")
@login_required
@limiter.limit("30 per hour")
def api_predict():
    uploaded = request.files.get("image")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose an image first."}), 400

    extension = uploaded.filename.rsplit(".", 1)[-1].lower() if "." in uploaded.filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Upload a JPG, JPEG, PNG or WEBP image."}), 400

    uploaded.stream.seek(0, os.SEEK_END)
    byte_count = uploaded.stream.tell()
    uploaded.stream.seek(0)
    if byte_count == 0:
        return jsonify({"error": "The uploaded file is empty."}), 400
    if byte_count > MAX_UPLOAD_BYTES:
        return jsonify({"error": "Image exceeds the 12 MB upload limit."}), 413

    image_key = None
    try:
        batch = preprocess_image(uploaded)
        model = get_model()
        output = np.asarray(model.predict(batch, verbose=0)).reshape(-1)
        if output.size != 1 or not np.isfinite(output[0]):
            raise RuntimeError("The model returned an invalid prediction.")
        probability_real = float(np.clip(output[0], 0.0, 1.0))
        probability_fake = 1.0 - probability_real
        threshold = get_threshold()
        label = "REAL" if probability_real >= threshold else "FAKE"
        confidence = probability_real if label == "REAL" else probability_fake

        image_key = save_private_image(uploaded)
        created_at = now_utc()
        model_version = os.getenv(
            "MODEL_VERSION",
            (_model_config or {}).get("model_name", "DeepSight_CustomCNN"),
        )
        document = {
            "user_id": ObjectId(current_user.id),
            "prediction": label,
            "confidence": round(confidence * 100, 2),
            "probability_real": round(probability_real * 100, 2),
            "probability_fake": round(probability_fake * 100, 2),
            "decision_threshold": threshold,
            "filename": secure_filename(uploaded.filename)[:180] or "uploaded-image",
            "image_key": image_key,
            "image_bytes": byte_count,
            "created_at": created_at,
            "model_version": model_version,
            "disclaimer": "AI screening estimate only; not definitive forensic proof.",
        }
        inserted = mongo.db.predictions.insert_one(document)
        document["_id"] = inserted.inserted_id
        return jsonify({"item": serialize_prediction(document)}), 201

    except (UnidentifiedImageError, OSError):
        if image_key:
            (UPLOAD_DIR / image_key).unlink(missing_ok=True)
        return jsonify({"error": "The uploaded file is not a valid image."}), 400
    except ValueError as exc:
        if image_key:
            (UPLOAD_DIR / image_key).unlink(missing_ok=True)
        return jsonify({"error": str(exc)}), 400
    except (RuntimeError, ImportError) as exc:
        if image_key:
            (UPLOAD_DIR / image_key).unlink(missing_ok=True)
        app.logger.exception("Model inference failed")
        return jsonify({"error": str(exc) if isinstance(exc, RuntimeError) else "TensorFlow is not installed in the backend environment."}), 503
    except Exception:
        if image_key:
            (UPLOAD_DIR / image_key).unlink(missing_ok=True)
        app.logger.exception("Prediction pipeline failed")
        return jsonify({"error": "Prediction could not be completed. Check backend logs."}), 500


# ----------------------------- SPA static hosting --------------------------

@app.get("/")
def spa_root():
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({
        "message": "DeepSight API is running. Start the React dev server with `npm run dev` in frontend/.",
        "frontend_built": False,
    })


@app.get("/assets/<path:filename>")
def spa_assets(filename):
    return send_from_directory(FRONTEND_DIST / "assets", filename)


@app.get("/<path:client_route>")
def spa_fallback(client_route):
    # Do not turn unknown API paths into the SPA document.
    if client_route.startswith("api/"):
        return jsonify({"error": "API endpoint not found."}), 404
    candidate = FRONTEND_DIST / client_route
    if candidate.is_file():
        return send_from_directory(FRONTEND_DIST, client_route)
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"error": "Frontend build not found. Run npm run build in frontend/."}), 404


_indexes_ready = False

def initialize_indexes():
    try:
        mongo.db.users.create_index("email", unique=True, name="unique_user_email")
        mongo.db.predictions.create_index(
            [("user_id", 1), ("created_at", -1)],
            name="user_history_recent",
        )
        return True
    except Exception:
        app.logger.exception("MongoDB indexes could not be initialized.")
        return False

@app.before_request
def ensure_database_indexes():
    # Runs for both `python app.py` and production WSGI servers such as Gunicorn.
    global _indexes_ready
    if not _indexes_ready:
        _indexes_ready = initialize_indexes()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )
