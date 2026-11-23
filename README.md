# OLIVE Pure Mineral Water

The website for OLIVE Pure Mineral Water runs on WordPress.com at [olivemineralwater.co.uk](https://olivemineralwater.co.uk). This repository holds the **OLIVE Site** WordPress plugin: the site's layout fixes, customer account settings, redirects, link previews and the installable app. It also holds the Playwright tests for the live site.

The pages, menus, images, forms and products are edited in WordPress itself, not here. [docs/WORDPRESS.md](docs/WORDPRESS.md) describes the site, what the plugin does, and what is still to do.

## Repository layout

| Path | What it holds |
|---|---|
| `olive-site.php` | The plugin: loads the stylesheets, turns on customer account creation, redirects old and duplicate addresses, serves the app files and adds link-preview tags. |
| `assets/css/site-fixes.css` | Every page: logo and photo sizing, the solid sticky header, the wider layout on large screens, and the bottle cards' layout. |
| `assets/css/about.css` | The About page's "From rain to bottle" section. |
| `assets/css/shop.css` | Phone-first styles for the WooCommerce shop pages, loaded only while WooCommerce is active. |
| `assets/css/account.css` | The My Account (sign in / create an account) and Staff sign-in pages. |
| `assets/pwa/` | The app: manifest, icons, service worker, offline page and the Google Play verification file. See [docs/APP.md](docs/APP.md). |
| `docs/WORDPRESS.md` | How the WordPress site is set up, the product range, and what is still open. |
| `docs/photo-edits/` | The script that edits the bottle photos, and which edited photo is used where. |
| `docs/superpowers/` | The original shop design and build plan (16 Nov 2026). Historical; see the note at the top of each. |
| `tests/e2e/`, `playwright.config.js`, `package.json` | Playwright tests for the live site. Not part of the plugin. |
| `.github/workflows/` | Checks run on every push: PHP syntax, the Fortify scan, and the Playwright tests. |

## Install or update the plugin

**From GitHub (how the live site is set up).** The live site's GitHub Deployment (ID 9647) is already connected with these settings, so every push to `main` updates the plugin within a few minutes. To set it up again, open the site's **Settings → Repositories** (GitHub Deployments) and connect this repository:

- Branch: `main`
- Destination directory: `/wp-content/plugins/olive-site`
- Automatic deployments: on

Then activate **OLIVE Site** once under **Plugins**. Bump the version in both the plugin header and `OLIVE_SITE_VERSION` with each change, so browsers load the new stylesheets.

WordPress.com caches pages for about 5 minutes, so a change can take that long to show.

**By hand.** Zip a folder named `olive-site` that contains `olive-site.php` and `assets/`, then upload it under **Plugins → Add New → Upload Plugin**.

## Redirects

The plugin sends these addresses to the right page with a permanent (301) redirect:

| Old address | Goes to |
|---|---|
| `/order-query-1/` to `/order-query-4/` | `/order/` |
| `/account/`, `/account-query-1/`, `/account.html` | `/my-account/` |
| `/index.html`, `/products.html`, `/order.html`, `/trade-enquiry.html`, `/about.html`, `/delivery.html`, `/track.html` | the matching page |
| `/login.html`, `/operations.html`, `/ops-*.html` | `/login/` |

The `.html` addresses are from the previous version of the site. The `-query-` pages were duplicates created when that site was imported into WordPress. Some `.html` addresses are caught first by the Redirection plugin's imported rules, which go through the old staging address `clear-raspberry-kiwi.wpcomstaging.com` and end up at the same page.

## Testing the site with Playwright

The tests in `tests/e2e/` open the live site in Chromium at desktop (1440px) and phone (390px) sizes and check:

- every page loads with its heading, fits the screen, shows the logo, has no broken images and has link-preview tags
- the header stays green and in front of the page while scrolling, and the menus work
- the Order, Trade Enquiry, Track, My Account and Staff sign-in forms are complete (the tests never submit a form, so they send no emails)
- the redirects, the app manifest, the service worker, the offline page and `assetlinks.json`
- the product range: pages offer only 330ml and 750ml, show only the new bottle photos, and every bottle card shows "330ml / 750ml" with the request links lined up

Page wording is edited in WordPress by the client, so apart from the product range the tests check headings loosely and do not check the text. If the range changes, update `tests/e2e/range.spec.js`.

Run them on your computer (needs Node.js):

```sh
npm install
npx playwright install chromium
npm test                 # all tests
npm run test:report      # open the last report
BASE_URL=https://staging-example.wpcomstaging.com npm test   # test another copy
```

On GitHub they run 4 minutes after every push to `main` (once the plugin has deployed), every morning at 06:00 UTC, and on demand from **Actions → Test the live site → Run workflow**. Each run keeps an HTML report as a download for 14 days.

These files are also copied to the plugin folder on the site when `main` deploys. WordPress ignores them.

## Backups

- **Code:** the branch and tag `backup-2026-11-21` on GitHub hold the plugin exactly as it was live on 21 November 2026. They are never changed. To look at it or restore it: `git checkout backup-2026-11-21`.
- **Website:** pages, products, orders, form entries, images and settings live in WordPress, not in this repository. WordPress.com backs up the whole site every day (Jetpack Backup, under **Jetpack → Backup** in the site dashboard), and any day can be restored from there.

Keep the plugin files (`olive-site.php`, `assets/`) at the top of `main`: every push to `main` copies the top level of the repository into the live plugin folder.

## The previous Node.js app

The site used to be a Node.js app on Vercel with a Supabase database, covering a staff workspace, order tracking and customer sign-in. It was retired when the site moved to WordPress. The last version is kept under the git tag `vercel-app-final`:

```sh
git checkout vercel-app-final
```
