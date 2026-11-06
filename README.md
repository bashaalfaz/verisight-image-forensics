# DeepSight Pro — Full-stack AI image screening

DeepSight is a React + Flask + MongoDB application connected to a custom CNN trained from random initialization. The project includes account registration, session login, image inference, private image storage, prediction persistence, dashboard statistics, history, report details and deletion.

## Architecture

React (Vite) → same-origin `/api/*` requests → Flask session + CSRF → MongoDB users/predictions → private local image storage. The prediction API loads the trained Keras model and the validation-selected threshold from `deepsight_model_config.json`.

## 1. Requirements

- Python 3.10 or 3.11 recommended for TensorFlow compatibility.
- Node.js 20+ and npm.
- MongoDB local or MongoDB Atlas.
- A trained `deepsight_detector.keras` model created by `training/train_deepsight.ipynb`.

## 2. Start MongoDB

Local option with Docker:
```bash
docker compose up -d mongodb
```
Or create a MongoDB Atlas database and use its connection URI.

## 3. Configure and start Flask

```bash
cd backend
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:
- Set a long random `SECRET_KEY`.
- Set `MONGO_URI` to local MongoDB or your Atlas URI.
- Keep `COOKIE_SECURE=false` for localhost. Set it to `true` behind HTTPS in production.

Train the notebook first, then copy **both** generated files:
- `deepsight_detector.keras` → `backend/models/deepsight_detector.keras`
- `deepsight_model_config.json` → `backend/models/deepsight_model_config.json`

Start Flask:
```bash
python app.py
```
Backend health:
`http://127.0.0.1:5000/api/health`

On Windows, after MongoDB is running and `.env` is configured, you can use `start_deepsight_windows.bat` from the project root. It opens separate backend and frontend terminals. The first run installs Python and Node dependencies.

## 4. Start React

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://127.0.0.1:5173`. Vite proxies `/api` to Flask on port 5000. Keep both servers running during development.

## 5. Production-style frontend build

```bash
cd frontend
npm run build
```
Then run Flask. Flask serves `frontend/dist` at `http://127.0.0.1:5000`. Rebuild after frontend changes.

## 6. End-to-end integration test

With MongoDB, Flask, the trained model and frontend/backend dependencies running:
```bash
cd backend
python scripts/e2e_smoke_test.py --base-url http://127.0.0.1:5000
```
This test creates a temporary smoke-test account, uploads a generated sample image through the actual model, checks MongoDB history/report/private-image retrieval, deletes the prediction and verifies logout. It requires the trained model file and a working database. The test account remains in the users collection; remove it manually after the test if desired.

## 7. Data stored

MongoDB:
- `users`: normalized email, name, password hash, account timestamp.
- `predictions`: owner ID, prediction, scores, threshold, model version, timestamp, filename, private image key and file metadata.

Images are stored as optimized JPEG files in `backend/instance/uploads`, not as MongoDB binary blobs. Every image read is checked against the signed-in user's ownership. Keep this folder private and back it up according to your retention policy.

## 8. API flow

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/csrf` | Obtain CSRF token |
| POST | `/api/auth/signup` | Register and sign in |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current session |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/dashboard` | Statistics and recent results |
| GET | `/api/history` | Paginated user history |
| POST | `/api/predict` | Upload, infer and persist |
| GET | `/api/predictions/<id>` | Report detail |
| GET | `/api/predictions/<id>/image` | Private image |
| DELETE | `/api/predictions/<id>` | Delete record and image |
| GET | `/api/health` | Database/model/frontend health |

## 9. Security before public deployment

CSRF protection, password hashing, per-user data ownership, upload limits, unique email indexing and basic IP-based rate limits are included. For production, use HTTPS, a strong secret, a persistent rate-limit store (Redis), MongoDB authentication/TLS/network allow-list, email verification, password reset, monitoring, backups, private object storage and account/image deletion workflows. The in-memory rate-limit store is for development only.

The detector is an AI screening estimate, not definitive forensic evidence. Report only measured evaluation results from your own held-out datasets.
