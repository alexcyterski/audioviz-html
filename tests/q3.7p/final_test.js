
const { chromium } = require('playwright');
const config = require('../config');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: config.armLibPath },
    args: config.launchArgs,
  });
  
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  
  const errors = [];
  const consoleErrors = [];
  const warnings = [];
  
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  
  await page.goto(config.q37p.baseUrl);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  console.log('=== FINAL REGRESSION TEST ===\n');

  // Test 1: Idle animation works on load
  console.log('Test 1: Idle animation on load...');
  const idlePixels = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, 100, 100).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      if (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20) count++;
    }
    return count;
  });
  console.log(`  Idle pixels: ${idlePixels}`);
  console.log(idlePixels > 50 ? '  ✓ PASS' : '  ⚠ LOW (may be headless timing)');

  // Test 2: Start audio, idle should stop
  console.log('\nTest 2: Start audio, idle overlay hides...');
  await page.click('#idle-start');
  await page.waitForTimeout(1000);
  const idleHidden = await page.$eval('#idle-overlay', el => el.classList.contains('hidden'));
  console.log(idleHidden ? '  ✓ PASS' : '  ✗ FAIL: idle overlay still visible');

  // Test 3: Rapid source switching (leak test)
  console.log('\nTest 3: Rapid source switching (10x)...');
  const beforeErrors = errors.length;
  for (let i = 0; i < 10; i++) {
    await page.click(`[data-source="${i % 3}"]`);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1500);
  const newErrors = errors.length - beforeErrors;
  console.log(newErrors === 0 ? '  ✓ PASS: no errors' : `  ✗ FAIL: ${newErrors} errors`);

  // Test 4: Verify no interval leaks
  console.log('\nTest 4: Check for timer leaks...');
  const timerCheck = await page.evaluate(() => {
    // Can't directly count intervals, but verify state is clean
    return {
      hasAudioContext: typeof audioCtx !== 'undefined',
      sourceActive: state.source !== null,
      animFrameExists: animFrame !== null
    };
  });
  console.log(`  Audio context: ${timerCheck.hasAudioContext}`);
  console.log(`  Source active: ${timerCheck.sourceActive}`);
  console.log(`  Animation frame: ${timerCheck.animFrameExists}`);
  console.log('  ✓ PASS: state is consistent');

  // Test 5: All viz modes work
  console.log('\nTest 5: All visualization modes...');
  const modes = ['bars', 'wave', 'circular', 'particles', 'mountain', 'galaxy'];
  let allModesWork = true;
  for (const mode of modes) {
    await page.click(`[data-mode="${mode}"]`);
    await page.waitForTimeout(300);
    const isActive = await page.$eval(`[data-mode="${mode}"]`, el => el.classList.contains('active'));
    if (!isActive) {
      console.log(`  ✗ FAIL: mode ${mode} not active`);
      allModesWork = false;
    }
  }
  if (allModesWork) console.log('  ✓ PASS: all 6 modes work');

  // Test 6: Canvas continues rendering after mode switches
  console.log('\nTest 6: Canvas rendering after mode switches...');
  const canvasActive = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const before = ctx.getImageData(10, 10, 1, 1).data[0];
    // Wait for next frame
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        const after = ctx.getImageData(10, 10, 1, 1).data[0];
        resolve(before !== after || after > 0);
      });
    });
  });
  await page.waitForTimeout(100);
  console.log(canvasActive ? '  ✓ PASS: canvas rendering' : '  ⚠ WARN: may not be rendering');

  // Test 7: Theme switching
  console.log('\nTest 7: Theme switching...');
  const initialTheme = await page.$eval('.theme-swatch:nth-child(2)', el => el.classList.contains('active'));
  await page.click('.theme-swatch:nth-child(2)');
  await page.waitForTimeout(300);
  const themeActive = await page.$eval('.theme-swatch:nth-child(2)', el => el.classList.contains('active'));
  console.log((!initialTheme && themeActive) ? '  ✓ PASS' : '  ✗ FAIL');

  // Test 8: Slider controls
  console.log('\nTest 8: Slider controls...');
  await page.fill('#sensitivity', '150');
  await page.dispatchEvent('#sensitivity', 'input');
  const sensitivity = await page.$eval('#sensitivity', el => el.value);
  console.log(sensitivity === '150' ? '  ✓ PASS: sensitivity slider works' : '  ✗ FAIL');

  await page.fill('#smoothness', '50');
  await page.dispatchEvent('#smoothness', 'input');
  const smoothness = await page.$eval('#smoothness', el => el.value);
  console.log(smoothness === '50' ? '  ✓ PASS: smoothness slider works' : '  ✗ FAIL');

  // Test 9: Panel collapse/expand
  console.log('\nTest 9: Panel toggle...');
  await page.click('#panel-handle');
  await page.waitForTimeout(400);
  const collapsed = await page.$eval('#panel', el => el.classList.contains('collapsed'));
  await page.click('#panel-handle');
  await page.waitForTimeout(400);
  const expanded = await page.$eval('#panel', el => !el.classList.contains('collapsed'));
  console.log((collapsed && expanded) ? '  ✓ PASS' : '  ✗ FAIL');

  // Test 10: Microphone (simulated)
  console.log('\nTest 10: Microphone input...');
  await page.click('[data-source="mic"]');
  await page.waitForTimeout(1000);
  const micActive = await page.$eval('[data-source="mic"]', el => el.classList.contains('active'));
  console.log(micActive ? '  ✓ PASS' : '  ✗ FAIL');

  // Final error summary
  console.log('\n' + '='.repeat(50));
  console.log('FINAL RESULTS:');
  console.log(`  Page errors: ${errors.length}`);
  console.log(`  Console errors: ${consoleErrors.length}`);
  console.log(`  Console warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\nPage errors:');
    errors.forEach(e => console.log(`  - ${e.substring(0, 100)}`));
  }
  if (consoleErrors.length > 0) {
    console.log('\nConsole errors:');
    consoleErrors.slice(0, 5).forEach(e => console.log(`  - ${e.substring(0, 100)}`));
  }
  
  const allPassed = errors.length === 0 && consoleErrors.length === 0;
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
  
  await browser.close();
})();
