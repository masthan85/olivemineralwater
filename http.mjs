import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import * as domain from "./domain.mjs";
import { cleanPostcode } from "./public/assets/stock.mjs";

const hashPassword = promisify(scrypt);
export const derive = (password, salt) => hashPassword(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
const directory = dirname(fileURLToPath(import.meta.url));

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const actions = new Map([
  ["new-order", domain.newOrder], ["receive", domain.receive], ["save-asset", domain.saveAsset],
  ["save-customer", domain.saveCustomer], ["adjust", domain.adjust],
  ["repeat-receipt", (state, data, id) => domain.adjust(state, data, id, true)],
]);
for (const action of ["dispatch", "cancel", "delivered", "exception", "retry"]) {
  actions.set(action, (state, data, id) => domain.progress(state, data, id, action));
}
for (const action of ["hold", "release-hold"]) {
  actions.set(action, (state, data, id) => domain.hold(state, data, id, action));
}
for (const action of ["review-request", "close-request"]) {
  actions.set(action, (state, data, id) => domain.reviewRequest(state, data, id, action));
}

export const digest = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("hex");
const getToken = (request, cookieName) => request.headers.cookie?.split(/;\s*/).find((pair) => pair.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
const cookie = (cookieName, secure, value, maxAge) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
const json = (response, status, value) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
};

async function body(request, origin) {
  if (request.headers.origin !== origin.origin) throw new HttpError(403, "Request origin is invalid.");
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "Send JSON.");
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 24000) throw new HttpError(413, "Request is too large.");
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

function fields(entries) {
  if (!Array.isArray(entries) || entries.length > 100 || entries.some((pair) => !Array.isArray(pair) || pair.length !== 2 ||
      typeof pair[0] !== "string" || !/^[a-zA-Z][a-zA-Z0-9]{0,25}$/.test(pair[0]) || typeof pair[1] !== "string" || pair[1].length > 1200)) {
    throw new HttpError(400, "Invalid form fields.");
  }
  return new URLSearchParams(entries);
}

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png" };
export const publicPages = new Set(["index.html", "about.html", "delivery.html", "products.html", "track.html", "order.html", "trade-enquiry.html", "login.html", "account.html"]);
export const staffPages = new Set(["operations.html", ...["assets", "customers", "deliveries", "orders", "reports", "requests", "traceability", "warehouse"].map((name) => `ops-${name}.html`)]);
export const apiNames = ["config", "workspace", "login", "tracking", "requests", "logout", "commands",
  "customer", "customer-profile", "customer-google", "customer-azure", "customer-callback", "customer-claim", "customer-cancel", "customer-logout"];
