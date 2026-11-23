// The forms are present and complete. These tests never submit a form, so
// they create no entries and send no emails.
const { test, expect } = require('@playwright/test');

test('order form has every field and its button', async ({ page }) => {
  await page.goto('/order/');
  for (const label of ['Name', 'Email', 'Delivery postcode', 'Delivery address', 'What would you like?']) {
    await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Send order request' })).toBeVisible();
});

test('trade enquiry form has every field and its button', async ({ page }) => {
  await page.goto('/trade-enquiry/');
  for (const label of ['Name', 'Email', 'Business name', 'Delivery postcode', 'Tell us what you need']) {
    await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible();
});

test('track order page has a form', async ({ page }) => {
  await page.goto('/track/');
  await expect(page.locator('form').first()).toBeVisible();
  await expect(page.locator('form button[type="submit"], form input[type="submit"]').first()).toBeVisible();
});

test('an empty order form is not sent', async ({ page }) => {
  await page.goto('/order/');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Send order request' }) });
  const valid = await form.evaluate((f) => f.checkValidity());
  expect(valid, 'required fields stop an empty request').toBe(false);
});

test('My Account offers both sign in and create an account', async ({ page }) => {
  await page.goto('/my-account/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  const register = page.locator('form.woocommerce-form-register');
  await expect(register.locator('input[type="email"]')).toBeVisible();
  await expect(register.getByRole('button', { name: 'Create an account' })).toBeVisible();
  await expect(page.getByRole('link', { name: /lost your password/i })).toBeVisible();
});

test('staff sign-in shows the sign-in form', async ({ page }) => {
  await page.goto('/login/');
  await expect(page.locator('#loginform input[type="password"]')).toBeVisible();
  await expect(page.locator('#loginform input[type="submit"]')).toBeVisible();
});
