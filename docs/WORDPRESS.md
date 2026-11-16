# OLIVE on WordPress.com

The public site and shop are moving to WordPress.com. WooCommerce runs the shop, on the MySQL database that WordPress.com provides. This file records what is set up and what is still open.

- Design: [superpowers/specs/2026-11-16-wordpress-shop-design.md](superpowers/specs/2026-11-16-wordpress-shop-design.md)
- Build plan: [superpowers/plans/2026-11-16-wordpress-shop.md](superpowers/plans/2026-11-16-wordpress-shop.md)

## The site

| | |
|---|---|
| Site | "OLIVE Pure Mineral Water", blog ID `258624640` |
| Address for now | `shiny-moon-cherryblossom.wpcomstaging.com` |
| State | Coming Soon (not public), free plan |
| Admin | `https://shiny-moon-cherryblossom.wpcomstaging.com/wp-admin/` |

The account's other two sites, `quality-detective-king.wordpress.com` and `olivemineralwater.wordpress.com`, are empty placeholders and are not used.

## What is set up (as of 2026-11-16)

- **Pages:** Home, Products, Trade Enquiry, About, Delivery & Help, imported from the static copy that used to live in `wordpress-site/`.
- **WooCommerce 11.3:** installed and active. It owns Shop (`/shop/`), Basket, Checkout and My account.
- **Catalogue:** two categories, Signature Glass and Still Water, and seven published products with photos and descriptions.
- **Menus:** header is Home, Shop, Trade Enquiry, About, Delivery & Help, My Account, Basket. The Products page is still published but no longer in the menus.
- **Shop styling:** [`wordpress/olive-shop.css`](../wordpress/olive-shop.css), applied as the site's Additional CSS.

## What is not set up yet

These need the WordPress admin screens, and most need figures from the client. On 2026-11-16 the shop still showed US dollars and no prices, so none of them had been done on this site.

1. Country, currency (GBP) and VAT-inclusive prices.
2. A price and stock count for each product. Until a product has a price it shows "Read more" and cannot be bought.
3. The delivery area and delivery charge.
4. A card payment provider, tested in test mode first.
5. Guest checkout and account settings.
6. Policy pages: delivery, returns, privacy and terms. WooCommerce left a draft "Refund and Returns Policy" page to start from.
7. A paid plan (needed for the custom domain), the domain itself, and launch.

The step-by-step clicks for 1 to 5 are in the build plan, Tasks 1, 2, 5 and 6.

## Changing the shop's look

1. Edit `wordpress/olive-shop.css`. It is written phone first: the base rules are for a 375px screen and the wider layouts are added at the bottom.
2. Copy the whole file into **Appearance → Editor → Styles → Additional CSS** on the site, replacing what is there.
3. Check Shop, a product, Basket, Checkout and My account at phone, tablet and desktop widths.

Three things about this theme that the CSS relies on:

- The Shop page puts its content in `main`. Product pages nest `main` inside a `.woocommerce` wrapper. Basket, Checkout and My account are ordinary pages whose content sits in `.entry-content`.
- Product photos are forced to `object-fit: contain`, so bottles are shown whole.
- On phones, the add-to-basket form on a product page is fixed to the bottom of the screen. This has not been seen working yet, because no product has a price.

## Do not re-import the static copy

The pages were first created by importing a static copy of `public/`. That copy and its build script have been removed from the repository, because importing again would replace the pages and everything edited in WordPress since.

## What does not move

The staff workspace, order tracking and customer sign-in in `src/` are a Node.js application that WordPress cannot run. They stay on Vercel and Supabase until the WooCommerce shop is live, and are then retired. The code remains in this repository's history.