export function createHandler({ origin, demo = false, storage, limit, customers, route = (request) => new URL(request.url, origin).pathname }) {
  const secure = origin.protocol === "https:";
  const cookieName = secure ? "__Host-olive_staff" : "olive_staff";
  let passwordChecks = 0;
  async function session(request) {
    const value = getToken(request, cookieName);
    return /^[a-f0-9]{64}$/.test(value) ? storage.session(digest(value), Date.now()) : null;
  }

  async function handleApi(request, response, path, account) {
    if (path === "/api/customer" || path.startsWith("/api/customer-")) {
      if (!customers && request.method === "GET" && ["/api/customer", "/api/customer-profile"].includes(path)) {
        return json(response, 200, { account: null, providers: [], orders: [] });
      }
      if (!customers) throw new HttpError(404, "Customer sign-in is unavailable.");
      if (request.method === "GET") return customers.get(request, response, path, json);
      if (request.method === "POST") return customers.post(request, response, path, await body(request, origin), json);
      throw new HttpError(405, "Method not allowed.");
    }
    if (request.method === "GET" && path === "/api/config") return json(response, 200, { demo });
    if (request.method === "GET" && path === "/api/workspace") {
      if (!account) throw new HttpError(401, "Sign in to view the workspace.");
      const current = await storage.read();
      return json(response, 200, { state: current.state, revision: current.revision, csrf: account.csrf, staff: account.email, demo });
    }
    if (request.method !== "POST") throw new HttpError(404, "Page not found.");
    const data = await body(request, origin);
    if (path === "/api/login") {
      await limit(request, "login", 12, 600000);
      if (typeof data.email !== "string" || typeof data.password !== "string" || data.email.length > 120 || data.password.length > 256) {
        throw new HttpError(400, "Invalid sign-in details.");
      }
      if (passwordChecks >= 4) throw new HttpError(429, "Sign-in is busy. Try again shortly.");
      const user = await storage.staff(data.email.trim().toLowerCase());
      let derived;
      passwordChecks++;
      try {
        derived = await derive(data.password, user?.salt || "olive-invalid-staff-account");
      } finally {
        passwordChecks--;
      }
      if (!timingSafeEqual(derived, Buffer.from(user?.password_hash || "0".repeat(128), "hex")) || !user) {
        throw new HttpError(401, "Email or password is incorrect.");
      }
      const secret = token();
      await storage.createSession({
        token_hash: digest(secret), email: user.email, csrf: token(), expires: Date.now() + 8 * 3600000,
      }, account?.token_hash);
      response.setHeader("Set-Cookie", cookie(cookieName, secure, secret, 28800));
      return json(response, 200, { ok: true });
    }
    if (path === "/api/tracking") {
      await limit(request, "tracking", 45, 60000);
      const reference = typeof data.reference === "string" ? data.reference.trim().toUpperCase() : "";
      const postcode = typeof data.postcode === "string" && data.postcode.length < 20 ? cleanPostcode(data.postcode) : "";
      if (!postcode || !(/^[A-F0-9]{32}$/.test(reference) || (demo && /^OL-\d{4}$/.test(reference)))) {
        throw new HttpError(404, "Order or request not found.");
      }
      const { state } = await storage.read();
      const intake = state.requests.find((item) => item.reference === reference && cleanPostcode(item.postcode) === postcode);
      const order = intake ? state.orders.find((item) => item.id === intake.orderId)
        : state.orders.find((item) => (item.tracking === reference || (demo && item.id === reference)) && cleanPostcode(item.recipient.postcode) === postcode);
      if (!order && !intake) throw new HttpError(404, "Order or request not found.");
      return json(response, 200, order ? { status: order.status, scheduled: order.expected, delivered: order.delivered } : { status: intake.status });
    }
    if (path === "/api/requests") {
      await limit(request, "intake", 20, 600000);
      const form = fields(data.fields);
      const customer = await customers?.session(request);
      if (form.get("expectAccount") === "1" && !customer) throw new HttpError(401, "Your session expired. Sign in again to save the request to your account.");
      const actor = customer ? "customer:" + customer.user_id : "public";
      const result = await storage.write(actor, "submit-request", "", null, (state) => domain.intake(state, form, customer));
      return json(response, 201, { reference: result.result.reference, savedToAccount: Boolean(customer) });
    }
    account = await session(request);
    if (!account) throw new HttpError(401, "Sign in to continue.");
    if (request.headers["x-olive-csrf"] !== account.csrf) throw new HttpError(403, "Reload the workspace and try again.");
    if (path === "/api/logout") {
      await storage.deleteSession(account.token_hash);
      response.setHeader("Set-Cookie", cookie(cookieName, secure, "", 0));
      return json(response, 200, { ok: true });
    }
    if (path === "/api/commands") {
      const command = actions.get(data.command);
      if (!command || typeof data.id !== "string" || data.id.length > 64 || !Number.isSafeInteger(data.revision) || data.revision < 0) {
        throw new HttpError(400, "Unknown or invalid command.");
      }
      const form = fields(data.fields);
      const result = await storage.write(account.email, data.command, data.id, data.revision, (state) => command(state, form, data.id));
      return json(response, 200, { state: result.state, revision: result.revision, message: result.result });
    }
    throw new HttpError(404, "Page not found.");
  }

  return async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (secure) response.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      if (request.headers.host !== origin.host) throw new HttpError(400, "Invalid host.");
      const path = route(request);
      const account = await session(request);
      if (path.startsWith("/api/")) return await handleApi(request, response, path, account);
      if (!["GET", "HEAD"].includes(request.method)) throw new HttpError(405, "Method not allowed.");
      const name = path === "/" ? "index.html" : path.slice(1);
      if (staffPages.has(name) && !account) {
        response.writeHead(302, { Location: `/login.html?next=${encodeURIComponent(path)}`, "Cache-Control": "no-store" });
        return response.end();
      }
      const extension = extname(name);
      const asset = name.startsWith("assets/") && /^assets\/[a-z0-9-]+\.(css|js|mjs|jpg|png)$/.test(name);
      if (!publicPages.has(name) && !staffPages.has(name) && !asset) throw new HttpError(404, "Page not found.");
      let bytes;
      try { bytes = readFileSync(resolve(directory, "public", asset ? "assets" : "", basename(name))); }
      catch (error) { if (error.code === "ENOENT") throw new HttpError(404, "Page not found."); throw error; }
      response.writeHead(200, { "Content-Type": mime[extension], "Cache-Control": "no-store", "Content-Length": bytes.length });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof domain.DomainError ? 422 : 500;
      if (status >= 500) console.error(error.message);
      if (!response.headersSent) json(response, status, { error: status === 500 ? "The server could not complete this request." : error.message });
      else response.end();
    }
  };
}
