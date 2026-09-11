// Optional real-browser QA. Uses externally provided Playwright, not an app dependency.
// NODE_PATH may point at the desktop's bundled node_modules. No real accounts.
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  let body = fs.readFileSync(file);
  if (name === '/js/cloud.js') body = body.toString().split('(function () {')[0] + `
    window.qaCloud={status:'pending',dirty:true,online:true,stamp:'',confirmedAt:''};
    window.Cloud={getLastUid:()=> 'qa',configured:()=>false,syncState:()=>({...qaCloud}),
      onLocalChange:()=>{},resume:async()=>{qaCloud.status='synced';qaCloud.dirty=false;qaCloud.confirmedAt=new Date().toISOString();window.dispatchEvent(new CustomEvent('vault:sync-state'));return 'synced';}};`;
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => typeof navigate === 'function');
    for (const [lang, theme] of [['ar', 'dark'], ['en', 'light']]) {
      await page.evaluate(({ lang, theme }) => {
        DB.prefs.setLang(lang); DB.prefs.setTheme(theme); DB.prefs.setOnboarded();
        applyLang(lang); applyTheme(theme); hideAuthGate();
        document.getElementById('onboard-gate')?.remove();
        navigate('settings');
      }, { lang, theme });
      for (const status of ['pending', 'syncing', 'synced', 'offline', 'signin', 'conflict', 'blocked', 'error']) {
        await page.evaluate(status => {
          qaCloud.status = status; qaCloud.online = status !== 'offline';
          window.dispatchEvent(new CustomEvent('vault:sync-state'));
        }, status);
        await page.waitForFunction(status => document.getElementById('save-center').dataset.state === status, status);
        const size = await page.locator('#save-center').evaluate(el => ({ scroll: el.scrollWidth, width: el.clientWidth, text: el.innerText }));
        assert.ok(size.scroll <= size.width + 1, `${lang}/${status}: card overflow`);
        assert.ok(!size.text.includes('undefined'), 'all copy resolves');
      }
      await page.evaluate(() => { qaCloud.status = 'pending'; qaCloud.online = true; updateSaveCenter(); });
      await page.locator('#sc-action').click();
      await page.waitForFunction(() => document.getElementById('save-center').dataset.state === 'synced');
      await page.evaluate(() => { STATE_LOAD_FAILED = true; updateSaveCenter(); });
      assert.equal(await page.locator('#save-center').getAttribute('data-state'), 'failed');
      assert.equal(await page.locator('#sc-action').getAttribute('data-action'), 'export');
      await page.evaluate(() => { STATE_LOAD_FAILED = false; updateSaveCenter(); });
      if (process.env.QA_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
        await page.locator('#save-center').screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, `save-center-${lang}.png`) });
      }
    }
    await require('./test-convenience-ui')(page);
    assert.deepEqual(errors, []);
    console.log('PASS browser: AR/dark + EN/light, 390px, eight cloud states, retry, local failure precedence, no page errors');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
