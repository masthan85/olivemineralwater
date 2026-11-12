# OLIVE on WordPress.com

The public pages are being moved to WordPress.com, where the shop will run on WooCommerce. This file explains the two things in this repository that belong to that move. Paths are relative to the repository root.

## `wordpress-site/`

A static copy of the public pages, prepared for WordPress.com's site import: Home, Products, Shop, Trade Enquiry, About, and Delivery & Help, with the stylesheet, script, logo and photos. It was imported to build the WordPress.com preview site.

It differs from `public/` in these ways:

- The menus drop Track Order, My Account and Staff sign-in, which belong to the custom Node.js system. WooCommerce provides its own account and order pages.
- **Shop** is a holding page with an “Email your order” button. WooCommerce replaces it once the site is on a paid plan.
- The Trade Enquiry form has no script behind it. WordPress.com converts it to its own contact form on import.
- A few extra CSS rules at the end of `assets/site.css` size the logo and photos, because the import wraps each image in a `figure`.

Do not edit `wordpress-site/` by hand. It is generated, and the next build replaces it.

## `scripts/build-wordpress-site.py`

Regenerates `wordpress-site/` from `public/`. It needs Python 3 and nothing else.

```sh
python scripts/build-wordpress-site.py public wordpress-site
```

After a rebuild, zip the contents of `wordpress-site/` with `index.html` at the top level and import the ZIP into the same WordPress.com preview site. A re-import replaces the preview’s pages, including any edits made on it in the WordPress editor, so once you start editing in WordPress, stop re-importing.

## What does not move

The staff workspace, order tracking and customer sign-in in this repository are a Node.js application. WordPress cannot run them. They keep working on Vercel and Supabase until the WooCommerce shop replaces them.
