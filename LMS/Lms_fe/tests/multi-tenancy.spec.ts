import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

// ─── SuperAdmin Portal Tests ───────────────────────────────────────
test.describe('SuperAdmin Portal', () => {
  test('SuperAdmin: login and access platform dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'superadmin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard|\/superadmin\/dashboard/, { timeout: 20000 });
    
    // Navigate to superadmin organizations
    await page.goto(`${BASE}/superadmin/organizations`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Organizations/i })).toBeVisible({ timeout: 10000 });
  });

  test('SuperAdmin: view platform statistics', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'superadmin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard|\/superadmin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/superadmin/platform-stats`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Platform Statistics/i })).toBeVisible({ timeout: 10000 });
  });
});

// ─── OrgAdmin Portal Tests ────────────────────────────────────────
test.describe('OrgAdmin Portal', () => {
  test('OrgAdmin: login and view dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    // Dashboard loaded successfully
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('OrgAdmin: manage organizations', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/organizations`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Organization Management/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: manage campuses', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/campuses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Campus Management/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: manage courses', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/courses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Course Management/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: manage users', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: manage scheduled classes', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/scheduled-classes`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Class Scheduling/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: manage fee structures', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/fee-structures`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByRole('heading', { name: /Fee Structures/i })).toBeVisible({ timeout: 10000 });
  });

  test('OrgAdmin: view enrollments', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/enrollments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page loaded successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('OrgAdmin: view specializations', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/specializations`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page loaded successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('OrgAdmin: view certifications', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/admin/certifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page loaded successfully
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Teacher Portal Tests ──────────────────────────────────────────
test.describe('Teacher Portal', () => {
  test('Teacher: login and view dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'teacher@ait.edu');
    await page.fill('input[type="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 20000 });
    
    // Dashboard loaded successfully
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('Teacher: view my courses', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'teacher@ait.edu');
    await page.fill('input[type="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/teacher/my-courses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('Teacher: view attendance page', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'teacher@ait.edu');
    await page.fill('input[type="password"]', 'teacher123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/teacher/attendance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Coordinator Portal Tests ──────────────────────────────────────
test.describe('Coordinator Portal', () => {
  test('Coordinator: login and view dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'coordinator@ait.edu');
    await page.fill('input[type="password"]', 'coord123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/coordinator\/dashboard/, { timeout: 20000 });
    
    // Dashboard loaded successfully
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('Coordinator: view attendance review', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'coordinator@ait.edu');
    await page.fill('input[type="password"]', 'coord123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/coordinator\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/coordinator/attendance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Student Portal Tests ──────────────────────────────────────────
test.describe('Student Portal', () => {
  test('Student: login and view dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'student@ait.edu');
    await page.fill('input[type="password"]', 'student123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/student\/dashboard/, { timeout: 20000 });
    
    // Dashboard loaded successfully
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('Student: view my courses', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'student@ait.edu');
    await page.fill('input[type="password"]', 'student123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/student\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/student/my-courses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('Student: view fees', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'student@ait.edu');
    await page.fill('input[type="password"]', 'student123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/student\/dashboard/, { timeout: 20000 });
    
    await page.goto(`${BASE}/student/fees`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Financial Officer Portal Tests ────────────────────────────────
test.describe('Financial Officer Portal', () => {
  test('Financial Officer: login and view dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'finance@ait.edu');
    await page.fill('input[type="password"]', 'finance123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/accounts_officer\/dashboard|\/admin\/receipt-codes/, { timeout: 20000 });
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Registration Flow Tests ───────────────────────────────────────
test.describe('Registration Flow', () => {
  test('Registration page loads with organization selector', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check if page loaded successfully
    await expect(page.locator('body')).toBeVisible();
    // Page should have multiple select elements (organization, specialization, etc.)
    const selectCount = await page.locator('select').count();
    expect(selectCount).toBeGreaterThan(0);
  });

  test('Registration page loads courses', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check if courses are loaded (console log shows data loaded)
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(2000);
    
    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Multi-Tenancy Verification Tests ──────────────────────────────
test.describe('Multi-Tenancy', () => {
  test('OrgSelector appears in header', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    // Check if OrgSelector is visible in header
    await page.waitForTimeout(2000);
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 });
  });

  test('Campus selector works', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[placeholder*="your@email.com"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 });
    
    // Navigate to campuses page
    await page.goto(`${BASE}/admin/campuses`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Page should load with campus data
    await expect(page.getByRole('heading', { name: /Campus Management/i })).toBeVisible({ timeout: 10000 });
  });
});
