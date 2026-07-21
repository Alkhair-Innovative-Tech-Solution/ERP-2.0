const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Testing pages...\n');

  const pages = [
    { name: 'admin-dashboard', url: 'http://localhost:3001/admin/dashboard' },
    { name: 'courses', url: 'http://localhost:3001/admin/courses' },
    { name: 'enrollments', url: 'http://localhost:3001/admin/enrollments' },
    { name: 'users', url: 'http://localhost:3001/admin/users' },
    { name: 'reports', url: 'http://localhost:3001/admin/reports' },
    { name: 'notifications', url: 'http://localhost:3001/admin/notifications' },
  ];

  for (const p of pages) {
    try {
      errors.length = 0;
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `C:\\Users\\Rao Faizan\\Desktop\\AIT-LMS\\screenshots\\${p.name}.png` });
      
      const hasError = errors.some(e => e.includes('Error') || e.includes('error'));
      const hasContent = await page.$('main, [class*="content"], [class*="page"]');
      
      console.log(`${p.name}: ${hasContent ? 'OK' : 'EMPTY'} ${hasError ? '(has errors)' : ''}`);
      if (errors.length > 0) {
        console.log(`  Errors: ${errors.slice(0, 2).join('; ')}`);
      }
    } catch (e) {
      console.log(`${p.name}: FAILED - ${e.message}`);
    }
  }

  await browser.close();
})().catch(console.error);
