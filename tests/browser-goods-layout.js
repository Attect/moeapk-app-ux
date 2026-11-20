// 宅物固定方图 / 超宽增列 / 比例拼版 / 宽屏详情的真实 Chrome 几何回归。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9347;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-goods-layout-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function waitFor(fn, timeout = 15000, label = 'condition') {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
let ws;
let nextId = 1;
const pending = new Map();
const externalRequests = [];
const exceptions = [];
function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: ok, reject: bad } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) bad(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      } else if (msg.method === 'Network.requestWillBeSent') {
        const url = msg.params.request.url;
        if (/^https?:/i.test(url)) externalRequests.push(url);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails);
      }
    });
  });
}
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await waitFor(() => evaluate('document.readyState === "complete" && typeof nav === "object"'), 15000, 'page load');
  await sleep(250);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function frame(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await evaluate(`(() => {
    const p = document.querySelector('.phone');
    p.classList.remove('land');
    p.style.width = '${width}px'; p.style.height = '${height}px'; p.style.borderRadius = '0';
  })()`);
  await sleep(350);
}
async function showCat(withImages) {
  await evaluate(`(() => {
    DB.GOODS.forEach(g => { g.images = ${withImages ? "['assets/goods-ip-star-trail.svg']" : '[]'}; });
    nav.goTab('goods');
    nav.push('goods-cat', 'badge');
    const onboard = document.querySelector('.onboard'); if (onboard) onboard.click();
  })()`);
  await sleep(300);
  if (withImages) await waitFor(() => evaluate(`Array.from(document.querySelectorAll('.g-fall-card img')).every(img => img.complete)`), 10000, 'goods images');
}
async function listMetrics() {
  return evaluate(`(() => {
    const falls = document.querySelector('.g-falls');
    const cover = falls.querySelector('.g-cover');
    const img = cover.querySelector('img');
    const r = cover.getBoundingClientRect();
    return { columns: Number(getComputedStyle(falls).columnCount), width: r.width, height: r.height,
      objectFit: img ? getComputedStyle(img).objectFit : 'placeholder',
      horizontalOverflow: document.getElementById('content').scrollWidth > document.getElementById('content').clientWidth + 1 };
  })()`);
}
function expectedColumns(width) {
  const base = width >= 1040 ? 5 : width >= 760 ? 4 : width >= 520 ? 3 : 2;
  return Math.max(2, base, Math.ceil((Math.max(0, width - 32) + 10) / 250));
}
async function mosaicRatio() {
  return evaluate(`(() => {
    const r = document.querySelector('.g-mos-card').getBoundingClientRect();
    return { width: r.width, height: r.height, ratio: r.width / r.height };
  })()`);
}

