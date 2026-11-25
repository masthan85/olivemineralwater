// The product range, as confirmed by the client on 23 Nov 2026: glass bottles
// in two sizes only, 330ml and 750ml, in the new straight-sided bottle shape.
// If the range changes, update this file.
const { test, expect } = require('@playwright/test');

const pages = ['/', '/products/', '/about/', '/order/'];

// Sizes and bottle types that are no longer sold.
const retiredSizes = /\b(250 ?ml|500 ?ml|1 ?litre|1 ?ltr|PET)\b/i;

// Photos of the old curved bottle with a gold cap.
const oldPhotos = /(classic-olive|forest-reserve|sapphire-blue|aqua-spring|mountain-water|6aff607a1adcd)\./;

// The client's Emerald Green photo with a "DESIGN CONCEPTS" plaque; the site
// uses a copy cropped without it (olive-emerald-green-750ml-330ml.jpg).
const plaquePhoto = /SD-Emerald-Green-2-Glass-Bottles/;

// The client's originals with blue "Product of United Kingdom" banners; the
// site uses edited copies with lettering in the label's own colours.
const bannerPhotos = /SD-(Olive-Green|Dark-Green|Deep-Sapphire|Emerald-Green|White)-(2-)?Glass-Bottle|SDEMER1|SDDEEP1/i;

// Earlier edits: v2 and v3 have capitals lettering with no flag, and the olive
// sprig on the rock. The site uses the -hd photos, which are upscaled, have
// "Product of United Kingdom" with the Union flag along each label's border,
// and no olive sprig.
const earlierEdits = /olive-(emerald-green-750ml(-330ml)?|classic-olive-green-750ml|forest-reserve-750ml|deep-sapphire-blue-750ml)(-v2|-v3)?(-\d+x\d+)?\.jpg/;

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
    const old = sources.filter(
      (src) => oldPhotos.test(src) || plaquePhoto.test(src) || bannerPhotos.test(src) || earlierEdits.test(src),
    );
    expect(old, 'photos of the old bottle').toEqual([]);
  });

  test(`${path} shows the bottle photos at full size`, async ({ page }) => {
    await page.goto(path);
    // WordPress's 300px "medium" copies look blurred when stretched across a card or the hero.
    const sources = await page.locator('main img').evaluateAll(
      (imgs) => imgs.map((img) => img.currentSrc || img.src),
    );
    const small = sources.filter((src) => /-([1-2]?\d{2}|300)x\d{2,4}\.(jpe?g|png)/.test(src));
    expect(small, 'thumbnail-sized photos').toEqual([]);
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

test('every bottle card shows both sizes, then the description, then the link', async ({ page }) => {
  for (const path of ['/', '/products/']) {
    await page.goto(path);
    const cards = page.locator('.bottle-card');
    await expect(cards, path).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      await expect(cards.nth(i).locator('.bottle-title mark'), `${path} card ${i + 1}`).toHaveText('330ml / 750ml');
    }
    // The size sits under the name, not beside it.
    const title = await cards.first().locator('.bottle-title h3').boundingBox();
    const size = await cards.first().locator('.bottle-title mark').boundingBox();
    expect(size.y, `${path}: size below the name`).toBeGreaterThan(title.y + title.height - 2);
  }
  // On the Products page the request links line up along the bottom.
  await page.goto('/products/');
  const bottoms = await page.locator('.bottle-card a.text-link').evaluateAll(
    (links) => links.map((a) => Math.round(a.getBoundingClientRect().bottom)),
  );
  expect(Math.max(...bottoms) - Math.min(...bottoms), 'request links line up').toBeLessThanOrEqual(2);
});
