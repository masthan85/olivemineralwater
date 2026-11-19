# The OLIVE app

The website is a progressive web app: phones can install it as the **OLIVE** app, and the same site is packaged for Google Play. There is no separate app code. Whatever changes on the website appears in the app.

## What is in place (2026-11-19)

| Part | Where |
|---|---|
| App name, colours, start page and shortcuts (Order, My Account, Products) | `assets/pwa/manifest.json` |
| Home-screen icons: the gold olive branch on OLIVE green | `assets/pwa/icon-*.png`, `apple-touch-icon.png` |
| Service worker, served at `/?olive_sw=1` for the whole site | `assets/pwa/sw.js` |
| Offline page, at `/?olive_offline=1` | `assets/pwa/offline.html` |
| Android app verification, at `/.well-known/assetlinks.json` | `assets/pwa/assetlinks.json` (empty until the Play app exists) |

The service worker never stores pages, prices or baskets. Everything loads fresh from the website; the only stored item is the offline page.

## Installing it today

- **Android (Chrome):** open olivemineralwater.co.uk, then menu → **Install app** or **Add to Home screen**.
- **iPhone (Safari):** open the site, tap **Share** → **Add to Home Screen**.

## Publishing on Google Play

### 1. Google Play developer account (the client)

Open a Google Play Console account in the business's name. There is a one-off registration fee.

Choose an **organisation** account if you can; it needs a D-U-N-S number for the business. A new **personal** account has to run a closed test with at least 12 testers for 14 days before the app can go public.

### 2. Build the Android package with PWABuilder

1. Go to **pwabuilder.com** and enter `https://olivemineralwater.co.uk`.
2. Choose **Package for stores → Android → Google Play**.
3. Settings:
   - Package ID: `uk.co.olivemineralwater.app`
   - App name: `OLIVE Pure Mineral Water`, short name `OLIVE`
   - Signing key: **Create new**
4. Download the zip. It contains the app bundle (`.aab`), the signing key, and `assetlinks.json`.

**Keep the signing key file and its passwords somewhere safe.** Every future update to the app must be signed with the same key.

### 3. Link the app to the website

Put the contents of the downloaded `assetlinks.json` into `assets/pwa/assetlinks.json` in this repository and push to `main`. It deploys to `https://olivemineralwater.co.uk/.well-known/assetlinks.json`.

Without this the app still works, but it shows a browser address bar at the top.

### 4. Create the app in Play Console

1. **Create app** with name OLIVE Pure Mineral Water, type App, free.
2. Upload the `.aab` to **Testing → Internal testing** first and install it on a phone.
3. Fill in the **Store listing**:
   - short and full description
   - the 512 × 512 icon (`assets/pwa/icon-512.png`)
   - a 1024 × 500 feature graphic
   - at least two phone screenshots
4. Complete the **App content** forms: privacy policy, data safety, content rating and target audience.
5. Move the release to production (or closed testing first, for a personal account) and submit for review.

### Before submitting

- **Privacy policy page.** Google Play requires a privacy policy URL, and the site does not have one yet.
- **A working shop.** The app should let customers order. Until products have prices and a payment method, it can only take order requests through the form.
