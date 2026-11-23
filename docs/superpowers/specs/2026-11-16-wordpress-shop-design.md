# OLIVE online shop on WordPress — design

> **Status (23 Nov 2026):** historical. The shop was built on the live site (blog ID `258777266`), not this preview site. The range is now glass only in 330ml and 750ml with four labels, and the accounts package is FreeAgent, not Xero. For the current set-up see [docs/WORDPRESS.md](../../WORDPRESS.md).

Date: 2026-11-16. Status: awaiting approval.

## Intent

OLIVE Pure Mineral Water is a bootstrapped start-up selling bottled water to homes and businesses across Greater London and the Home Counties. Today the public site only collects order requests. The client wants customers to buy and pay online, mostly from a phone, and wants the business run from tools that need no developer: WordPress for the site and shop, Xero for the accounts.

The measure of success is simple: a customer on a phone can find a bottle, pay for it and get a confirmation in a couple of minutes, and the business sees that order, the customer and the stock change without retyping anything.

## Goals

- Sell the seven products online with card payment.
- Work first on phones and tablets, where 80–90% of visitors are expected.
- Give the business order, customer and stock management inside WordPress.
- Send sales to Xero so bookkeeping is done there.
- Keep running costs as low as a real shop allows.
- Leave room for the growth features in the roadmap below.

## Non-goals

- Migrating the custom Node.js system or its data. It is being retired, not moved.
- Batch-level traceability and warehouse receipts as they exist in the custom staff workspace. WooCommerce stock counts replace them for now.
- A mobile app. The site is the product.
- Trade accounts with their own prices in this phase. Trade customers keep using the enquiry form until phase 3.

## Anti-goals

- A cluttered shop. Pop-ups, carousels, overlapping banners or more than one call to action per screen would make this a failure even if it sells.
- Recurring costs the business has not agreed to. No paid plugin is installed without the price being shown and approved first.
- Supabase. Nothing new depends on it.

## Constraints

- Platform: WordPress.com, on the existing preview site (blog ID `258624640`), database MySQL as provided by WordPress.
- The site is on the free plan. Plugins, a custom domain and GitHub Deployments need a paid plan; Personal (£36 a year when checked on 2026-11-12) is enough. Buying it is the client's step.
- Payment and Xero accounts belong to the client. Their sign-in details and keys are entered by the client, never by the builder.
- The domain `www.olivemineralwater.co.uk` is registered at GoDaddy and must keep its email records.
- Brand: deep green, cream and gold, with the existing logo and bottle photography. Photos are shown whole, never cropped into banners.

## Approaches considered

1. **WooCommerce for the shop, Xero for the accounts — chosen.** Customers pay on the site; each order goes to Xero as an invoice and payment. It covers everything asked for, and every growth feature on the roadmap is a WooCommerce add-on. Costs are the WordPress plan, a Xero subscription, card fees and possibly a connector plugin.
2. **Xero invoices only.** Cheapest, but there is no basket or checkout, every order is typed up by hand, and none of the growth features are possible.
3. **WooCommerce only, Xero later.** Cheapest way to start selling; bookkeeping stays manual until Xero is added.

The client picked approach 1 on 2026-11-16 because it keeps bookkeeping in Xero, which he finds easy to use, while giving customers a real shop. Xero is connected in phase 2, once real orders exist, so it is not paid for before it is useful.

## What gets built in this phase (phase 1: shop and payments)

### Products

Seven simple products, each with a photo, a short description, a price and a stock count:

| Product | Size |
|---|---|
| Classic Olive | 750ml glass |
| Forest Reserve | 750ml glass |
| Sapphire Blue | 750ml glass |
| Aqua Spring | 750ml glass |
| OLIVE Still Water | 250ml |
| OLIVE Still Water | 500ml |
| OLIVE Still Water | 1 litre |

Two categories: Signature Glass and Still Water. The three Still Water sizes share one photo until separate photos exist.

Prices, pack sizes and stock counts come from the client (see Inputs needed). Products are created as drafts and published only when those are in.

### Pages and menu

- **Shop** replaces the current holding page with the product grid.
- **Product page**, **Basket**, **Checkout** and **My Account** are WooCommerce's own pages, styled to match the site.
- The menu becomes: Home, Shop, Trade Enquiry, About, Delivery & Help, plus a basket icon with a count. The separate Products page is folded into Shop so there is one place to browse.
- "Shop Now" buttons across the site lead to Shop.

### Phone-first layout

