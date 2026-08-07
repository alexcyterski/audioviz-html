
const { chromium } = require('playwright');
const config = require('../config');

(async () => {
  const browser = await chromium.launch({ headless: true, args: config.launchArgs });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  
  const errors = [];
  const consoleMessages = [];
  
  page.on('pageerror', error => { errors.push(error.message); });
  page.on('console', msg => { consoleMessages.push({ type: msg.type(), text: msg.text() }); });
  
  // Load page
  await page.goto(config.q37p.baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Test 1: Quick Start button
  console.log('Test 1: Clicking Quick Start...');
  await page.click('#idle-start');
  await page.waitForTimeout(2000);
  
  // Test 2: Check for audio context
  const hasAudio = await page.evaluate(() => {
    return typeof window.AudioContext !== 'undefined';
  });
  console.log('AudioContext available:', hasAudio);
  
  // Test 3: Switch visualization modes
  console.log('Test 3: Switching viz modes...');
  const modes = ['bars', 'wave', 'circular', 'particles', 'mountain', 'galaxy'];
  for (const mode of modes) {
    await page.click(`[data-mode="${mode}"]`);
    await page.waitForTimeout(500);
  }
  
  // Test 4: Switch tracks
  console.log('Test 4: Switching tracks...');
  await page.click('[data-source="0"]');
  await page.waitForTimeout(1000);
  await page.click('[data-source="1"]');
  await page.waitForTimeout(1000);
  
  // Test 5: Check sliders
  console.log('Test 5: Testing sliders...');
  await page.evaluate(() => {
    document.getElementById('bar-width').value = '8';
    document.getElementById('bar-width').dispatchEvent(new Event('input'));
    document.getElementById('sensitivity').value = '150';
    document.getElementById('sensitivity').dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(1000);
  
  // Test 6: Take screenshot
  await page.screenshot({ path: '/tmp/waveform_test.png', fullPage: false });
  console.log('Screenshot saved');
  
  // Summary
  console.log('\n=== TEST RESULTS ===');
  console.log('JS Errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }
  
  const errorMessages = consoleMessages.filter(m => m.type === 'error');
  console.log('Console Errors:', errorMessages.length);
  errorMessages.forEach((m, i) => console.log(`  ${i+1}. ${m.text}`));
  
  const warnings = consoleMessages.filter(m => m.type === 'warning');
  console.log('Console Warnings:', warnings.length);
  
  await browser.close();
})();
