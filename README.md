# VeriSight – AI-Powered Image Forensics Platform

**An end-to-end deep learning platform for image authenticity detection using a custom Convolutional Neural Network (CNN), React, Flask, and MongoDB.**

VeriSight is a full-stack AI-powered image analysis platform designed to classify images as REAL or FAKE. It combines a custom CNN trained from scratch with a modern web application that allows users to upload images, receive prediction results, visualize confidence scores, and manage their previous analyses.

## Key Features

- **Custom Deep Learning Model:** CNN architecture trained from random initialization rather than relying on pretrained classification weights.
- **Image Classification:** Predicts whether an uploaded image is REAL or FAKE.
- **Secure Authentication:** User registration, login, password hashing, and session management.
- **Interactive Dashboard:** Displays prediction statistics and recent analyses.
- **Prediction History:** Stores and retrieves previous predictions for individual users.
- **Detailed Reports:** Displays class probabilities, confidence scores, model version, and image previews.
- **Private Image Storage:** Stores uploaded images securely with user-specific access controls.
- **Responsive Interface:** Modern React-based interface designed for desktop and mobile devices.

## System Architecture

```text
                 USER
                   |
                   v
          REACT FRONTEND (Vite)
                   |
          Image Upload / Login
                   |
                   v
             FLASK REST API
                   |
          Authentication & CSRF
                   |
                   v
          IMAGE PREPROCESSING
                   |
             Resize to 224x224
             RGB Conversion
                   |
                   v
          CUSTOM CNN MODEL
                   |
             REAL / FAKE
             Probability Scores
                   |
          Validation-Selected
            Decision Threshold
                   |
             +-----+------+
             |            |
             v            v
          MongoDB     Private Image
          Database      Storage
             |            |
             +-----+------+
                   |
                   v
          RESULT & HISTORY
                   |
                   v
             REACT DASHBOARD
```

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, Flask, REST API |
| Deep Learning | TensorFlow, Keras, Custom CNN |
| Database | MongoDB, PyMongo |
| Image Processing | Pillow, NumPy |
| Authentication | Flask-Login, Werkzeug |
| Security | CSRF Protection, Rate Limiting |
| Development | VS Code, Git, GitHub |

## Deep Learning Pipeline

The model development workflow includes:

1. Dataset collection and organization.
2. Image preprocessing and RGB conversion.
3. Duplicate image detection.
4. Source/generator-aware dataset splitting.
5. Training, validation, and independent testing.
6. Custom CNN architecture development.
7. Model training with training-only augmentation.
8. Validation-based decision threshold selection.
9. Independent test evaluation.
10. JPEG compression robustness evaluation.

The model is trained from random initialization, allowing the network to learn image features directly from the training dataset.

### Model Evaluation

The evaluation framework includes:

- Accuracy
- Precision
- Recall
- F1-score
- Confusion Matrix
- ROC-AUC
- JPEG Compression Robustness

**Note:** Actual evaluation scores should be added here after running the final training and independent testing pipeline. Do not report expected scores as achieved results.

## Application Workflow

1. Users register or sign in.
2. The dashboard provides access to image analysis and previous reports.
3. Users upload an image through the React interface.
4. Flask validates and preprocesses the uploaded image.
5. The custom CNN performs inference.
6. The backend applies the validation-selected decision threshold.
7. Prediction results and metadata are stored in MongoDB.
8. The frontend displays the prediction and confidence scores.
9. Users can revisit or delete previous reports.

## Project Structure

```text
verisight-image-forensics/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── models/
│   ├── scripts/
│   └── instance/
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── api.js
│   │   └── style.css
│   ├── package.json
│   └── vite.config.js
│
├── training/
│   ├── train_deepsight.ipynb
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   └── recruiter_pitch.md
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Installation and Setup

### Prerequisites

- Python 3.10 or 3.11
- Node.js 20+
- MongoDB or MongoDB Atlas
- npm

### 1. Clone the repository

```bash
git clone https://github.com/bashaalfaz/verisight-image-forensics.git
cd verisight-image-forensics
```

### 2. Start MongoDB

Using Docker:

```bash
docker compose up -d mongodb
```

Alternatively, configure a MongoDB Atlas connection URI.

### 3. Configure the backend

```bash
cd backend

python -m venv .venv

# Windows
.venv\\Scripts\\activate

pip install -r requirements.txt
```

Create a `.env` file using `.env.example`.

Configure:

```env
SECRET_KEY=your_random_secret
MONGO_URI=mongodb://127.0.0.1:27017/deepsight
FLASK_DEBUG=true
COOKIE_SECURE=false
```

### 4. Configure the trained model

After training the model using the notebook, place the generated artifacts in:

```text
backend/models/
    deepsight_detector.keras
    deepsight_model_config.json
```

### 5. Run Flask

```bash
python app.py
```

Backend URL:

`http://127.0.0.1:5000`

### 6. Run the React frontend

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

Frontend URL:

`http://127.0.0.1:5173`

## Database Design

### Users Collection

Stores:
- User ID
- Name
- Email
- Password hash
- Account creation timestamp

### Predictions Collection

Stores:
- Prediction ID
- User ID
- Original filename
- Predicted class
- REAL probability
- FAKE probability
- Confidence score
- Decision threshold
- Model version
- Image storage key
- Creation timestamp

Uploaded images are stored in private server-side storage, while MongoDB maintains their metadata and ownership references.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/csrf` | Generate CSRF token |
| POST | `/api/auth/signup` | Register account |
| POST | `/api/auth/login` | Authenticate user |
| GET | `/api/auth/me` | Retrieve current user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/dashboard` | Dashboard statistics |
| GET | `/api/history` | Retrieve prediction history |
| POST | `/api/predict` | Upload and classify image |
| GET | `/api/predictions/{id}` | Retrieve report |
| GET | `/api/predictions/{id}/image` | Retrieve private image |
| DELETE | `/api/predictions/{id}` | Delete prediction |

## Testing

The repository includes an end-to-end integration smoke test.

Run:

```bash
cd backend

python scripts/e2e_smoke_test.py
```

The test exercises:

- Account registration and login.
- Authenticated dashboard access.
- Image upload and CNN inference.
- MongoDB prediction persistence.
- Prediction history retrieval.
- Report and private image retrieval.
- Prediction deletion.
- Logout verification.

The test requires a running MongoDB instance and the trained model artifacts.

## Security Considerations

Implemented security measures include:

- Password hashing.
- CSRF protection.
- Session-based authentication.
- Login and signup rate limiting.
- Image upload size and format validation.
- User-specific data access.
- Private image storage.

Additional production hardening includes HTTPS, persistent rate limiting, email verification, password recovery, monitoring, database backups, and secure object storage.

## Future Improvements

- PDF export for prediction reports.
- Explainable AI using Grad-CAM visualizations.
- Additional image manipulation detection techniques.
- Expanded robustness evaluation.
- Model monitoring and version management.
- Production deployment with cloud infrastructure.

## Important Disclaimer

VeriSight provides AI-generated image authenticity estimates. Predictions are not definitive forensic evidence and should not be treated as proof of image authenticity or manipulation.

---

**Developed as a Deep Learning and Full-Stack Engineering Project.**
