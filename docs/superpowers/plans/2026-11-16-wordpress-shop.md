# OLIVE WordPress Shop (Phase 1) Implementation Plan

> **Status (23 Nov 2026):** historical. The shop was built on the live site (blog ID `258777266`), not this preview site. The range is now glass only in 330ml and 750ml with four labels, and the accounts package is FreeAgent, not Xero. For the current set-up see [docs/WORDPRESS.md](../../WORDPRESS.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the WordPress.com preview site into a phone-first WooCommerce shop that sells OLIVE's seven products with card payment.

**Architecture:** Everything runs on one WordPress.com site (blog ID `258624640`, MySQL managed by WordPress.com). WooCommerce supplies the catalogue, basket, checkout, accounts, orders and stock. The existing imported theme is extended with one block of shop CSS; no custom plugin or server code is written.

**Tech Stack:** WordPress 7.1 on WordPress.com, WooCommerce, WooPayments (Stripe as fallback), the WordPress.com connector for site changes, wp-admin in the browser for settings the connector cannot reach.

**Spec:** `docs/superpowers/specs/2026-11-16-wordpress-shop-design.md`

## Global Constraints

- Target site is blog ID `258624640` only. Never write to `quality-detective-king.wordpress.com` or `olivemineralwater.wordpress.com`.
- No purchase is made by the builder. Plans, paid plugins and domains are bought by the client.
- No paid plugin is installed without its price shown to the client and approved.
- Payment-provider and Xero sign-in details and keys are entered by the client, never by the builder.
- Nothing new depends on Supabase.
- Phone first: design at 375px wide, then 768px, then 1280px.
- Every button and form field is at least 44px tall; body and input text is at least 16px.
- One primary action per screen. No pop-ups, carousels, chat bubbles or overlapping banners.
- Brand colours: green `#184232`, cream `#f6f3e9`, sand `#e9e4d3`, gold `#c9a326`, gold text `#856811`, ink `#202b22`, muted `#555f51`.
- Photos are shown whole (`object-fit: contain` or natural ratio), never cropped into banners.
- Currency GBP, prices shown including VAT, site language en-GB.
- The site stays in Coming Soon mode until Task 9.
- How to change the site: use a connector tool when one exists for the job; otherwise use wp-admin in the browser pane once the client has signed in there; otherwise give the client the exact clicks.

## Review Focus

1. **Postcode outside the delivery area** → the customer is told before payment that OLIVE does not deliver there, and cannot pay. Tested in Task 5.
2. **Card declined** → the customer stays on checkout with a plain message, the basket is intact and no order is marked paid. Tested in Task 6.
3. **Product out of stock** → it shows "Out of stock", cannot be added to the basket, and an order cannot oversell the last unit. Tested in Task 6.
4. **Guest checks out with an email that already has an account** → the order completes and is attached to that customer record; no error. Tested in Task 6.
5. **Long content on a 320px-wide phone** (longest product name, three-digit basket count, long email) → nothing overflows or overlaps. Tested in Task 4.

---

### Task 0: Gate — plan and client inputs

**Interfaces:**
- Produces: a site that accepts plugin installs; the six inputs listed in the spec under "Inputs needed from the client".

- [ ] **Step 1:** Read the site status with `wpcom-manage-site` (`action: "get_status"`, `wpcom_site: "258624640"`). On 2026-11-16 it reported `plan.slug: "free_plan"`.
- [ ] **Step 2:** Attempt Task 1 Step 1. If the install is refused for plan reasons, stop and give the client the checkout link from `wpcom-plans-list` (`wpcom_site: "258624640"`) for the Personal plan. Resume when `get_status` shows a paid plan.
- [ ] **Step 3:** Ask the client for the six inputs. Tasks 1–4 do not need them; Tasks 2 (prices, stock), 5 (delivery) and 7 (business details, returns terms) use placeholders marked `TO CONFIRM` until they arrive, and Task 9 cannot start with any placeholder left.

### Task 1: WooCommerce installed and set for the UK

**Interfaces:**
- Produces: active plugin `woocommerce/woocommerce`; pages Shop (`/shop/`), Basket, Checkout, My Account.

- [ ] **Step 1:** Install and activate WooCommerce (`wpcom-plugin-install`, slug `woocommerce`).
- [ ] **Step 2:** Verify with `wpcom-plugin-list` (`status: "active"`): the list contains `woocommerce/woocommerce`.
- [ ] **Step 3:** In WooCommerce settings set: country United Kingdom; currency GBP, symbol on the left, 2 decimals; selling and shipping location "specific countries: United Kingdom"; taxes enabled, prices entered including tax, displayed including tax in shop and basket; guest checkout on; account creation offered at checkout and on My Account; "Basket" not "Cart" where the en-GB language pack does not already say so.
- [ ] **Step 4:** Decline every optional paid extension and marketing add-on the setup wizard offers.
- [ ] **Step 5:** Verify: `/shop/`, the basket page and the checkout page each load without an error and show the site header and footer.

### Task 2: Catalogue

**Interfaces:**
- Consumes: Task 1.
- Produces: categories `signature-glass` and `still-water`; seven products with these slugs: `classic-olive`, `forest-reserve`, `sapphire-blue`, `aqua-spring`, `still-water-250ml`, `still-water-500ml`, `still-water-1-litre`.

- [ ] **Step 1:** Create the two categories, named "Signature Glass" and "Still Water".
- [ ] **Step 2:** Create the seven products as **drafts**, simple products, stock management on, low-stock threshold 10, backorders not allowed, tax status taxable at the standard rate. Names: "Classic Olive (750ml)", "Forest Reserve (750ml)", "Sapphire Blue (750ml)", "Aqua Spring (750ml)", "OLIVE Still Water (250ml)", "OLIVE Still Water (500ml)", "OLIVE Still Water (1 litre)".
- [ ] **Step 3:** Use the descriptions already on the site for the four glass bottles. For the three still sizes use: 250ml "A single serving for place settings, meeting rooms and minibars."; 500ml "Easy to carry, for desks, bags and the gym."; 1 litre "Made for sharing at the table, at home or in the boardroom."
- [ ] **Step 4:** Set product images from the media already imported: `classic-olive.jpg`, `forest-reserve.jpg`, `sapphire-blue.jpg`, `aqua-spring.jpg`; `mountain-water.jpg` for all three still sizes. Alt text names the product and size.
- [ ] **Step 5:** Set price and opening stock from the client's inputs. Without them, leave price empty and stock 0 and add `TO CONFIRM` to the product's private note; do not publish.
- [ ] **Step 6:** Verify: the product list shows seven products, four in Signature Glass and three in Still Water, each with an image. When prices exist, publish and confirm `/shop/` lists seven products.

### Task 3: Menu and pages

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: header menu Home, Shop, Trade Enquiry, About, Delivery & Help, plus a basket link with item count.

- [ ] **Step 1:** Delete the imported holding page at `/shop/` content so WooCommerce's Shop page owns that address. Check the page list first (`wpcom-mcp-pages-list`) so only one page uses the `shop` slug.
- [ ] **Step 2:** Redirect `/products/` to `/shop/` (the Redirection plugin is already active) and remove the Products page from the header and footer menus.
- [ ] **Step 3:** Update the header navigation (`wpcom-navigation-list`, then `wpcom-navigation-update`) to: Home, Shop, Trade Enquiry, About, Delivery & Help, and WooCommerce's mini-basket block at the end. Remove the "Shop Now" button from the header on phones, where the basket icon takes its place.
- [ ] **Step 4:** Point every "Shop Now", "Visit the Shop" and "Order …" link on Home, About and Delivery & Help at `/shop/` or the matching product page.
- [ ] **Step 5:** Verify: from the home page, every header and footer link returns a page, `/products/` lands on `/shop/`, and adding a product changes the basket count.

### Task 4: Phone-first shop styling

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: one stylesheet block, "OLIVE shop", added to the site's Additional CSS (kept in the repository as `wordpress/olive-shop.css` so it is versioned).

- [ ] **Step 1:** Write `wordpress/olive-shop.css` covering: product grid, product card, single product page, basket, checkout, My Account, notices and buttons, using only the brand colours in Global Constraints.
- [ ] **Step 2:** Grid: 2 columns below 600px, 3 from 600px, 4 from 1024px. Card: whole photo on a sand background, name, price in gold text, full-width "Add to basket" button.
- [ ] **Step 3:** Buttons and fields: minimum height 44px, text 16px, pill buttons matching the site (`border-radius: 100px`), primary button green on cream and gold on green.
- [ ] **Step 4:** Single product page and basket on phones: the main button sits in a bar fixed to the bottom of the screen, with page padding so it never covers content.
- [ ] **Step 5:** Checkout: single column at every width below 1024px, order summary collapsed above the form on phones, no sidebar.
- [ ] **Step 6:** Apply the CSS to the site and commit the file.
- [ ] **Step 7:** Verify in the browser at 320, 375, 768 and 1280px on Shop, a product, Basket, Checkout and My Account: `document.documentElement.scrollWidth <= window.innerWidth`; grid shows 2, 2, 3 and 4 columns; every `button`, `a.button`, `input` and `select` in the main content is at least 44px tall; no element overlaps the header or the bottom bar. Use the longest product name and a basket count of 100 for the 320px check (Review Focus 5).

### Task 5: Delivery and VAT

**Interfaces:**
- Consumes: Task 1; client inputs 3 and 4.
- Produces: one shipping zone "OLIVE delivery area"; standard VAT rate.

- [ ] **Step 1:** Create the shipping zone limited to the client's postcode districts, with one flat-rate method using the client's delivery charge and, if given, a free-delivery method above the client's threshold. Leave "Locations not covered by your other zones" with no methods.
- [ ] **Step 2:** If the client set a minimum order, enforce it only if WooCommerce's own settings allow it; otherwise report it as needing a plugin and ask before adding one.
- [ ] **Step 3:** Add the UK standard VAT rate (20%, named "VAT", applied to shipping). Note in the handover that the client's accountant should confirm the treatment.
- [ ] **Step 4:** Verify (Review Focus 1): at checkout, a postcode inside the area shows the delivery charge; a postcode outside it (for example `EH1 1YZ`) shows a no-delivery message and the order cannot be placed.

### Task 6: Payments in test mode

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a working checkout in the provider's test mode.

- [ ] **Step 1:** Install WooPayments. The client creates and verifies the account and connects it; the builder does not enter account details. If the client's business is not eligible, use the free Stripe plugin and the client connects Stripe.
- [ ] **Step 2:** Turn on test mode. Enable card, Apple Pay and Google Pay. Leave every other payment method off.
- [ ] **Step 3:** Place a guest order with the provider's published successful test card. Expect: order status Processing, stock reduced by the quantity, a confirmation email to the customer address and a new-order email to `hello@olivemineralwater.co.uk`.
- [ ] **Step 4:** Place an order with the provider's published declined test card (Review Focus 2). Expect: the customer stays on checkout with a decline message, the basket is unchanged, no paid order exists.
- [ ] **Step 5:** Set one product's stock to 1, order it, then try to order it again (Review Focus 3). Expect "Out of stock" and no add-to-basket button.
- [ ] **Step 6:** Create an account, sign out, and check out as a guest with the same email (Review Focus 4). Expect the order to complete and appear under that customer.
- [ ] **Step 7:** Cancel or delete the test orders and restore stock counts.

### Task 7: Policies, emails and back-office check

**Interfaces:**
- Consumes: Tasks 1–6; client inputs 5 and 6.

- [ ] **Step 1:** Create pages: Delivery Information, Returns & Refunds, Privacy Policy, Terms & Conditions, from the client's terms. Mark anything not supplied `TO CONFIRM`. Link all four in the footer and set them in WooCommerce's policy settings so checkout links to them.
- [ ] **Step 2:** Set order emails to send from `hello@olivemineralwater.co.uk` with the OLIVE logo, green header and the business details in the footer.
- [ ] **Step 3:** Rewrite the two Delivery & Help answers that mention ordering and tracking so they match how the shop now works.
- [ ] **Step 4:** Verify the back office: an order can be moved to Completed and refunded; the customer list shows the test customer with order history; the low-stock email arrives when a product drops to 10.

### Task 8: Repository tidy-up

**Files:**
- Delete: `wordpress-site/` (whole folder), `scripts/build-wordpress-site.py`
- Modify: `docs/WORDPRESS.md`, `README.md` (layout table)
- Keep: `wordpress/olive-shop.css` from Task 4

- [ ] **Step 1:** Delete the import copy and its build script. Re-importing would now overwrite the shop.
- [ ] **Step 2:** Rewrite `docs/WORDPRESS.md` to describe the live setup: which site, where the shop CSS lives and how it is applied, what is configured in wp-admin, and that the Node.js system is retired at launch.
- [ ] **Step 3:** Update the README layout table: remove `wordpress-site/`, add `wordpress/`.
- [ ] **Step 4:** Run `npm test`. Expected: all tests pass. Commit.

### Task 9: Launch

**Interfaces:**
- Consumes: every earlier task, with no `TO CONFIRM` left.

- [ ] **Step 1:** The client reviews the whole shop on their own phone and approves it.
- [ ] **Step 2:** The client adds `www.olivemineralwater.co.uk` to the site and changes the A and CNAME records at GoDaddy to the values WordPress.com shows. MX and other mail records are left alone. The apex domain redirects to `www`.
- [ ] **Step 3:** The client switches payments from test to live.
- [ ] **Step 4:** Launch the site (`wpcom-manage-site`, `action: "launch"`) on the client's word.
- [ ] **Step 5:** Verify: the domain serves the shop over HTTPS, one real order is placed with a real card and refunded in full, and both emails arrive.
- [ ] **Step 6:** Retire the old system only after Step 5: the client removes the Vercel project's domain and pauses the Supabase project. The repository keeps the code in history.
