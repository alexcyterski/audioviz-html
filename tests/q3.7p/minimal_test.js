
const { chromium } = require('playwright');
const config = require('../config');

(async () => {
  console.log('Launching browser...');
  try {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('Page created');
    
    await page.goto(config.q37p.baseUrl);
    console.log('Page loaded');
    
    await page.waitForTimeout(1000);
    console.log('Waited 1 second');
    
    await browser.close();
    console.log('Browser closed successfully');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
})();
