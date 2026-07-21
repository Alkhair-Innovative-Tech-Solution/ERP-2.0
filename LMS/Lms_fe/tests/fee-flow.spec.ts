import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test('Admin: login & view fee collection', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });

  await page.goto(`${BASE}/admin/fee-collection`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Today.*Collection/i).first()).toBeVisible({ timeout: 10000 });
});

test('Student: login & view fees', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[placeholder*="your@email.com"]', 'prankerteam496@gmail.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student\/dashboard/, { timeout: 20000 });

  await page.goto(`${BASE}/student/fees`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  await expect(page.getByRole('heading', { name: /My Fees/i })).toBeVisible({ timeout: 10000 });
  // Page loaded successfully with the fees heading
});
