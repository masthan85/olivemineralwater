// Drives the customer sign-in flow end to end against a simulated Supabase Auth
// server and in-memory storage. No network, no real accounts. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createVercelHandler } from "../src/vercel-handler.mjs";


const SUPA = "https://example-project.supabase.co";
function makeWorld(envExtra) {
  const sessions = new Map();
  const state = { requests: [], orders: [], lots: [], customers: [] };
  const users = new Map(); // supabase auth.users, keyed by email
  const codes = new Map();
  const inbox = [];
  const storage = () => ({
    read: async () => ({ state, revision: 1 }),
    session: async () => null, staff: async () => null, limit: async () => {},
    customerSession: async (hash, now) => { const s = sessions.get(hash); return s && s.expires > now ? s : null; },
    deleteCustomerSession: async (hash) => { sessions.delete(hash); },
    createCustomerSession: async (row) => { sessions.set(row.token_hash, row); },
  });
  // Simulated Supabase: authorize issues a code bound to the PKCE challenge; token checks the verifier.
  const supabaseAuthorize = (url, email) => {
    const code = "code-" + codes.size;
    codes.set(code, { challenge: url.searchParams.get("code_challenge"), email });
    return code;
  };
  const fetcher = async (url, options) => {
    url = new URL(url);
    assert.equal(url.origin, SUPA);
    assert.equal(options.headers.apikey, "sb_publishable_test");
    if (url.pathname === "/auth/v1/token") {
      const { auth_code, code_verifier } = JSON.parse(options.body);
      const entry = codes.get(auth_code);
      codes.delete(auth_code);
      const ok = entry && createHash("sha256").update(code_verifier).digest("base64url") === entry.challenge;
      if (!ok) return { ok: false, json: async () => ({}) };
      if (!users.has(entry.email)) users.set(entry.email, { id: crypto.randomUUID(), email: entry.email, email_confirmed_at: "2026-11-10T00:00:00Z" });
      return { ok: true, json: async () => ({ access_token: "token:" + entry.email }) };
    }
    if (url.pathname === "/auth/v1/otp") {
      const body = JSON.parse(options.body);
      assert.equal(url.searchParams.get("redirect_to"), "https://olivemineralwater.vercel.app/api/customer-callback");
      assert.equal(body.create_user, true);
      if (body.email === "bounce@example.com") return { ok: false, json: async () => ({}) };
      const code = "mail-" + codes.size;
      codes.set(code, { challenge: body.code_challenge, email: body.email });
      inbox.push({ to: body.email, code });
      return { ok: true, json: async () => ({}) };
    }
    if (url.pathname === "/auth/v1/user") {
      return { ok: true, json: async () => users.get(options.headers.Authorization.slice("Bearer token:".length)) };
    }
    throw new Error("unexpected " + url);
  };
  const env = { SUPABASE_URL: SUPA, ...envExtra };
  const handler = createVercelHandler(env, storage, fetcher);
  const call = async (path, { cookies = {}, host, post } = {}) => {
    const headers = { host, ...(post ? { origin: "https://" + host, "content-type": "application/json" } : {}), cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    const out = { headers: {}, status: 0, body: "" };
    const response = {
      headersSent: false,
      setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
      writeHead: (status, h = {}) => { out.status = status; for (const [k, v] of Object.entries(h)) out.headers[k.toLowerCase()] = v; response.headersSent = true; },
      end: (b) => { out.body = b ? String(b) : ""; },
    };
    const request = { method: post ? "POST" : "GET", url: path, headers, async *[Symbol.asyncIterator]() { if (post) yield Buffer.from(JSON.stringify(post)); } };
    await handler(request, response);
    for (const line of [].concat(out.headers["set-cookie"] || [])) {
      const [pair] = line.split(";"); const [k, v] = pair.split("=");
      if (/Max-Age=0/.test(line)) delete cookies[k]; else cookies[k] = v;
    }
    return out;
  };
  return { call, users, sessions, state, supabaseAuthorize, inbox };
}

const check = (name, fn) => test(name, fn);

const PROD = "olivemineralwater.vercel.app";
const fullBase = { OLIVE_ORIGIN: "https://" + PROD, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };

async function signIn(world, provider, email, cookies) {
  const start = await world.call("/api/customer-" + provider, { cookies, host: PROD });
  assert.equal(start.status, 303);
  const url = new URL(start.headers.location);
  assert.equal(url.origin + url.pathname, SUPA + "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), provider);
  assert.equal(url.searchParams.get("redirect_to"), `https://${PROD}/api/customer-callback`);
  const code = world.supabaseAuthorize(url, email);
  return world.call("/api/customer-callback?code=" + code, { cookies, host: PROD });
}

for (const [provider, email] of [["google", "customer@gmail.com"], ["azure", "customer@outlook.com"], ["apple", "customer@icloud.com"]]) {
  const full = { ...fullBase, OLIVE_CUSTOMER_PROVIDERS: "google,azure,apple" };
  await check(`${provider}: buttons offered, first sign-in creates the account, lands on order history`, async () => {
    const world = makeWorld(full);
    const cookies = {};
    const before = JSON.parse((await world.call("/api/customer", { cookies, host: PROD })).body);
    assert.deepEqual(before.providers, ["google", "azure", "apple"]);
    assert.equal(before.account, null);
    assert.equal(world.users.size, 0);
    const done = await signIn(world, provider, email, cookies);
    assert.equal(done.status, 303);
    assert.equal(done.headers.location, "/account.html");
    assert.equal(world.users.size, 1);
    const after = JSON.parse((await world.call("/api/customer", { cookies, host: PROD })).body);
    assert.equal(after.account.email, email);
    assert.ok(Array.isArray(after.orders));
  });
  await check(`${provider}: returning customer sees the orders linked to their account`, async () => {
    const world = makeWorld(full);
    await signIn(world, provider, email, {});
    const id = world.users.get(email).id;
    world.state.requests.push({ reference: "A".repeat(32), kind: "order", created: "2026-11-01", status: "Received", accountId: id, bottle: "Classic Olive (750ml)", quantity: 6, name: "Test", address: "1 Test St", postcode: "SE1 9GF", notes: "" });
    const cookies = {}; // new browser session
    const done = await signIn(world, provider, email, cookies);
    assert.equal(done.headers.location, "/account.html");
    assert.equal(world.users.size, 1, "no duplicate account");
    const data = JSON.parse((await world.call("/api/customer", { cookies, host: PROD })).body);
    assert.equal(data.orders.length, 1);
    assert.equal(data.orders[0].reference, "A".repeat(32));
  });
}

await check("callback with a tampered PKCE verifier is rejected", async () => {
  const world = makeWorld(fullBase);
  const cookies = {};
  const start = await world.call("/api/customer-google", { cookies, host: PROD });
  const code = world.supabaseAuthorize(new URL(start.headers.location), "x@gmail.com");
  cookies["__Host-olive_customer_pkce"] = "0".repeat(64);
  const done = await world.call("/api/customer-callback?code=" + code, { cookies, host: PROD });
  assert.equal(done.headers.location, "/account.html?signin=failed");
  assert.equal(world.sessions.size, 0);
});

await check("missing SUPABASE_PUBLISHABLE_KEY: no buttons (the state in the screenshot)", async () => {
  const world = makeWorld({ OLIVE_ORIGIN: "https://" + PROD });
  const data = JSON.parse((await world.call("/api/customer", { host: PROD })).body);
  assert.deepEqual(data.providers, []);
});

await check("legacy anon key (eyJ…) in SUPABASE_PUBLISHABLE_KEY: no buttons", async () => {
  const world = makeWorld({ OLIVE_ORIGIN: "https://" + PROD, SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOi.test" });
  assert.deepEqual(JSON.parse((await world.call("/api/customer", { host: PROD })).body).providers, []);
});

await check("no OLIVE_ORIGIN, old behaviour reproduced: only the per-deployment URL answers", async () => {
  // VERCEL_ENV unset here mimics the code before this change, which always used VERCEL_URL.
  const world = makeWorld({ VERCEL_URL: "olive-abc123-team.vercel.app", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" });
  assert.equal((await world.call("/api/customer", { host: PROD })).status, 400);
  assert.equal((await world.call("/api/customer", { host: "olive-abc123-team.vercel.app" })).status, 200);
});

await check("no OLIVE_ORIGIN in production: now answers on the project's production domain", async () => {
  const world = makeWorld({ VERCEL_ENV: "production", VERCEL_URL: "olive-abc123-team.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: PROD, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" });
  assert.equal((await world.call("/api/customer", { host: PROD })).status, 200);
});

await check("OLIVE_CUSTOMER_PROVIDERS=google shows Google only", async () => {
  const world = makeWorld({ ...fullBase, OLIVE_CUSTOMER_PROVIDERS: "google" });
  assert.deepEqual(JSON.parse((await world.call("/api/customer", { host: PROD })).body).providers, ["google"]);
  assert.equal((await world.call("/api/customer-azure", { host: PROD })).headers.location, "/account.html?signin=unavailable");
});


await check("default providers leave Apple off", async () => {
  const world = makeWorld(fullBase);
  assert.deepEqual(JSON.parse((await world.call("/api/customer", { host: PROD })).body).providers, ["email", "google", "azure"]);
  assert.equal((await world.call("/api/customer-apple", { host: PROD })).headers.location, "/account.html?signin=unavailable");
});

await check("email: link request, first sign-in creates the account, lands on order history", async () => {
  const world = makeWorld(fullBase);
  const cookies = {};
  const sent = await world.call("/api/customer-email", { cookies, host: PROD, post: { email: " New.Customer@Example.com " } });
  assert.equal(sent.status, 200);
  assert.equal(world.inbox.length, 1);
  assert.equal(world.inbox[0].to, "new.customer@example.com");
  assert.equal(world.users.size, 0);
  const done = await world.call("/api/customer-callback?code=" + world.inbox[0].code, { cookies, host: PROD });
  assert.equal(done.headers.location, "/account.html");
  assert.equal(world.users.size, 1);
  const data = JSON.parse((await world.call("/api/customer", { cookies, host: PROD })).body);
  assert.equal(data.account.email, "new.customer@example.com");
});
await check("email: returning customer gets the same account", async () => {
  const world = makeWorld(fullBase);
  for (let round = 0; round < 2; round++) {
    const cookies = {};
    await world.call("/api/customer-email", { cookies, host: PROD, post: { email: "back@example.com" } });
    const done = await world.call("/api/customer-callback?code=" + world.inbox.at(-1).code, { cookies, host: PROD });
    assert.equal(done.headers.location, "/account.html");
  }
  assert.equal(world.users.size, 1);
});
await check("email: link opened in a different browser is refused", async () => {
  const world = makeWorld(fullBase);
  await world.call("/api/customer-email", { cookies: {}, host: PROD, post: { email: "x@example.com" } });
  const done = await world.call("/api/customer-callback?code=" + world.inbox[0].code, { cookies: {}, host: PROD });
  assert.equal(done.headers.location, "/account.html?signin=failed");
});
await check("email: invalid address, send failure and cross-site request are rejected", async () => {
  const world = makeWorld(fullBase);
  assert.equal((await world.call("/api/customer-email", { host: PROD, post: { email: "not-an-email" } })).status, 422);
  assert.equal((await world.call("/api/customer-email", { host: PROD, post: { email: "bounce@example.com" } })).status, 503);
  const off = makeWorld({ ...fullBase, OLIVE_CUSTOMER_PROVIDERS: "google" });
  assert.equal((await off.call("/api/customer-email", { host: PROD, post: { email: "a@example.com" } })).status, 404);
  assert.equal(world.inbox.length, 0);
});
