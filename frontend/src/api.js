let csrfToken = null;

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function ensureCsrf(force = false) {
  if (force) csrfToken = null;
  if (!csrfToken) {
    const response = await fetch("/api/csrf", { credentials: "include" });
    const data = await readResponse(response);
    csrfToken = data.csrf_token;
  }
  return csrfToken;
}

export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  async function send() {
    if (mutating) headers.set("X-CSRFToken", await ensureCsrf());
    return fetch(path, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  }

  let response = await send();
  if (mutating && response.status === 400) {
    const body = await response.clone().json().catch(() => ({}));
    if ((body.error || "").toLowerCase().includes("security token")) {
      await ensureCsrf(true);
      response = await send();
    }
  }
  return readResponse(response);
}
