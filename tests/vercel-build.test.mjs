// Builds the Vercel output and checks that the packaged function can start on its own:
// every module it imports must be inside the function folder. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".vercel", "output");
const fn = join(output, "functions", "olive-api.func");

test("the build produces the static site and a self-contained function", async () => {
  execFileSync(process.execPath, [join(root, "scripts", "vercel-build.mjs")], { cwd: root });

  for (const page of ["index.html", "products.html", "order.html", "account.html"]) {
    assert.ok(existsSync(join(output, "static", page)), `static/${page} is missing`);
  }
  assert.ok(existsSync(join(output, "static", "assets", "site.css")));
  assert.ok(existsSync(join(output, "config.json")));
  assert.deepEqual(readdirSync(fn).sort(), [".vc-config.json", "entry.cjs", "public", "src"]);
  assert.ok(existsSync(join(fn, "public", "operations.html")), "staff pages must ship inside the function");

  // Load the function exactly as Vercel does and send it one request.
  process.env.OLIVE_ORIGIN = "https://example.test";
  const handler = createRequire(import.meta.url)(join(fn, "entry.cjs"));
  const result = { status: 0, body: "" };
  const response = {
    headersSent: false,
    setHeader() {},
    writeHead(status) { result.status = status; this.headersSent = true; },
    end(body) { result.body = body ? String(body) : ""; },
  };
  await handler({ method: "GET", url: "/api/customer", headers: { host: "example.test" } }, response);
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), { account: null, providers: [], orders: [] });
});
