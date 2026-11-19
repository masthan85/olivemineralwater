# OLIVE on WordPress.com

## The sites

| Site | Address | Blog ID | Plan | Use |
|---|---|---|---|---|
| Live | `olivemineralwater.co.uk` | `258777266` | Premium | The public website |
| Preview | `shiny-moon-cherryblossom.wpcomstaging.com` | `258624640` | Free | Where the WooCommerce shop was first built and tested |

The live site was built by importing the previous Vercel site, so its theme (`olivemineralwater-co-uk`) and page layouts come from that import. Edit pages in the WordPress editor.

## What the OLIVE Site plugin does

- Loads `assets/css/site-fixes.css`. The import wraps images in figures that do not take part in layout, which left the header logo at its full 1311px width. These rules size the logo and photos directly.
- Loads `assets/css/shop.css` once WooCommerce is installed.
- Redirects the previous site's `.html` addresses and the import's duplicate pages. See the README for the list.

## Pages on the live site (as of 2026-11-19)

| Page | How it works |
|---|---|
| Home, Products, About, Delivery & Help | Content pages. |
| Order | A Jetpack form. Each request is emailed to the site's admin email and kept under **Feedback** in wp-admin. |
| Trade Enquiry | A Jetpack form, as above. |
| Track Order | A Jetpack form asking for the order reference, postcode and email. The team replies by email. There is no automatic lookup. |
| My Account (`/my-account/`) | WooCommerce's account page: sign in, order history and saved addresses. The `[olive_social_login]` shortcode shows Nextend Social Login's "Continue with Google" button once Google is set up in Nextend. The old `/account/` page redirects here. |
| Staff sign-in | The WordPress login. Staff use their WordPress.com account. |
| `order-query-1` to `-4`, `account-query-1` | Duplicates left by the import. The plugin redirects them; they can be moved to the bin once the plugin is active. |

Form emails go to the site's admin email. To send them to `hello@olivemineralwater.co.uk` instead, set that address in each form's settings in the editor once the mailbox exists.

## Still to do

1. **Online shop.** WooCommerce and the seven products (drafts, no prices) are on the live site since 2026-11-19. Set it up as in the build plan (`docs/superpowers/plans/2026-11-16-wordpress-shop.md`): UK, GBP and VAT, prices and stock, delivery area, card payments in test mode, then live.
2. **Customer accounts.** WooCommerce provides My Account with order history. Sign-in with Google, Microsoft or Apple needs a social login plugin. Check its price before installing.
3. **Policy pages.** Delivery, returns, privacy and terms, from the client's own terms.
4. **Retire the old services.** Delete the Vercel project and pause the Supabase project. Nothing on the live site uses them.