Designed at 375px wide first, then widened.

```
┌───────────────────────────┐
│ OLIVE            ☰   🛒 2 │
├───────────────────────────┤
│ Shop                      │
│ [Signature Glass][Still]  │
│ ┌──────────┐ ┌──────────┐ │
│ │  photo   │ │  photo   │ │
│ │ Classic  │ │ Forest   │ │
│ │ £—       │ │ £—       │ │
│ │ [ Add ]  │ │ [ Add ]  │ │
│ └──────────┘ └──────────┘ │
└───────────────────────────┘
```

- Two products per row on a phone, three on a tablet, four on a desktop.
- Every button and field is at least 44px tall. Body text is at least 16px so phones do not zoom on focus.
- One primary action per screen: Add to basket, Checkout, Pay.
- Checkout is a single column with the fewest fields WooCommerce allows: contact, delivery address, payment. Address and card fields use the phone's autofill.
- A sticky bar at the bottom of the product page and basket holds the main button on phones.
- Nothing overlaps content: no pop-ups, no chat bubble, no cookie wall beyond what the law requires.

### Checkout rules

- Guest checkout is allowed, with an option to create an account at the end. Forcing sign-up loses phone orders.
- Delivery is limited to the postcodes OLIVE serves; other postcodes see a clear message before payment, not after.
- Prices are shown including VAT. Bottled water is standard-rated in the UK; the client's accountant should confirm the treatment.
- Order emails go to the customer and to `hello@olivemineralwater.co.uk`.

### Payments

One card payment provider that also offers Apple Pay and Google Pay, because one-tap wallets matter most on phones. The default choice is WooPayments, which has no monthly fee; Stripe is the fallback if the client's business is not eligible. The client creates and verifies the account. The shop is tested in the provider's test mode before real payments are switched on.

### Back office in this phase

WooCommerce's own screens: orders with statuses, customers with their order history, and a stock count per product with a low-stock email. This is the customer and stock management for now.

### Launch

1. Client buys the plan on the preview site.
2. Shop is built and tested in test mode on the preview address.
3. Client reviews on his own phone.
4. Domain is pointed at WordPress.com; email records are left alone.
5. Real payments are switched on and one real order is placed and refunded.
6. The Vercel site is taken down and the Supabase project paused once nothing uses them.

## Roadmap after this phase

Each is its own small project, designed when it is next.

| Phase | What | Why it earns its place |
|---|---|---|
| 2 | Xero connection; customer notes and tags; stock and sales reports | Bookkeeping without retyping; know who the regulars are |
| 3 | Repeat-order subscriptions | Water is bought on a rhythm; weekly or monthly delivery is the steadiest revenue |
| 3 | Trade pricing and trade accounts | Hotels and restaurants order more and more often |
| 3 | Delivery day and slot choice at checkout | Fewer missed deliveries and fewer "where is my order" emails |
| 3 | Product reviews | Proof for new visitors |
| 4 | Reorder in one tap, abandoned-basket reminder, first-order discount code, refer-a-friend | Cheap ways to raise repeat orders |
| 4 | Google Business Profile, product data for search, a simple sitemap | Being found locally costs nothing |
| 4 | Bottle return or deposit scheme for glass | Fits the brand and gives a reason to reorder |

Several of these need paid plugins. Each is priced and approved before it is installed.

## Inputs needed from the client

1. Price for each of the seven products, and whether they are sold singly or by the case (and the case size).
2. Opening stock for each product.
3. Delivery charge, any free-delivery threshold and any minimum order.
4. The delivery area as a list of postcode districts.
5. Business details for the payment account and for the footer: legal name, address, VAT number if registered.
6. Returns and refund terms, for the policy page.

## Left to the builder

- Which free plugins, if any, are needed beyond WooCommerce and the payment plugin.
- How the existing imported theme is extended to style the shop pages, and whether theme files are kept in this repository and deployed with GitHub Deployments.
- Exact wording of shop, basket and checkout messages, in the site's existing voice.
- What happens to `wordpress-site/` and `scripts/build-wordpress-site.py`. Once the shop is edited in WordPress, re-importing would wipe it, so they are expected to be removed.

## Open risks

- WooCommerce pages on a statically imported theme may need more styling work than on a stock theme. If so, switching to a standard block theme restyled in OLIVE's colours is the fallback.
- The preview site expires around 2026-12-12 if no plan is bought.
- The live Vercel site still shows order and account pages that depend on Supabase. They stay as they are until launch.
