// What the OLIVE Site plugin serves: redirects for old addresses, the app
// files and the service worker. Page wording is edited by the client in
// WordPress, so it is not tested here.
const { test, expect } = require('@playwright/test');

// These checks don't depend on screen size, so they run once.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'runs once, on desktop');
});

const redirects = [
  ['/account/', '/my-account/'],
  ['/order-query-1/', '/order/'],
  ['/products.html', '/products/'],
  ['/operations.html', '/login/'],
];

for (const [from, to] of redirects) {
  test(`${from} redirects to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302]).toContain(response.status());
    expect(new URL(response.headers().location, 'https://x').pathname).toBe(to);
  });
}

test('app manifest is valid', async ({ request }) => {
  const response = await request.get('/wp-content/plugins/olive-site/assets/pwa/manifest.json');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.short_name).toBe('OLIVE');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test('service worker is served for the whole site', async ({ request }) => {
  const response = await request.get('/?olive_sw=1');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('javascript');
  expect(response.headers()['service-worker-allowed']).toBe('/');
});

test('offline page and Android app link file are served', async ({ request }) => {
  const offline = await request.get('/?olive_offline=1');
  expect(offline.ok()).toBe(true);
  expect(await offline.text()).toContain("You're offline");

  const links = await request.get('/.well-known/assetlinks.json');
  expect(links.ok()).toBe(true);
  expect(Array.isArray(await links.json())).toBe(true);
});

test('service worker registers in the browser', async ({ page }) => {
  await page.goto('/');
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new URL(reg.scope).pathname;
  });
  expect(scope).toBe('/');
});
