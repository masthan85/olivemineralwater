# OLIVE Pure Mineral Water

The website for OLIVE Pure Mineral Water runs on WordPress.com at [olivemineralwater.co.uk](https://olivemineralwater.co.uk). This repository holds the **OLIVE Site** WordPress plugin, which adds the site's layout fixes and redirects.

The pages, menus, images and forms are edited in WordPress itself, not here.

## Repository layout

| Path | What it holds |
|---|---|
| `olive-site.php` | The plugin: loads the stylesheets and redirects old and duplicate addresses. |
| `assets/css/site-fixes.css` | Logo and photo sizing fixes, loaded on every page. |
| `assets/css/about.css` | The About page's "From rain to bottle" section, loaded only on that page. |
| `assets/css/shop.css` | Phone-first styles for the WooCommerce shop pages, loaded only while WooCommerce is active. |
| `assets/pwa/` | The app: manifest, icons, service worker, offline page and the Google Play verification file. See [docs/APP.md](docs/APP.md). |
| `docs/WORDPRESS.md` | How the WordPress site is set up, and what is still open. |
| `docs/superpowers/` | The design and build plan for the online shop. |
| `.github/workflows/` | Checks run on every push: PHP syntax and the Fortify scan. |

## Install or update the plugin

**From GitHub (recommended).** In WordPress.com, open the site's **Settings → Repositories** (GitHub Deployments) and connect this repository:

- Branch: `main`
- Destination directory: `/wp-content/plugins/olive-site`
- Automatic deployments: on

Every push to `main` then copies the plugin to the site. Activate **OLIVE Site** once under **Plugins**.

**By hand.** Zip a folder named `olive-site` that contains `olive-site.php` and `assets/`, then upload it under **Plugins → Add New → Upload Plugin**.

## Redirects

The plugin sends these addresses to the right page with a permanent (301) redirect:

| Old address | Goes to |
|---|---|
| `/order-query-1/` to `/order-query-4/` | `/order/` |
| `/account-query-1/` | `/account/` |
| `/index.html`, `/products.html`, `/order.html`, `/trade-enquiry.html`, `/about.html`, `/delivery.html`, `/track.html`, `/account.html` | the matching page |
| `/login.html`, `/operations.html`, `/ops-*.html` | `/login/` |

The `.html` addresses are from the previous version of the site. The `-query-` pages were duplicates created when that site was imported into WordPress.

## The previous Node.js app

The site used to be a Node.js app on Vercel with a Supabase database, covering a staff workspace, order tracking and customer sign-in. It was retired when the site moved to WordPress. The last version is kept under the git tag `vercel-app-final`:

```sh
git checkout vercel-app-final
```
