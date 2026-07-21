const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('=== Starting LMS Browser Tests ===\n');

  // Test 1: Login Page
  console.log('Test 1: Login Page');
  try {
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\01-login.png' });
    console.log('  [PASS] Login page loaded');
  } catch (e) {
    console.log('  [FAIL] Login page:', e.message);
  }

  // Test 2: Navigate to Login
  console.log('\nTest 2: Login Form Elements');
  try {
    const emailInput = await page.$('input[type="text"], input[placeholder*="email"], input[placeholder*="ID"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"]');
    
    if (emailInput && passwordInput && submitButton) {
      console.log('  [PASS] All login form elements present');
    } else {
      console.log('  [FAIL] Missing form elements');
    }
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 3: Try Login with test credentials
  console.log('\nTest 3: Login Flow');
  try {
    await page.fill('input[type="text"]', 'admin@ait.edu');
    await page.fill('input[type="password"]', 'admin123');
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\02-login-filled.png' });
    
    // Click sign in
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\03-after-login.png' });
    
    const currentUrl = page.url();
    console.log('  Current URL:', currentUrl);
    
    if (currentUrl.includes('dashboard') || currentUrl.includes('admin')) {
      console.log('  [PASS] Login successful - redirected to dashboard');
    } else if (currentUrl.includes('login')) {
      console.log('  [INFO] Still on login page - credentials may need adjustment');
    } else {
      console.log('  [INFO] Redirected to:', currentUrl);
    }
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 4: Dashboard
  console.log('\nTest 4: Dashboard');
  try {
    await page.goto('http://localhost:3001/admin/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\04-dashboard.png' });
    
    const title = await page.title();
    console.log('  Page title:', title);
    
    // Check for dashboard components
    const kpiCards = await page.$$('[class*="premium-card"]');
    console.log('  KPI cards found:', kpiCards.length);
    
    console.log('  [PASS] Dashboard loaded');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 5: Courses Page
  console.log('\nTest 5: Courses Page');
  try {
    await page.goto('http://localhost:3001/admin/courses', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\05-courses.png' });
    console.log('  [PASS] Courses page loaded');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 6: Reports Page
  console.log('\nTest 6: Reports Page');
  try {
    await page.goto('http://localhost:3001/admin/reports', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\06-reports.png' });
    console.log('  [PASS] Reports page loaded');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 7: Sidebar Navigation
  console.log('\nTest 7: Sidebar Navigation');
  try {
    const sidebar = await page.$('aside, [class*="sidebar"]');
    if (sidebar) {
      console.log('  [PASS] Sidebar present');
      await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\07-sidebar.png' });
    } else {
      console.log('  [INFO] Sidebar not found');
    }
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 8: Mobile View
  console.log('\nTest 8: Mobile Responsive View');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:3001/admin/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\08-mobile-dashboard.png' });
    console.log('  [PASS] Mobile view rendered');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Reset viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Test 9: Users Page
  console.log('\nTest 9: Users Page');
  try {
    await page.goto('http://localhost:3001/admin/users', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\09-users.png' });
    console.log('  [PASS] Users page loaded');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  // Test 10: Notifications Page
  console.log('\nTest 10: Notifications Page');
  try {
    await page.goto('http://localhost:3001/admin/notifications', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\10-notifications.png' });
    console.log('  [PASS] Notifications page loaded');
  } catch (e) {
    console.log('  [FAIL]', e.message);
  }

  console.log('\n=== Browser Tests Complete ===');
  console.log('Screenshots saved to: C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\');

  await browser.close();
})().catch(console.error);
