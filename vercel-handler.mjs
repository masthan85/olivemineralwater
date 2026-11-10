import { createHandler, staffPages, apiNames } from "./http.mjs";
import { hostedStorage } from "./hosted-storage.mjs";
import { customerAccounts } from "./customer-auth.mjs";

const apiPaths = new Set(apiNames.map((name) => "/api/" + name));
function route(request) {
  const url = new URL(request.url, "https://olive.invalid");
  const supported = (path) => typeof path === "string" && (apiPaths.has(path) || (path.startsWith("/") && staffPages.has(path.slice(1))));
  if (supported(url.pathname)) return url.pathname;
  const rewritten = url.searchParams.get("__olive_route");
  return supported(rewritten) ? rewritten : "/missing";
}

export function createVercelHandler(env = process.env, makeStorage = hostedStorage, fetcher = fetch) {
  let handler;
  return async (request, response) => {
    try {
      if (!handler) {
        const value = env.OLIVE_ORIGIN || (env.VERCEL_URL ? "https://" + env.VERCEL_URL : "");
        const origin = new URL(value);
        if (origin.protocol !== "https:" || origin.origin !== value.replace(/\/$/, "")) {
          throw new Error("Set OLIVE_ORIGIN to the public HTTPS URL of this deployment.");
        }
        let store;
        const getStore = () => (store ??= makeStorage(env));
        const storage = {};
        for (const method of ["read", "staff", "session", "write", "createSession", "deleteSession", "limit"]) {
          storage[method] = (...args) => {
            return getStore()[method](...args);
          };
        }
        const customers = customerAccounts({ origin, env, getStore, fetcher });
        handler = createHandler({ origin, storage, limit: storage.limit, route, customers });
      }
      return await handler(request, response);
    } catch {
      response.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "The server is not configured. Check OLIVE_ORIGIN in Vercel." }));
    }
  };
}

export default createVercelHandler();
