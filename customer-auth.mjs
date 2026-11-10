import { createHash, randomBytes } from "node:crypto";
import { HttpError, digest } from "./http.mjs";
import { history, claim, cancel } from "./customer-orders.mjs";

const sessionCookie = "__Host-olive_customer";
const verifierCookie = "__Host-olive_customer_pkce";
const duration = 8 * 3600;
const token = () => randomBytes(32).toString("hex");
const cookie = (key, value, age) => `${key}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const readCookie = (request, key) => request.headers.cookie?.split(/;\s*/).find((item) => item.startsWith(key + "="))?.slice(key.length + 1);
const redirect = (response, location, cookies = []) => {
  if (cookies.length) response.setHeader("Set-Cookie", cookies);
  response.writeHead(303, { Location: location, "Cache-Control": "no-store" });
  response.end();
};
const profile = (account) => account ? { email: account.email } : null;

export function customerAccounts({ origin, env, getStore, fetcher = fetch }) {
  const allowed = new Set(["google", "azure"]);
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  const requested = [...new Set((env.OLIVE_CUSTOMER_PROVIDERS || "google,azure").split(",")
    .map((part) => part.trim().toLowerCase()).filter((part) => allowed.has(part)))];
  // Name the missing setting in the function logs. The account page only tells customers that sign-in is unavailable.
  const missing = [];
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL is not set");
  if (!key) missing.push("SUPABASE_PUBLISHABLE_KEY is not set");
  else if (!key.startsWith("sb_publishable_")) missing.push("SUPABASE_PUBLISHABLE_KEY must be the Supabase key that begins with sb_publishable_");
  if (!requested.length) missing.push("OLIVE_CUSTOMER_PROVIDERS must list google, azure or both");
  if (missing.length) console.warn(`Customer sign-in is off for ${origin.origin}: ${missing.join("; ")}.`);
  const providers = missing.length ? [] : requested;
  const authUrl = (path) => {
    const host = new URL(env.SUPABASE_URL);
    if (host.protocol !== "https:" || host.username || host.password) throw new Error("Invalid authentication host.");
    return new URL("/auth/v1/" + path, host);
  };
  async function auth(path, options = {}) {
    const result = await fetcher(authUrl(path), {
      ...options, headers: { apikey: key, ...options.headers }, redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) throw new Error("Authentication failed.");
    return result.json();
  }
  async function session(request) {
    const value = readCookie(request, sessionCookie);
    return /^[a-f0-9]{64}$/.test(value || "") ? getStore().customerSession(digest(value), Date.now()) : null;
  }
  function begin(response, provider) {
    if (!providers.includes(provider)) return redirect(response, "/account.html?signin=unavailable");
    const verifier = token();
    const url = authUrl("authorize");
    url.search = new URLSearchParams({
      provider, redirect_to: origin.origin + "/api/customer-callback",
      scopes: "email", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "s256",
    });
    return redirect(response, url.href, [cookie(verifierCookie, verifier, 600)]);
  }
  async function callback(request, response) {
    const clear = cookie(verifierCookie, "", 0);
    try {
      const verifier = readCookie(request, verifierCookie);
      const code = new URL(request.url, origin).searchParams.get("code");
      if (!providers.length || !/^[a-f0-9]{64}$/.test(verifier || "") || !code || code.length > 512) throw new Error("Invalid sign-in callback.");
      const exchanged = await auth("token?grant_type=pkce", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });
      if (!exchanged.access_token) throw new Error("Missing authentication token.");
      const user = await auth("user", { headers: { Authorization: "Bearer " + exchanged.access_token } });
      const email = user.email?.trim().toLowerCase();
      if (!user.email_confirmed_at || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") || !/^[a-f0-9-]{36}$/i.test(user.id || "")) {
        throw new Error("A verified email is required.");
      }
      const secret = token();
      const store = getStore();
      const previous = await session(request);
      if (previous) await store.deleteCustomerSession(previous.token_hash);
      await store.createCustomerSession({
        token_hash: digest(secret), user_id: user.id, email, csrf: token(), expires: Date.now() + duration * 1000,
      });
      return redirect(response, "/account.html", [clear, cookie(sessionCookie, secret, duration)]);
    } catch {
      return redirect(response, "/account.html?signin=failed", [clear]);
    }
  }
  async function get(request, response, path, json) {
    if (path === "/api/customer-google") return begin(response, "google");
    if (path === "/api/customer-azure") return begin(response, "azure");
    if (path === "/api/customer-callback") return callback(request, response);
    if (!["/api/customer", "/api/customer-profile"].includes(path)) throw new HttpError(404, "Page not found.");
    const account = await session(request);
    if (!account) return json(response, 200, { account: null, providers, orders: [] });
    if (path === "/api/customer-profile") return json(response, 200, { account: profile(account) });
    const { state } = await getStore().read();
    return json(response, 200, { account: profile(account), csrf: account.csrf, orders: history(state, account) });
  }
  async function post(request, response, path, data, json) {
    if (!["/api/customer-claim", "/api/customer-cancel", "/api/customer-logout"].includes(path)) throw new HttpError(404, "Page not found.");
    const account = await session(request);
    if (!account) throw new HttpError(401, "Sign in to manage your orders.");
    if (request.headers["x-olive-csrf"] !== account.csrf) throw new HttpError(403, "Reload your account and try again.");
    const store = getStore();
    if (path === "/api/customer-logout") {
      await store.deleteCustomerSession(account.token_hash);
      response.setHeader("Set-Cookie", cookie(sessionCookie, "", 0));
      return json(response, 200, { ok: true });
    }
    const reference = typeof data.reference === "string" ? data.reference.trim().toUpperCase() : "";
    if (!/^[A-F0-9]{32}$/.test(reference)) throw new HttpError(422, "Enter a valid tracking reference.");
    const actor = "customer:" + account.user_id;
    if (path === "/api/customer-claim") {
      await store.limit(request, "customer-claim", 12, 600000);
      if (typeof data.postcode !== "string" || !/^[A-Z0-9 ]{5,12}$/i.test(data.postcode.trim())) throw new HttpError(422, "Enter a valid delivery postcode.");
      const result = await store.write(actor, "customer-claim", "", null, (state) => claim(state, account, reference, data.postcode));
      return json(response, 200, result.result);
    }
    const result = await store.write(actor, "customer-cancel", "", null, (state) => cancel(state, account, reference));
    return json(response, 200, result.result);
  }
  return { get, post, session };
}
