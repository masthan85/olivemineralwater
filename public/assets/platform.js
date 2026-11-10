let csrf;

export async function api(path, payload) {
  const options = { cache: "no-store" };
  if (payload !== undefined) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/json" };
    if (csrf) options.headers["X-Olive-CSRF"] = csrf;
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "The request could not be completed.");
    error.status = response.status;
    if (response.status === 401 && ["/api/workspace", "/api/commands", "/api/logout"].includes(path)) {
      location.assign("/login.html?next=" + encodeURIComponent(location.pathname));
    }
    throw error;
  }
  if (result.csrf) csrf = result.csrf;
  return result;
}