(async () => {
  const report = { lists: [], mosaic: [], details: [] };
  try {
    const page = await waitFor(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        return r.ok ? (await r.json()).find(p => p.type === 'page') : null;
      } catch { return null; }
    }, 10000, 'CDP endpoint');
    await connect(page.webSocketDebuggerUrl);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 880, deviceScaleFactor: 1, mobile: false });
    await navigate(`${index}?theme=light&frame=port#goods`);
    assert(await evaluate(`location.protocol === 'file:'`), 'prototype must run over file://');

    for (const width of [360, 520, 760, 1040, 1280, 1600, 1920]) {
      await frame(width, 900);
      await showCat(false);
      const placeholder = await listMetrics();
      await showCat(true);
      const loaded = await listMetrics();
      const expected = expectedColumns(width);
      assert(placeholder.columns === expected && loaded.columns === expected,
        `${width}: columns ${placeholder.columns}/${loaded.columns}, expected ${expected}`);
      for (const [label, value] of [['placeholder', placeholder], ['loaded', loaded]]) {
        assert(Math.abs(value.width - value.height) <= 1, `${width}/${label}: cover is not square ${JSON.stringify(value)}`);
        assert(value.width <= 240.5, `${width}/${label}: oversized cover ${JSON.stringify(value)}`);
        assert(!value.horizontalOverflow, `${width}/${label}: horizontal overflow`);
      }
      assert(Math.abs(placeholder.width - loaded.width) <= 1 && Math.abs(placeholder.height - loaded.height) <= 1,
        `${width}: loading changed cover geometry ${JSON.stringify({ placeholder, loaded })}`);
      assert(loaded.objectFit === 'contain', `${width}: product image must be contain`);
      report.lists.push({ width, columns: expected, coverWidth: loaded.width, stable: true });
      if (width === 360) await shot('walk-goods-fixed-square-list-mobile-light.png');
      if (width === 1600) await shot('walk-goods-fixed-square-list-wide-light.png');
    }

    await frame(360, 800);
    await showCat(true);
    await evaluate(`theme.toggle()`);
    await sleep(250);
    await shot('walk-goods-fixed-square-list-mobile-dark.png');
    await evaluate(`theme.toggle()`);

    for (const width of [412, 1024]) {
      await frame(width, width === 412 ? 880 : 680);
      await evaluate(`nav.goTab('goods')`);
      await sleep(300);
      const value = await mosaicRatio();
      assert(Math.abs(value.ratio - 250 / 148) < 0.02, `${width}: mosaic ratio drift ${JSON.stringify(value)}`);
      report.mosaic.push({ width, ...value });
      await evaluate(`(() => {
        const onboard = document.querySelector('.onboard'); if (onboard) onboard.click();
        const mosaic = document.querySelector('.g-mosaic');
        document.getElementById('content').scrollTop = Math.max(0, mosaic.offsetTop - 110);
      })()`);
      await sleep(350);
      await shot(width === 412 ? 'walk-goods-fixed-square-home-portrait-light.png' : 'walk-goods-fixed-square-home-landscape-light.png');
    }

    await frame(1024, 680);
    await showCat(true);
    await evaluate(`nav.push('goods-detail', 'g01')`);
    await sleep(400);
    const wide = await evaluate(`(() => {
      const shot = document.querySelector('.g-shot').getBoundingClientRect();
      const title = document.querySelector('.g-d-title').getBoundingClientRect();
      const cta = document.querySelector('.g-cta').getBoundingClientRect();
      const phone = document.querySelector('.phone').getBoundingClientRect();
      return { shot: { left: shot.left, right: shot.right, bottom: shot.bottom, width: shot.width, height: shot.height },
        title: { left: title.left, top: title.top }, cta: { left: cta.left, right: cta.right, top: cta.top, bottom: cta.bottom },
        phone: { left: phone.left, right: phone.right, top: phone.top, bottom: phone.bottom },
        display: getComputedStyle(document.querySelector('.g-detail-layout')).display };
    })()`);
    assert(wide.display === 'grid', `wide detail must be two-pane: ${JSON.stringify(wide)}`);
    assert(Math.abs(wide.shot.width - wide.shot.height) <= 1, 'wide detail shot is not square');
    assert(wide.shot.bottom <= wide.phone.bottom + 1, `wide detail shot exceeds viewport ${JSON.stringify(wide)}`);
    assert(wide.title.left >= wide.shot.right, `wide detail title is not in the right pane ${JSON.stringify(wide)}`);
    assert(wide.title.top >= wide.phone.top && wide.title.top < wide.phone.bottom, 'wide detail title is outside viewport');
    assert(wide.cta.left >= wide.shot.right && wide.cta.bottom <= wide.phone.bottom + 1, 'wide detail CTA is misplaced');
    report.details.push({ width: 1024, height: 680, ...wide });
    await shot('walk-goods-fixed-square-detail-landscape-light.png');

    await frame(412, 880);
    await evaluate(`nav.push('goods-detail', 'g02')`);
    await sleep(350);
    const compact = await evaluate(`(() => {
      const r = document.querySelector('.g-shot').getBoundingClientRect();
      return { width: r.width, height: r.height, display: getComputedStyle(document.querySelector('.g-detail-layout')).display };
    })()`);
    assert(compact.display !== 'grid' && Math.abs(compact.width - compact.height) <= 1, `compact detail changed: ${JSON.stringify(compact)}`);
    report.details.push({ width: 412, height: 880, ...compact });
    await shot('walk-goods-fixed-square-detail-portrait-light.png');

    assert(!externalRequests.length, `external requests: ${externalRequests.join(',')}`);
    assert(!exceptions.length, `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests = 0;
    report.exceptions = 0;
    console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(err => {
  console.error(err.stack || err);
  process.exitCode = 1;
});
