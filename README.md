# OLIVE Distribution Platform

For the hosted setup, follow the [Vercel deployment guide](VERCEL.md).

The public OLIVE website and staff workspace run from the same Node.js service. Customers submit order requests and trade enquiries. Staff review requests, link customers, reserve batches, dispatch orders and record delivery outcomes. Customers can check their status with a tracking reference and postcode.

## Run the local demo

Install Node.js 24.14 or later. From this directory run:

```sh
npm run demo
```

Open [the homepage](http://127.0.0.1:8766/) or [the staff workspace](http://127.0.0.1:8766/operations.html). The local demo sign-in is `demo@olive.test` with password `olive-local-preview-2026`. It stores sample records in `data/demo.sqlite`. Try tracking `OL-1041` with postcode `SE1 9GF`.

## Architecture

- The public pages and protected staff pages share a same-origin JSON API. Public endpoints can submit requests and look up the status of a specific reference. The tracking response contains status and delivery dates.
- Staff use server-side sessions with HttpOnly cookies. Staff commands require a session and a CSRF token. Passwords are salted and hashed with scrypt. Login, intake and tracking have request limits.
- SQLite holds the workspace, staff accounts, sessions and audit metadata. The workspace is one versioned document for this small, single-depot deployment. Each staff command validates business rules on the server and commits the record change and audit entry in one transaction. A stale editor must reopen before writing.
- Stock reservations reduce availability. Dispatch consumes the reserved quantities and records the recipient and batch movement. Holds and best-before checks block dispatch. Delivery exceptions and retries preserve the original stock movement.
- Public submissions enter the requests inbox. Staff can create or link a customer, then use the request to open the order editor. The request reference continues to work after the order is created. The site records staff updates to delivery status. It has no carrier feed or payment integration.

## Run with your own data

Set `OLIVE_ADMIN_EMAIL` and `OLIVE_ADMIN_PASSWORD` in the environment before the first start. Use a password of at least 16 characters and keep it out of source control. Then run `npm start`. It listens on port 8080 by default and starts with an empty workspace and the OLIVE product catalogue. The account settings create an account when its email is new. An existing account’s password is preserved. Remove the provisioning password from the environment after creating the account.

Set `OLIVE_DATA` to a private, persistent SQLite path if the default `data/olive.sqlite` is unsuitable. Keep the demo and operational database separate.

To reset an existing staff password, set the account email and new password in the same environment variables and run `node server.mjs --reset-password` against the operational database. This revokes the account’s existing sessions.

For hosted access, set `OLIVE_ORIGIN` to the exact public HTTPS origin and optionally set `OLIVE_PORT` for the internal port. Run behind a TLS reverse proxy that preserves the public Host header and connects to the loopback listener. Use a single service instance and persistent storage. Configure backups and test restoration before accepting real records. Apply per-client limits at the reverse proxy because the application sees the proxy’s socket address. Review staff permissions, data retention and privacy copy before launch. All staff accounts currently have the same workspace access.

This package requires a Node.js host for the API and database. A static GitHub Pages deployment can serve the original static preview, while a GitHub repository can store this application’s source.
