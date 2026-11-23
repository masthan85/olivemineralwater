// Every public page loads, has its heading, fits the screen and has the
// shared header, logo and link-preview tags.
const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/', heading: 'OLIVE — Pure Mineral Water' },
  { path: '/products/', heading: /colourways, one pure water/ },
  { path: '/trade-enquiry/', heading: /For hotels, restaurants/ },
  { path: '/about/', heading: 'Drawn from nature, bottled with care' },
  { path: '/delivery/', heading: 'From our warehouse to your door' },
  { path: '/track/', heading: 'Check on your order' },
  { path: '/order/', heading: 'Order for home or business' },
  { path: '/my-account/', heading: 'My Account' },
  { path: '/login/', heading: 'Staff sign-in' },
];

for (const { path, heading } of pages) {
  test.describe(`page ${path}`, () => {
    test('loads with its heading', async ({ page }) => {
      const response = await page.goto(path);
      expect(response.status(), 'HTTP status').toBe(200);
      await expect(page.locator('h1').first()).toHaveText(heading);
      await expect(page).toHaveTitle(/OLIVE/);
    });

    test('fits the screen with no sideways scrolling', async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
    });

    test('shows the logo at a sensible size', async ({ page }) => {
      await page.goto(path);
      const logo = page.locator('.site-header img').first();
      await expect(logo).toBeVisible();
      const box = await logo.boundingBox();
      expect(box.width).toBeGreaterThan(80);
      expect(box.width).toBeLessThanOrEqual(200);
    });

    test('has link-preview tags', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /OLIVE/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\//);
      await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /olive-site-icon/);
    });

    test('has no broken images', async ({ page }) => {
      await page.goto(path);
      // Bring lazy images into view so they load.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
      });
      await page.waitForLoadState('networkidle').catch(() => {});
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((img) => img.complete && img.naturalWidth === 0)
          .map((img) => img.currentSrc || img.src),
      );
      expect(broken, 'images that failed to load').toEqual([]);
    });
  });
}
