// 零依赖 Chrome CDP 走查：图片模型样例缩略图、512/1024 原图与既有查看器复用。
// 运行：node tests/browser-model-samples.js（可用 CHROME_PATH 指定 Chrome）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9357;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-model-samples-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 15000, label = 'condition') {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(80);
  }
  throw new Error(`timeout: ${label}`);
}
let ws, nextId = 1;
const pending = new Map(), externalRequests = [], exceptions = [];
function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
      } else if (msg.method === 'Network.requestWillBeSent') {
        const url = msg.params.request.url;
        if (/^https?:/i.test(url)) externalRequests.push(url);
      } else if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails);
    });
  });
}
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function click(selector) {
  const ok = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.click(); return true; })()`);
  assert(ok, `missing click target: ${selector}`);
  await sleep(120);
}
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(350);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function viewerReady() {
  await waitFor(() => evaluate(`(() => { const img=document.querySelector('.diff-viewer-image'); return !!img && img.complete && img.naturalWidth>0; })()`), 10000, 'sample original image');
}
async function viewerMetrics() {
  return evaluate(`(() => { const stage=document.querySelector('.diff-viewer-stage'), img=document.querySelector('.diff-viewer-image');
    const s=stage.getBoundingClientRect(), r=img.getBoundingClientRect();
    return { natural:[img.naturalWidth,img.naturalHeight], shown:[r.width,r.height], stage:[s.left,s.top,s.right,s.bottom],
      inside:r.left>=s.left-1&&r.top>=s.top-1&&r.right<=s.right+1&&r.bottom<=s.bottom+1,
      mode:stage.className, scrollWidth:stage.scrollWidth,clientWidth:stage.clientWidth,
      scrollHeight:stage.scrollHeight,clientHeight:stage.clientHeight,
      src:img.getAttribute('src'),infoShown:document.querySelector('.diff-viewer').textContent.includes('.json') }; })()`);
}

(async () => {
  const report = { checks: [] };
  const ok = (name, detail) => report.checks.push({ name, detail: detail == null ? true : detail });
  try {
    const page = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        return response.ok ? (await response.json()).find(p => p.type === 'page') : null;
      } catch { return null; }
    }, 10000, 'CDP endpoint');
    await connect(page.webSocketDebuggerUrl);
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await metrics(412, 860);
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await send('Page.navigate', { url: `${index}?theme=light&frame=port#ai/models` });
    await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.mdl-page')`), 15000, 'model hub');
    await click('[data-a="mdl-cat"][data-arg="diffusion"]');
    await evaluate(`document.querySelector('.model-item[data-model-id="anything-v5-mnn"]').scrollIntoView({block:'center'})`);
    await waitFor(() => evaluate(`[...document.querySelectorAll('.model-item .model-sample img')].every(img=>img.complete&&img.naturalWidth===200&&img.naturalHeight===200)`), 10000, '200px thumbnails');

    report.hub = await evaluate(`(() => { const counts={};
      for(const id of ['anything-v5-mnn','animagine-v4-sdxl','chillout-mix-qnn']) {
        const item=document.querySelector('.model-item[data-model-id="'+id+'"]');
        counts[id]={buttons:item.querySelectorAll('.model-sample').length,containers:item.querySelectorAll('.model-samples').length};
      }
      const squares=[...document.querySelectorAll('.model-item .model-sample')].map(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1&&r.width>0});
      const sources=[...document.querySelectorAll('.model-item .model-sample img')].map(img=>({src:img.getAttribute('src'),natural:[img.naturalWidth,img.naturalHeight]}));
      return {counts,squares,sources,overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
    assert.equal(report.hub.counts['anything-v5-mnn'].buttons, 4);
    assert.equal(report.hub.counts['animagine-v4-sdxl'].buttons, 3);
    assert.deepEqual(report.hub.counts['chillout-mix-qnn'], { buttons: 0, containers: 0 });
    assert(report.hub.squares.every(Boolean) && !report.hub.overflow);
    assert(report.hub.sources.every(x => x.natural[0] === 200 && x.natural[1] === 200 && x.src.includes('-200.webp')));
    await shot('walk-model-samples-hub-light.png');
    ok('模型中心各条目独立显示最多四张 200×200 方形缩略图，无样例无容器', report.hub);

    await click('.model-item[data-model-id="anything-v5-mnn"] [data-arg="sample:anything-v5-mnn:1"]');
    await viewerReady();
    report.fit512 = await viewerMetrics();
    assert.deepEqual(report.fit512.natural, [512, 512]);
    assert(report.fit512.inside && report.fit512.mode.includes('fit') && !report.fit512.mode.includes('original'));
    assert(report.fit512.src.endsWith('anything-v5-rain-512.webp') && !report.fit512.infoShown);
    assert.equal(await evaluate(`nav.current().page`), 'diff-image');
    assert((await evaluate(`location.hash`)).includes('sample:anything-v5-mnn:1'));
    await shot('walk-model-sample-viewer-512-light.png');
    await click('.diff-viewer-actions [data-a="diff-view-zoom"]');
    report.original512 = await viewerMetrics();
    assert.deepEqual(report.original512.shown, [512, 512]);
    assert(report.original512.mode.includes('original') && report.original512.scrollWidth > report.original512.clientWidth);
    assert(await evaluate(`(() => { const s=document.querySelector('.diff-viewer-stage'); s.scrollLeft=50; return s.scrollLeft>0; })()`));
    await click('.diff-viewer-actions [data-a="diff-view-zoom"]');
    assert((await viewerMetrics()).mode.includes('fit'));
    await click('.diff-viewer-head [data-a="back"]');
    assert.equal(await evaluate(`nav.current().page`), 'models');
    assert.equal(await evaluate(`document.querySelectorAll('.model-item[data-model-id="anything-v5-mnn"] .model-sample').length`), 4);
    ok('512 原图默认适配视口，可切原始尺寸滚动查看并返回模型中心', { fit: report.fit512, original: report.original512 });

    await evaluate(`nav.push('diffusion')`); await sleep(250);
    report.wizard = await evaluate(`(() => { const root=document.querySelector('.diff-step[data-step="0"]'); return {
      anything:root.querySelectorAll('.diff-model[data-model-id="anything-v5-mnn"] .model-sample').length,
      animagine:root.querySelectorAll('.diff-model[data-model-id="animagine-v4-sdxl"] .model-sample').length,
      chillout:root.querySelectorAll('.diff-model[data-model-id="chillout-mix-qnn"] .model-samples').length }; })()`);
    assert.deepEqual(report.wizard, { anything: 4, animagine: 3, chillout: 0 });
    await click('.diff-step[data-step="0"] .diff-model[data-model-id="animagine-v4-sdxl"] [data-arg="sample:animagine-v4-sdxl:0"]');
    await viewerReady();
    report.fit1024 = await viewerMetrics();
    assert.deepEqual(report.fit1024.natural, [1024, 1024]);
    assert(report.fit1024.inside && report.fit1024.shown[0] < 1024);
    await click('.diff-viewer-actions [data-a="diff-view-zoom"]');
    report.original1024 = await viewerMetrics();
    assert.deepEqual(report.original1024.shown, [1024, 1024]);
    assert(report.original1024.scrollWidth > report.original1024.clientWidth && report.original1024.scrollHeight > report.original1024.clientHeight);
    await click('.diff-viewer-head [data-a="back"]');
    assert.equal(await evaluate(`nav.current().page`), 'diffusion');
    ok('生图向导复用相同样例与查看器，1024 原图支持适应和原始尺寸', { counts: report.wizard, fit: report.fit1024, original: report.original1024 });

    await evaluate(`nav.pop()`); await sleep(150);
    await click('[data-a="theme-toggle"]');
    assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
    await shot('walk-model-samples-hub-dark.png');
    await click('[data-a="frame-toggle"]');
    await metrics(1024, 680);
    report.landscape = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,
      squares:[...document.querySelectorAll('.model-item .model-sample')].every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1}),
      rail:document.querySelector('.phone').classList.contains('land')})`);
    assert(!report.landscape.overflow && report.landscape.squares && report.landscape.rail);
    await evaluate(`nav.push('diffusion')`); await sleep(300);
    await shot('walk-model-samples-wizard-dark-landscape.png');
    await click('.diff-step[data-step="0"] .diff-model[data-model-id="animagine-v4-sdxl"] [data-arg="sample:animagine-v4-sdxl:0"]');
    await viewerReady();
    assert((await viewerMetrics()).inside);
    await shot('walk-model-sample-viewer-1024-dark-landscape.png');
    await click('.diff-viewer-head [data-a="back"]');
    await evaluate(`nav.pop()`); await sleep(150);
    ok('暗色主题与 1024×680 横屏下缩略图和原图均适配', report.landscape);

    await click('[data-a="frame-toggle"]');
    await metrics(360, 780);
    report.narrow = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,
      squares:[...document.querySelectorAll('.model-item .model-sample')].every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1&&r.width>0})})`);
    assert(!report.narrow.overflow && report.narrow.squares);
    await shot('walk-model-samples-hub-narrow-dark.png');
    ok('360px 窄屏无横向溢出，缩略图保持正方形', report.narrow);

    assert.deepEqual(externalRequests, [], `external requests: ${externalRequests.join(',')}`);
    assert.deepEqual(exceptions, [], `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests = 0; report.exceptions = 0;
    console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
