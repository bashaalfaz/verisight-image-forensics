# DeepSight Pro architecture

React (Vite + React Router) → same-origin `/api/*` requests → Flask session authentication + CSRF → MongoDB → private image storage and custom CNN inference.

## Request flow
1. React requests a CSRF token and establishes a session through signup/login.
2. Authenticated React pages request dashboard stats and paginated history.
3. Image upload is sent as multipart form data to Flask.
4. Flask validates file type, size and image dimensions; preprocesses to RGB 224×224.
5. Custom CNN predicts `P(REAL)`. Flask applies the validation-selected threshold.
6. Flask saves an optimized private image and stores prediction metadata in MongoDB.
7. React receives the saved record ID and renders the result; history/detail routes retrieve the record by authenticated owner ID.
8. Delete removes both the MongoDB record and its private image.

## MongoDB collections
- `users`: name, normalized email, Werkzeug password hash, created timestamp.
- `predictions`: owner ObjectId, prediction, class scores, selected threshold, model version, image metadata/private image key, timestamp.

## Trust boundaries
- Passwords are never stored in plaintext.
- CSRF protection is applied to state-changing requests.
- Rate limits protect signup, login and prediction endpoints.
- Every history, detail, image and delete query is scoped to the authenticated user's ObjectId.
- Uploads are not exposed as public static files.
- Results are screening estimates, not forensic verdicts.
