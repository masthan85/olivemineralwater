import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seed } from "./server/seed.mjs";
import { createHandler, derive, HttpError } from "./server/http.mjs";

const demo = process.argv.includes("--demo");
const port = Number(process.env.OLIVE_PORT || (demo ? 8766 : 8080));
const origin = new URL(process.env.OLIVE_ORIGIN || `http://127.0.0.1:${port}`);
const secure = origin.protocol === "https:";
const loopback = ["127.0.0.1", "localhost"].includes(origin.hostname);
if ((demo && (secure || !loopback)) || (!secure && !loopback) || !["https:", "http:"].includes(origin.protocol)) {
  throw new Error("Use an HTTPS origin for hosted access and a loopback HTTP origin for the demo.");
}
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

const rate = new Map();
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

const storage = {
  read() {
    const row = read.get();
    return { revision: row.revision, state: JSON.parse(row.state) };
  },
  staff: (email) => staffLookup.get(email),
  session: (hash, now) => db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires > ?").get(hash, now),
  deleteSession: (hash) => db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash),
  createSession(row, previous) {
    transaction(() => {
      if (previous) storage.deleteSession(previous);
      db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?)").run(row.token_hash, row.email, row.csrf, row.expires);
    });
  },
  write,
};
const server = createServer(createHandler({ origin, demo, storage, limit }));
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, "127.0.0.1", () => console.log(`OLIVE ${mode} workspace at ${origin.origin}`));
