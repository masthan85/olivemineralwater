// The product range, as confirmed by the client on 23 Nov 2026: glass bottles
// in two sizes only, 330ml and 750ml, in the new straight-sided bottle shape.
// If the range changes, update this file.
const { test, expect } = require('@playwright/test');

const pages = ['/', '/products/', '/about/', '/order/'];

// Sizes and bottle types that are no longer sold.
const retiredSizes = /\b(250 ?ml|500 ?ml|1 ?litre|1 ?ltr|PET)\b/i;

// Photos of the old curved bottle with a gold cap.
const oldPhotos = /(classic-olive|forest-reserve|sapphire-blue|aqua-spring|mountain-water|6aff607a1adcd)\./;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'runs once, on desktop');
});

for (const path of pages) {
  test(`${path} only offers 330ml and 750ml`, async ({ page }) => {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    const placeholders = await page.locator('main [placeholder]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('placeholder')).join(' '),
    );
    expect(`${text} ${placeholders}`).not.toMatch(retiredSizes);
  });

  test(`${path} shows only the new bottle shape`, async ({ page }) => {
    await page.goto(path);
    const sources = await page.locator('main img').evaluateAll(
      (imgs) => imgs.map((img) => img.currentSrc || img.src),
    );
    const old = sources.filter((src) => oldPhotos.test(src));
    expect(old, 'photos of the old bottle').toEqual([]);
  });
}

test('home and products pages mention both sizes', async ({ page }) => {
  for (const path of ['/', '/products/']) {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    expect(text, path).toContain('330ml');
    expect(text, path).toContain('750ml');
  }
});

test('link previews use the new bottle photo', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).not.toHaveAttribute('content', oldPhotos);
});
