import { createServer } from "node:http";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import * as domain from "./domain.mjs";
import { seed } from "./seed.mjs";
import { cleanPostcode } from "./public/assets/stock.mjs";

const hashPassword = promisify(scrypt);
const derive = (password, salt) => hashPassword(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
const directory = dirname(fileURLToPath(import.meta.url));
const demo = process.argv.includes("--demo");
const port = Number(process.env.OLIVE_PORT || (demo ? 8766 : 8080));
const origin = new URL(process.env.OLIVE_ORIGIN || `http://127.0.0.1:${port}`);
const secure = origin.protocol === "https:";
const loopback = ["127.0.0.1", "localhost"].includes(origin.hostname);
if ((demo && (secure || !loopback)) || (!secure && !loopback) || !["https:", "http:"].includes(origin.protocol)) {
  throw new Error("Use an HTTPS origin for hosted access and a loopback HTTP origin for the demo.");
}
const cookieName = secure ? "__Host-olive_staff" : "olive_staff";
const databasePath = resolve(process.env.OLIVE_DATA || (demo ? "data/demo.sqlite" : "data/olive.sqlite"));
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath, { timeout: 5000 });
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), mode TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS staff (email TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES staff(email), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (revision INTEGER PRIMARY KEY, created TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL);
`);
const transaction = (work) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};
const read = db.prepare("SELECT mode, revision, state FROM workspace WHERE id = 1");
const save = db.prepare("UPDATE workspace SET revision = ?, state = ? WHERE id = 1");
const audit = db.prepare("INSERT INTO audit VALUES (?, ?, ?, ?, ?)");
const mode = demo ? "demo" : "live";
transaction(() => {
  const existing = read.get();
  if (existing && existing.mode !== mode) throw new Error("The database belongs to a different run mode.");
  if (existing) return;
  const initial = seed();
  if (!demo) {
    for (const name of ["customers", "assets", "lots", "orders", "events", "movements"]) initial[name] = [];
    initial.nextOrder = 1001;
  }
  initial.requests = [];
  db.prepare("INSERT INTO workspace VALUES (1, ?, 0, ?)").run(mode, JSON.stringify(initial));
});

const staffLookup = db.prepare("SELECT * FROM staff WHERE email = ?");
const provisionEmail = String(demo ? "demo@olive.test" : process.env.OLIVE_ADMIN_EMAIL || "").toLowerCase();
const provisionPassword = demo ? "olive-local-preview-2026" : process.env.OLIVE_ADMIN_PASSWORD;
const reset = process.argv.includes("--reset-password");
if (reset && (demo || !provisionEmail || !provisionPassword || !staffLookup.get(provisionEmail))) {
  throw new Error("To reset a password, specify an existing staff email and the new password in the environment.");
}
if (provisionEmail && provisionPassword) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provisionEmail) || provisionPassword.length < 16 || provisionPassword.length > 256) {
    throw new Error("Provide a valid staff email and a password of 16 to 256 characters.");
  }
  if (reset || !staffLookup.get(provisionEmail)) {
    const salt = randomBytes(24).toString("hex");
    const hash = await derive(provisionPassword, salt);
    if (reset) {
      transaction(() => {
        db.prepare("UPDATE staff SET salt = ?, password_hash = ? WHERE email = ?").run(salt, hash.toString("hex"), provisionEmail);
        db.prepare("DELETE FROM sessions WHERE email = ?").run(provisionEmail);
      });
      console.log("Password reset and existing sessions revoked.");
      db.close();
      process.exit(0);
    }
    db.prepare("INSERT OR IGNORE INTO staff VALUES (?, ?, ?)").run(provisionEmail, salt, hash.toString("hex"));
  }
}
if (!db.prepare("SELECT 1 FROM staff LIMIT 1").get()) throw new Error("Set OLIVE_ADMIN_EMAIL and OLIVE_ADMIN_PASSWORD to create the first staff account.");

class HttpError extends Error {
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

const digest = (value) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("hex");
const getToken = (request) => request.headers.cookie?.split(/;\s*/).find((pair) => pair.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
const session = (request) => {
  const value = getToken(request);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires > ?").get(digest(value), Date.now());
};
const cookie = (value, maxAge) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
const rate = new Map();
let passwordChecks = 0;
function limit(request, scope, count, windowMs) {
  const now = Date.now();
  const key = scope + ":" + request.socket.remoteAddress;
  if (rate.size >= 4000 && !rate.has(key)) {
    for (const [storedKey, entry] of rate) if (entry.until <= now) rate.delete(storedKey);
    if (rate.size >= 4000) throw new HttpError(429, "Too many requests. Try again later.");
  }
  const entry = rate.get(key);
  if (!entry || entry.until <= now) {
    rate.set(key, { count: 1, until: now + windowMs });
  } else if (++entry.count > count) {
    throw new HttpError(429, "Too many requests. Try again later.");
  }
}
const json = (response, status, value) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
};

async function body(request) {
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

function write(actor, action, target, revision, apply) {
  return transaction(() => {
    const current = read.get();
    if (revision != null && current.revision !== revision) {
      throw new HttpError(409, "Another update was saved. Close this form, then reopen it to review the latest records.");
    }
    const state = JSON.parse(current.state);
    const result = apply(state);
    const next = current.revision + 1;
    save.run(next, JSON.stringify(state));
    audit.run(next, new Date().toISOString(), actor, action, target);
    return { state, revision: next, result };
  });
}

async function handleApi(request, response, path, account) {
  if (request.method === "GET" && path === "/api/config") return json(response, 200, { demo });
  if (request.method === "GET" && path === "/api/workspace") {
    if (!account) throw new HttpError(401, "Sign in to view the workspace.");
    const current = read.get();
    return json(response, 200, { state: JSON.parse(current.state), revision: current.revision, csrf: account.csrf, staff: account.email, demo });
  }
  if (request.method !== "POST") throw new HttpError(404, "Page not found.");
  const data = await body(request);
  if (path === "/api/login") {
    limit(request, "login", 12, 600000);
    if (typeof data.email !== "string" || typeof data.password !== "string" || data.email.length > 120 || data.password.length > 256) {
      throw new HttpError(400, "Invalid sign-in details.");
    }
    if (passwordChecks >= 4) throw new HttpError(429, "Sign-in is busy. Try again shortly.");
    const user = staffLookup.get(data.email.trim().toLowerCase());
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
    transaction(() => {
      if (account) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(account.token_hash);
      db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(digest(secret), user.email, token(), Date.now() + 8 * 3600000);
    });
    response.setHeader("Set-Cookie", cookie(secret, 28800));
    return json(response, 200, { ok: true });
  }
  if (path === "/api/tracking") {
    limit(request, "tracking", 45, 60000);
    const reference = typeof data.reference === "string" ? data.reference.trim().toUpperCase() : "";
    const postcode = typeof data.postcode === "string" && data.postcode.length < 20 ? cleanPostcode(data.postcode) : "";
    if (!postcode || !(/^[A-F0-9]{32}$/.test(reference) || (demo && /^OL-\d{4}$/.test(reference)))) {
      throw new HttpError(404, "Order or request not found.");
    }
    const state = JSON.parse(read.get().state);
    const intake = state.requests.find((item) => item.reference === reference && cleanPostcode(item.postcode) === postcode);
    const order = intake ? state.orders.find((item) => item.id === intake.orderId)
      : state.orders.find((item) => (item.tracking === reference || (demo && item.id === reference)) && cleanPostcode(item.recipient.postcode) === postcode);
    if (!order && !intake) throw new HttpError(404, "Order or request not found.");
    return json(response, 200, order ? { status: order.status, scheduled: order.expected, delivered: order.delivered } : { status: intake.status });
  }
  if (path === "/api/requests") {
    limit(request, "intake", 20, 600000);
    const result = write("public", "submit-request", "", null, (state) => domain.intake(state, fields(data.fields)));
    return json(response, 201, { reference: result.result.reference });
  }
  account = session(request);
  if (!account) throw new HttpError(401, "Sign in to continue.");
  if (request.headers["x-olive-csrf"] !== account.csrf) throw new HttpError(403, "Reload the workspace and try again.");
  if (path === "/api/logout") {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(account.token_hash);
    response.setHeader("Set-Cookie", cookie("", 0));
    return json(response, 200, { ok: true });
  }
  if (path === "/api/commands") {
    const command = actions.get(data.command);
    if (!command || typeof data.id !== "string" || data.id.length > 64 || !Number.isSafeInteger(data.revision) || data.revision < 0) {
      throw new HttpError(400, "Unknown or invalid command.");
    }
    const form = fields(data.fields);
    const result = write(account.email, data.command, data.id, data.revision, (state) => command(state, form, data.id));
    return json(response, 200, { state: result.state, revision: result.revision, message: result.result });
  }
  throw new HttpError(404, "Page not found.");
}

const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png" };
const publicPages = new Set(["index.html", "about.html", "delivery.html", "products.html", "track.html", "order.html", "trade-enquiry.html", "login.html"]);
const staffPages = new Set(["operations.html", ...["assets", "customers", "deliveries", "orders", "reports", "requests", "traceability", "warehouse"].map((name) => `ops-${name}.html`)]);
const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (secure) response.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    if (request.headers.host !== origin.host) throw new HttpError(400, "Invalid host.");
    const path = new URL(request.url, origin).pathname;
    const account = session(request);
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
    if (status === 500) console.error(error);
    if (!response.headersSent) json(response, status, { error: status === 500 ? "The server could not complete this request." : error.message });
    else response.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, "127.0.0.1", () => console.log(`OLIVE ${mode} workspace at ${origin.origin}`));
