"""
End-to-end smoke test for signup -> login -> upload/inference -> MongoDB -> history
-> report -> private image -> delete -> logout.

Run against a running backend with a working MongoDB and trained model:
  pip install requests pillow
  python scripts/e2e_smoke_test.py --base-url http://127.0.0.1:5000
"""
import argparse
import io
import secrets
import sys
from PIL import Image
import requests

parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://127.0.0.1:5000")
parser.add_argument("--email", default="")
parser.add_argument("--password", default="DeepSightSmoke!2026")
args = parser.parse_args()
base = args.base_url.rstrip("/")
email = args.email or f"deepsight-smoke-{secrets.token_hex(4)}@example.test"
password = args.password
session = requests.Session()

def check(response, expected, label):
    if response.status_code != expected:
        raise RuntimeError(f"{label}: expected HTTP {expected}, got {response.status_code}: {response.text[:500]}")
    print(f"[PASS] {label} ({response.status_code})")
    return response

try:
    csrf = check(session.get(base + "/api/csrf"), 200, "Get CSRF token").json()["csrf_token"]
    headers = {"X-CSRFToken": csrf}

    check(session.post(base + "/api/auth/signup", json={
        "name": "DeepSight Smoke Test", "email": email, "password": password
    }, headers=headers), 201, "Signup and create session")

    check(session.get(base + "/api/auth/me"), 200, "Read authenticated user")
    check(session.get(base + "/api/dashboard"), 200, "Read dashboard from MongoDB")

    # Create a small valid image; this checks the real inference and persistence path.
    buffer = io.BytesIO()
    Image.new("RGB", (512, 512), (120, 130, 140)).save(buffer, format="JPEG")
    buffer.seek(0)
    prediction_response = check(session.post(
        base + "/api/predict",
        files={"image": ("smoke-test.jpg", buffer, "image/jpeg")},
        headers=headers,
    ), 201, "Upload image, run model and persist prediction")
    item = prediction_response.json()["item"]
    record_id = item["id"]

    history = check(session.get(base + "/api/history"), 200, "Read saved prediction history").json()
    assert any(row["id"] == record_id for row in history["items"]), "New prediction missing from history."
    print("[PASS] Prediction is present in MongoDB-backed history")

    detail = check(session.get(base + f"/api/predictions/{record_id}"), 200, "Read prediction report").json()["item"]
    assert detail["prediction"] in ("REAL", "FAKE")
    check(session.get(base + f"/api/predictions/{record_id}/image"), 200, "Read private stored image")

    check(session.delete(base + f"/api/predictions/{record_id}", headers=headers), 200, "Delete prediction and image")
    check(session.get(base + f"/api/predictions/{record_id}"), 404, "Confirm report deletion")
    check(session.post(base + "/api/auth/logout", headers=headers), 200, "Logout")
    check(session.get(base + "/api/auth/me"), 401, "Confirm session ended")
    print("\\nALL END-TO-END CHECKS PASSED")
except Exception as exc:
    print(f"\\nSMOKE TEST FAILED: {exc}", file=sys.stderr)
    sys.exit(1)
