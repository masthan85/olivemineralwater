# Deploy OLIVE on Vercel

The public website is served as static files. Vercel runs the staff pages and API as a Node.js function. Supabase stores orders, customer requests, stock, staff sessions and audit records. Local development still uses SQLite.

## Set up the database

1. Create a Supabase project for OLIVE.
2. Open **SQL Editor → New query**. Paste the full contents of [supabase.sql](../database/supabase.sql) and run it.
3. Copy your **Project URL** and a **Secret key** from the Supabase project. The key begins with `sb_secret_`. Keep it in Vercel’s server environment variables.

## Update GitHub and Vercel

1. Extract the replacement ZIP and copy its contents into the existing repository folder. Keep the folder layout as it is: `vercel.json` and `package.json` stay at the configured root, with `scripts/`, `src/` and `public/` beside them. Commit and push to the connected branch.
2. In **Vercel → Project → Settings → Build and Deployment**, use **Other** as the framework and turn off any previous Build Command and Output Directory overrides. The included configuration runs `npm run build`. Use Node.js 24 for the build if you need to select a version. If the files are in a subfolder, select that folder as the Root Directory.
3. In **Settings → Environment Variables**, add these values for **Production**.

   - `SUPABASE_URL` is your Supabase project URL, such as `https://YOUR-PROJECT.supabase.co`.
   - `SUPABASE_SECRET_KEY` is the server key you copied.
   - `OLIVE_ORIGIN` is the exact public site URL, such as `https://your-project.vercel.app`. Use the domain you actually open in your browser, with no page path.
   - `OLIVE_ADMIN_EMAIL` is the first staff account email.
   - `OLIVE_ADMIN_PASSWORD` is a new password between 16 and 256 characters.

4. Redeploy from the latest commit so Vercel loads the new environment variables. Open your public URL and then `/operations.html`. The first successful sign-in sets up the staff account. After confirming sign-in, you can remove `OLIVE_ADMIN_PASSWORD` from Vercel and redeploy. The account is saved in Supabase.
5. Submit a test order request and check it appears in **Requests inbox**. Check the same reference in **Track Order**. Use test data for this check.

The hosted workspace starts empty apart from the product catalogue. This setup creates a fresh database. If you have real records in an existing SQLite database, migrate them before switching over.

To add customer order history and social sign-in to an existing deployment, follow the [customer accounts guide](CUSTOMER-ACCOUNTS.md).

## Connect the OLIVE domain

In **Vercel → Settings → Domains**, copy the project-specific A record for `olivemineralwater.co.uk` and CNAME for `www.olivemineralwater.co.uk`. In GoDaddy DNS, update the existing `@` A record and `www` CNAME to match. Keep the root-to-www redirect in Vercel and preserve your email DNS records.

When both domains show **Valid Configuration**, set Production `OLIVE_ORIGIN` to `https://www.olivemineralwater.co.uk` and redeploy. If customer sign-in is enabled, update the Supabase Site URL and callback as described in the customer accounts guide.

Use a separate Supabase project and environment variables for any shared preview where you want to exercise the API. Vercel restricts the Hobby plan to personal, non-commercial use. Use an eligible plan for the live OLIVE business.
