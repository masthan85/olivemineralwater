# OLIVE on WordPress.com

Last reviewed: 24 November 2026.

## The sites

| Site | Address | Blog ID | Plan | Use |
|---|---|---|---|---|
| Live | `olivemineralwater.co.uk` | `258777266` | Premium | The public website and shop |
| Preview | `shiny-moon-cherryblossom.wpcomstaging.com` | `258624640` | Free | Where the shop was first tried out. Not used any more; it expires if no plan is bought. |

The live site was built by importing the previous Vercel site, so its theme (`olivemineralwater-co-uk`) and page layouts come from that import. Edit pages in the WordPress editor.

The client edits page wording in WordPress too. Before rewriting a whole page, check its last-modified time so their changes are not overwritten.

## What the OLIVE Site plugin does

The plugin is this repository (`olive-site.php` and `assets/`). It deploys automatically: GitHub Deployment 9647 copies `main` to `/wp-content/plugins/olive-site` on every push.

| Feature | Where |
|---|---|
| Logo and photo sizing (the import left the logo at 1311px wide), a solid green header that stays on top while scrolling, content up to 1400px wide on large screens, and the bottle cards' layout (name, sizes, description, then the request link lined up at the bottom) | `assets/css/site-fixes.css`, every page |
| The About page's "From rain to bottle" section | `assets/css/about.css` |
| Phone-first WooCommerce styles | `assets/css/shop.css`, while WooCommerce is active |
| My Account and Staff sign-in layouts | `assets/css/account.css` |
| Customer account creation always on (email only; WooCommerce emails a link to set a password) and plainer wording ("Sign in", "Create an account") | `olive-site.php` |
| `[olive_social_login]` shortcode: shows Nextend Social Login's buttons once a provider is set up, and nothing before that | `olive-site.php` |
| Redirects for the old `.html` addresses and the import's duplicate pages | `olive-site.php`, listed in the README |
| The installable app: manifest, icons, service worker, offline page and `/.well-known/assetlinks.json` | `assets/pwa/`, see [APP.md](APP.md) |
| Link-preview tags (title, address and the bottle photo) for WhatsApp, Facebook, LinkedIn and X | `olive-site.php`, skipped if Jetpack prints its own |

Set in WordPress, not by the plugin:

- **Site icon:** the olive branch, media item 80 (`olive-site-icon.png`, the same image as `assets/pwa/icon-512.png`). Settings → General.
- **Menus:** header navigation 13 and footer navigation 14.

## Product range

Glass bottles only, in **330ml and 750ml**, with four label finishes: Classic Olive Green, Dark Green – Forest Reserve, Deep Sapphire Blue and Emerald Green Spring. Plastic bottles and the 250ml, 500ml and 1 litre sizes are no longer sold (confirmed by the client on 23 November 2026). The Playwright tests fail if a page mentions them again.

The bottle photos are edited copies of the client's originals. See [photo-edits/README.md](photo-edits/README.md) for which image is used where.

## Pages

| Page | How it works |
|---|---|
| Home (15), Products (26), About (16), Delivery & Help (19) | Content pages. Home and Products show the four bottle cards. |
| Order (21) | A Jetpack form. Requests are kept in wp-admin under **Jetpack → Forms** (also called Feedback) and emailed to the page's author, the admin account `aijazahmeduk`. The page shows `service@olivemineralwater.co.uk` as the contact address. |
| Trade Enquiry (28) | A Jetpack form, as above. |
| Track Order (27) | A Jetpack form asking for the order reference, postcode and email. The team replies by email; there is no automatic lookup. |
| My Account (64, `/my-account/`) | WooCommerce's account page with Sign in and Create an account side by side. The old `/account/` page redirects here. |
| Staff sign-in (20, `/login/`) | A single card with the WordPress sign-in form. Staff sign in with their WordPress.com account and go to wp-admin. |
| Shop (61), Basket (62), Checkout (63) | Created by WooCommerce. Empty until products are published. |
| `order-query-1` to `-4`, `account-query-1`, `account` (17) | Left over from the import. The plugin redirects them; they can be moved to the bin. |

To send form emails somewhere else, set the address in each form's settings in the editor, once that mailbox exists.

## Shop (WooCommerce)

WooCommerce 11.3.1 and Nextend Social Login (free) are installed on the live site. The store currency is GBP (£). Product categories: Signature Glass (17) and Still Water (18).

**Transaction fees.** WordPress.com support confirmed on 24 November 2026 that the Premium plan's 4% fee applies only to WordPress.com's own payment blocks (Payments Button, Donations, Paid Content, paid newsletters). It does not apply to WooCommerce orders paid through the Stripe Gateway or WooPayments. Those orders pay only Stripe's or WooPayments' own card fees. So take payments through WooCommerce, not the Payments block.

**Payment plugins.** WooPayments and WooCommerce PayPal Payments are installed and active, as well as the Stripe Gateway. All three are kept for now (decided 24 November 2026). When payments are set up, turn on card payments in only one of them, so checkout doesn't offer card payment twice.

| ID | Product | Photo (media item) | Status |
|---|---|---|---|
| 66 | Classic Olive Green (750ml) | 153 | Draft, no price |
| 67 | Dark Green - Forest Reserve (750ml) | 154 | Draft, no price |
| 68 | Deep Sapphire Blue (750ml) | 155 | Draft, no price |
| 69 | Emerald Green Spring (750ml) | 146 | Draft, no price |
| 70 | Emerald Green Spring (330ml) | 145 | Draft, no price |

Products 71 and 72 (the old 500ml and 1 litre bottles) are in the bin.

The WordPress.com connector cannot set prices, stock, currency, tax, delivery or payments. Those are set in wp-admin under **WooCommerce → Settings** and on each product.

## Still to do

1. **Shop settings (client, in wp-admin).** The currency is already GBP. Still to set: UK address, VAT (bottled water is usually standard-rated; confirm with the accountant), delivery area and charges.
2. **Products (client).** Prices and opening stock; then publish. Add 330ml products for Classic Olive Green, Forest Reserve and Deep Sapphire Blue, which all come in 330ml too.
3. **Payments (client).** A Stripe account connected through the free WooCommerce Stripe Gateway, plus bank transfer. Then point **Order Now** at the shop.
4. **Trade invoicing and FreeAgent.** Pay-by-invoice for approved trade customers and an order-to-FreeAgent link, both planned for the OLIVE Site plugin.
5. **Google sign-in (client).** Create the Google OAuth keys and enter them in Nextend Social Login.
6. **Policy pages.** Privacy policy (also needed for Google Play), delivery, returns and terms.
7. **Google Play.** See [APP.md](APP.md).
8. **Tidy up.** Move the import's duplicate pages to the bin, delete unused media (the earlier photo versions listed in the photo-edits notes), delete the Vercel project and pause the Supabase project.
