# Enable OLIVE customer accounts

Use the existing Supabase project and Vercel deployment. The change adds customer sign-in and leaves guest ordering, guest tracking, and staff sign-in available.

1. Open **Supabase → SQL Editor** and run [customer-accounts.sql](customer-accounts.sql). This adds a customer-session table without replacing existing order records. On a brand-new database, run [supabase.sql](supabase.sql) first.
2. Under **Authentication → URL Configuration**, set **Site URL** to `https://www.olivemineralwater.co.uk` once Vercel verifies the domain. Add the exact redirect URL `https://www.olivemineralwater.co.uk/api/customer-callback`. Until the DNS switch, use `https://oliveminiralwater.vercel.app` and its matching callback. Vercel’s Production `OLIVE_ORIGIN` must match the Site URL you are using.
3. Set up the providers you want in **Supabase → Authentication → Sign In / Providers**.
   - **Google**. Create a Google OAuth **Web application**, add the Supabase provider callback shown in the dashboard as an authorized redirect URI, then enter its client ID and secret in Supabase. For public use, make the Google app available to external users and publish it after testing. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
   - **Microsoft**. Create a Microsoft Entra app registration with a **Web** redirect URI using the Supabase provider callback. Choose **Accounts in any organizational directory and personal Microsoft accounts** to support both Outlook.com and work accounts. Add the client ID and client secret **value** to Supabase’s **Azure (Microsoft)** provider. Use the common tenant and configure the `xms_edov` and email claims as shown in the provider guide. [Supabase Microsoft setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-azure)
4. Add `SUPABASE_PUBLISHABLE_KEY` in **Vercel → Settings → Environment Variables** for Production. Use the Supabase key that begins with `sb_publishable_`. Keep the existing `SUPABASE_SECRET_KEY` and other environment variables. The provider client secrets belong in Supabase.
   - **Apple** (optional). Sign in with Apple needs a paid Apple Developer account. Create an App ID and a Services ID with Sign in with Apple enabled, add the Supabase provider callback as the return URL, and generate the client secret from a signing key as the provider guide describes. Apple secrets expire after at most six months and must be renewed. [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple)
   - **Email**. Customers enter their email address and receive a one-time sign-in link, with no password. Supabase enables the Email provider by default. Keep **Confirm email** on and leave the **Magic Link** and **Confirm signup** email templates using `{{ .ConfirmationURL }}`. Supabase’s built-in email service only sends a few messages an hour and is meant for testing, so add your own SMTP provider under **Authentication → Emails → SMTP Settings** before customers use it. The link must be opened in the same browser that requested it and expires after an hour. [Supabase email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
5. Set `OLIVE_CUSTOMER_PROVIDERS` to the providers you have enabled in Supabase, separated by commas: `email`, `google`, `azure` and `apple`. The app defaults to `email,google,azure`, so Apple appears only when you add it, for example `email,google,azure,apple`. Commit and push the updated files, then redeploy so Vercel loads the settings.

The provider callback and the OLIVE callback are two different URLs. The Google and Microsoft apps redirect to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`. Supabase then redirects to the OLIVE callback from step 2.

## If the sign-in buttons are missing

My Account shows “Online account sign-in is unavailable right now” when the server has no usable sign-in settings. Open **Vercel → Project → Logs** and load the page. The function logs a line starting `Customer sign-in is off` that names the missing setting.

- **`SUPABASE_PUBLISHABLE_KEY` is missing or is the wrong key.** It must be the key that begins with `sb_publishable_`. The older `anon` key that begins with `eyJ` is not accepted.
- **The variable is not enabled for the environment you are testing.** A variable ticked only for Production is absent from Preview deployments.
- **The deployment is older than the variable.** Vercel reads environment variables at build time, so redeploy after every change.

Always test on the address in `OLIVE_ORIGIN`, such as `https://oliveminiralwater.vercel.app`. A per-deployment address such as `https://oliveminiralwater-abc123-team.vercel.app` sits behind Vercel Authentication, so customers cannot open it, and sign-in cannot finish there because Supabase returns customers to the `OLIVE_ORIGIN` address. If the API answers `Invalid host`, the address you opened does not match `OLIVE_ORIGIN`.

## Test after deployment

- Sign in with a Google account and an Outlook.com or Microsoft work account you control. The first sign-in creates the customer identity.
- Submit a test request while signed in and check **My Account**. Check the same reference under guest tracking.
- Place a test guest order with the same email and link it using its tracking reference and delivery postcode.
- Cancel a request and confirm it shows as cancelled. For a confirmed order awaiting dispatch, check that the stock reservation is released. Check that dispatched orders require staff help.
- Reorder from history, confirm the details are prefilled, and verify that a new request appears only after submitting.
