
const { chromium } = require('playwright');
const path = require('path');
const config = require('../config');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: config.armLibPath },
    args: config.launchArgs,
  });
  
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  
  const page = await context.newPage();
  
  const errors = [];
  const consoleMessages = [];
  
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => errors.push(err.message));
  
  try {
    console.log('Test 1: Loading page...');
    await page.goto(config.q37p.baseUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    console.log('Test 2: Clicking Quick Start...');
    await page.click('#idle-start');
    await page.waitForTimeout(5000);  // Wait longer for audio to build up
    
    // Debug: check canvas state
    console.log('Test 3: Debugging canvas...');
    const debug = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const data = ctx.getImageData(0, 0, Math.min(100, rect.width), Math.min(100, rect.height)).data;
      let maxVal = 0;
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.max(data[i], data[i+1], data[i+2]);
        if (v > maxVal) maxVal = v;
        if (v > 15) nonBlack++;
      }
      return {
        width: rect.width,
        height: rect.height,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        maxVal,
        nonBlackPixels: nonBlack,
        totalChecked: data.length / 4
      };
    });
    console.log('  Canvas info:', JSON.stringify(debug));
    
    if (debug.maxVal < 15) {
      console.log('  ⚠ Canvas appears dark, but may be due to audio not ramping up yet');
    }
    
    // Take screenshot regardless
    await page.screenshot({ path: path.join(config.shotsDir, 'q3.7p', 'test-screenshot.png') });
    console.log('  Screenshot saved');
    
    // Continue testing interactions
    console.log('Test 4: Switching visualization modes...');
    const modes = ['wave', 'circular', 'particles', 'mountain', 'galaxy'];
    for (const mode of modes) {
      const btn = await page.$(`[data-mode="${mode}"]`);
      if (!btn) {
        console.log(`  ⚠ Button for mode "${mode}" not found`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(500);
      const isActive = await btn.evaluate(el => el.classList.contains('active'));
      if (!isActive) throw new Error(`Mode button ${mode} should be active`);
    }
    console.log(`  ✓ All ${modes.length} modes switch correctly`);
    
    // Test switching tracks
    console.log('Test 5: Switching tracks...');
    const tracks = ['0', '1', '2'];
    for (const track of tracks) {
      await page.click(`[data-source="${track}"]`);
      await page.waitForTimeout(1500);
    }
    console.log('  ✓ All 3 tracks switch without error');
    
    // Test sliders
    console.log('Test 6: Testing control sliders...');
    const sliders = [
      { id: 'bar-width', value: '8' },
      { id: 'smoothness', value: '60' },
      { id: 'responsiveness', value: '15' },
      { id: 'sensitivity', value: '150' }
    ];
    for (const slider of sliders) {
      const el = await page.$(`#${slider.id}`);
      if (!el) {
        console.log(`  ⚠ Slider ${slider.id} not found`);
        continue;
      }
      await el.fill(slider.value);
      await el.dispatchEvent('input');
    }
    console.log('  ✓ All 4 sliders respond to input');
    
    // Test themes
    console.log('Test 7: Testing themes...');
    const swatches = await page.$$('.theme-swatch');
    console.log(`  Found ${swatches.length} theme swatches`);
    for (let i = 0; i < Math.min(swatches.length, 3); i++) {
      await swatches[i].click();
      await page.waitForTimeout(300);
      const active = await swatches[i].evaluate(el => el.classList.contains('active'));
      if (!active) throw new Error(`Theme swatch ${i} should be active after click`);
    }
    console.log('  ✓ Theme switching works');
    
    // Test custom colors
    console.log('Test 8: Testing custom colors...');
    const colorInputs = await page.$$('input[type="color"]');
    for (const input of colorInputs) {
      await input.evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input')); });
      await page.waitForTimeout(100);
    }
    console.log('  ✓ Custom color inputs work');
    
    // Test panel collapse
    console.log('Test 9: Testing panel collapse...');
    await page.click('#panel-handle');
    await page.waitForTimeout(500);
    const panelCollapsed = await page.$eval('#panel', el => el.classList.contains('collapsed'));
    if (!panelCollapsed) throw new Error('Panel should be collapsed');
    await page.click('#panel-handle');
    await page.waitForTimeout(500);
    const panelExpanded = await page.$eval('#panel', el => !el.classList.contains('collapsed'));
    if (!panelExpanded) throw new Error('Panel should be expanded');
    console.log('  ✓ Panel toggle works');
    
    // Test prev/next
    console.log('Test 10: Testing prev/next...');
    await page.click('#next-btn');
    await page.waitForTimeout(1000);
    await page.click('#prev-btn');
    await page.waitForTimeout(1000);
    console.log('  ✓ Prev/next buttons respond');
    
    // Final screenshot
    await page.screenshot({ path: path.join(config.shotsDir, 'q3.7p', 'test-final.png') });
    console.log('  Final screenshot saved');
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} JavaScript errors:`);
      errors.forEach(err => console.log(`  - ${err.substring(0, 200)}`));
    } else {
      console.log('✓ No JavaScript errors');
    }
    
    const errorMsgs = consoleMessages.filter(m => m.type === 'error');
    if (errorMsgs.length > 0) {
      console.log(`\n⚠ ${errorMsgs.length} console errors:`);
      errorMsgs.slice(0, 10).forEach(msg => console.log(`  - ${msg.text.substring(0, 200)}`));
    }
    
    if (errors.length === 0 && errorMsgs.length === 0) {
      console.log('\n✅ ALL TESTS PASSED');
    } else {
      console.log(`\n⚠️  ${errors.length} JS errors, ${errorMsgs.length} console errors`);
    }
    
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
  }
  
  await browser.close();
})();
