// The header stays at the top while scrolling, keeps its green background and
// stays in front of the page (the see-through header bug of 21 Nov 2026).
const { test, expect } = require('@playwright/test');

const OLIVE_GREEN = 'rgb(24, 66, 50)';

for (const path of ['/', '/products/', '/about/', '/order/']) {
  test(`header stays solid and on top when scrolling ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);

    const header = page.locator('.site-header').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('background-color', OLIVE_GREEN);

    const box = await header.boundingBox();
    expect(Math.round(box.y), 'header is pinned to the top').toBe(0);

    // Whatever is drawn in the middle of the header must belong to the header,
    // not to page content scrolling underneath it.
    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el && !!el.closest('.site-header');
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(onTop, 'header is in front of the page').toBe(true);
  });
}

test('menu opens on phones and links to My Account', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone menu only');
  await page.goto('/');
  await page.getByRole('button', { name: /menu/i }).first().click();
  const link = page.getByRole('link', { name: 'My Account' }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /my-account/);
});

test('desktop menu shows the main links', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop menu only');
  await page.goto('/');
  const nav = page.locator('.site-header nav').first();
  for (const name of ['Home', 'Products', 'Trade Enquiry', 'About', 'Track Order', 'My Account', 'Order Now']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
});
