import { randomBytes } from "node:crypto";
import { derive, digest, HttpError } from "./http.mjs";
import { seed } from "./seed.mjs";

export function hostedStorage(env = process.env, fetcher = fetch) {
  const key = env.SUPABASE_SECRET_KEY;
  let origin;
  try {
    origin = new URL(env.SUPABASE_URL);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.pathname !== "/" || origin.search || origin.hash || !key?.startsWith("sb_secret_")) throw new Error();
  } catch {
    throw new HttpError(503, "The hosted database is not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  async function query(path, { method = "GET", params, payload, prefer } = {}) {
    const url = new URL("/rest/v1/" + path, origin);
    url.search = new URLSearchParams(params || {});
    const headers = { apikey: key, Accept: "application/json" };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    let response;
    try {
      response = await fetcher(url, {
        method, headers, redirect: "error", signal: AbortSignal.timeout(5000),
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch {
      throw new HttpError(503, "The hosted database is temporarily unavailable.");
    }
    if (!response.ok) {
      const info = await response.json().catch(() => ({}));
      console.error("OLIVE database request failed", path, response.status, info.code || "");
      throw new HttpError(503, "The hosted database is unavailable. Check that supabase.sql has been applied and the server key is valid.");
    }
    const result = await response.text();
    return result ? JSON.parse(result) : undefined;
  }

  const one = async (table, params) => (await query(table, { params: { ...params, limit: "1" } }))[0];
  const rpc = (name, payload) => query("rpc/" + name, { method: "POST", payload });
  const readExisting = () => one("olive_workspace", { id: "eq.1", select: "revision,state" });
  let initialized;
  async function init() {
    if (await readExisting()) return;
    const state = seed();
    for (const list of ["customers", "assets", "lots", "orders", "events", "movements", "requests"]) state[list] = [];
    state.nextOrder = 1001;
    await query("olive_workspace", {
      method: "POST", params: { on_conflict: "id" }, prefer: "resolution=ignore-duplicates,return=minimal",
      payload: { id: 1, revision: 0, state },
    });
  }
  async function read() {
    initialized ??= init().catch((error) => { initialized = undefined; throw error; });
    await initialized;
    const row = await readExisting();
    if (!row) throw new HttpError(503, "The hosted workspace is unavailable.");
    return row;
  }

  const configuredEmail = env.OLIVE_ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = env.OLIVE_ADMIN_PASSWORD;
  let provisioning;
  async function staff(email) {
    const lookup = () => one("olive_staff", { email: "eq." + email, select: "email,salt,password_hash" });
    const existing = await lookup();
    if (existing || !configuredEmail || email !== configuredEmail || !configuredPassword) return existing;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) || configuredPassword.length < 16 || configuredPassword.length > 256) {
      throw new HttpError(503, "Check the staff setup email and password in Vercel.");
    }
    provisioning ??= (async () => {
      const salt = randomBytes(24).toString("hex");
      const hash = await derive(configuredPassword, salt);
      await query("olive_staff", {
        method: "POST", params: { on_conflict: "email" }, prefer: "resolution=ignore-duplicates,return=minimal",
        payload: { email, salt, password_hash: hash.toString("hex") },
      });
    })().finally(() => { provisioning = undefined; });
    await provisioning;
    return lookup();
  }

  async function write(actor, action, target, revision, apply) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await read();
      if (revision != null && current.revision !== revision) break;
      const result = apply(current.state);
      const committed = await rpc("olive_commit", {
        p_revision: current.revision, p_state: current.state, p_actor: actor, p_action: action, p_target: target,
      });
      if (committed === true) return { state: current.state, revision: current.revision + 1, result };
      if (revision != null) break;
    }
    throw new HttpError(409, revision == null ? "Another request was saved. Please try submitting again." :
      "Another update was saved. Close this form, then reopen it to review the latest records.");
  }

  return {
    read, staff, write,
    session: (hash, now) => one("olive_sessions", { token_hash: "eq." + hash, expires: "gt." + now, select: "token_hash,email,csrf,expires" }),
    deleteSession: (hash) => query("olive_sessions", { method: "DELETE", params: { token_hash: "eq." + hash } }),
    createSession: (row, previous) => rpc("olive_start_session", {
      p_hash: row.token_hash, p_email: row.email, p_csrf: row.csrf, p_expires: row.expires, p_previous: previous ?? null, p_now: Date.now(),
    }),
    async limit(request, scope, count, window) {
      const ip = request.headers["x-vercel-forwarded-for"] || request.socket.remoteAddress || "unknown";
      const hits = await rpc("olive_rate_hit", { p_bucket: scope + ":" + digest(ip), p_now: Date.now(), p_window: window });
      if (hits > count) throw new HttpError(429, "Too many requests. Try again later.");
    },
  };
}
