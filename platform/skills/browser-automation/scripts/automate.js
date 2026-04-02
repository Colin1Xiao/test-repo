const { chromium } = require('playwright');

async function automate(task) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // 示例：去URL，填表单
  await page.goto(task.url);
  await page.fill(task.selector, task.value);
  await page.click('button[type=submit]');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
}

// 用exec `node scripts/automate.js` 调用，传JSON参数。
