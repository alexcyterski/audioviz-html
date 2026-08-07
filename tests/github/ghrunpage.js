const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const RUN = process.argv[2] || '31120623365';
  await page.goto(`https://github.com/alexcyterski/waveform-DSV4F/actions/runs/${RUN}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(5000);
  const text = await page.evaluate(() => document.body.innerText);
  const keywords = ['awaiting', 'queued', 'in progress', 'completed', 'success', 'failure', 'error', 'job', 'cancel'];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log('--- lines containing status keywords ---');
  for (const l of lines) {
    if (keywords.some((k) => l.toLowerCase().includes(k))) console.log(l.slice(0, 160));
  }
  console.log('--- first 15 lines ---');
  console.log(lines.slice(0, 15).join('\n'));
  await browser.close();
})();
