import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicPages, staffPages, apiNames } from "../src/server/http.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".vercel", "output");
const staticDir = join(output, "static");
const fn = join(output, "functions", "olive-api.func");
const put = (dir, name, content) => writeFileSync(join(dir, name), content);
const json = (dir, name, value) => put(dir, name, JSON.stringify(value, null, 2) + "\n");

// Start from an empty output folder so files from an earlier build cannot linger.
rmSync(output, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
mkdirSync(join(fn, "public", "assets"), { recursive: true });
cpSync(join(root, "public", "assets"), join(staticDir, "assets"), { recursive: true });
for (const page of publicPages) cpSync(join(root, "public", page), join(staticDir, page));
for (const page of staffPages) cpSync(join(root, "public", page), join(fn, "public", page));
// The function keeps the repository layout, so the modules' relative imports resolve unchanged.
mkdirSync(join(fn, "src", "server"), { recursive: true });
for (const file of ["src/vercel-handler.mjs", ...["hosted-storage", "http", "domain", "seed", "customer-auth", "customer-orders"].map((name) => `src/server/${name}.mjs`)]) {
  cpSync(join(root, file), join(fn, file));
}
cpSync(join(root, "public", "assets", "stock.mjs"), join(fn, "public", "assets", "stock.mjs"));
put(fn, "entry.cjs", 'const handler = import("./src/vercel-handler.mjs");\nmodule.exports = async (req, res) => (await handler).default(req, res);\n');
json(fn, ".vc-config.json", { runtime: "nodejs24.x", handler: "entry.cjs", launcherType: "Nodejs", maxDuration: 30, regions: ["lhr1"] });
const staffRoute = `/(${[...staffPages].map((name) => name.replace(".", "\\.")).join("|")})`;
json(output, "config.json", {
  version: 3,
  routes: [
    { src: "/.*", headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    }, continue: true },
    { src: "^/$", dest: "/index.html" },
    { src: `^/api/(${apiNames.join("|")})$`, dest: "/olive-api?__olive_route=/api/$1" },
    { src: `^${staffRoute}$`, dest: "/olive-api?__olive_route=/$1" },
    { handle: "filesystem" },
  ],
});
console.log("Built Vercel static pages and serverless function.");
