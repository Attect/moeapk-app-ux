// 零依赖 Chrome CDP 走查：模型样例直接复用素材查看器的 chrome、分页与缩放手势。
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
    await sleep(70);
  }
  throw new Error(`timeout: ${label}`);
}
let ws, nextId = 1;
const pending = new Map(), externalRequests = [], infoRequests = [], exceptions = [];
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
        if (/model-samples\/[^/]+\.json(?:$|\?)/i.test(url)) infoRequests.push(url);
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
async function point(selector) {
  return evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
}
async function mouse(type, p, clickCount = 1) {
  await send('Input.dispatchMouseEvent', { type, ...p, button: 'left', clickCount });
}
async function clickAt(p) { await mouse('mousePressed', p); await sleep(35); await mouse('mouseReleased', p); }
async function clickSelector(selector) { await clickAt(await point(selector)); }
async function doubleClickAt(p) {
  await clickAt(p); await sleep(65); await mouse('mousePressed', p, 2); await sleep(35); await mouse('mouseReleased', p, 2);
}
async function touch(type, points) {
  await send('Input.dispatchTouchEvent', { type,
    touchPoints: points.map((p, i) => ({ x:p.x, y:p.y, id:p.id == null ? i : p.id })) });
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
  await waitFor(() => evaluate(`(() => { const img=document.querySelector('.av-page[data-pos="0"] .av-image'), p=document.querySelector('.av-page[data-pos="0"] .av-picture');
    return !!img && !!p && img.complete && img.naturalWidth>0 && p.dataset.pixelWidth===String(img.naturalWidth); })()`), 10000, 'asset sample original');
  await sleep(80);
}
async function sampleMetrics() {
  return evaluate(`(() => { const pager=document.querySelector('.av-pager'), picture=document.querySelector('.av-page[data-pos="0"] .av-picture'),
    img=picture.querySelector('.av-image'), p=pager.getBoundingClientRect(), r=picture.getBoundingClientRect(), toolbar=document.querySelector('.av-toolbar');
    return { page:nav.current().page,id:S.x.viewId,counter:document.querySelector('.av-counter').textContent,
      natural:[img.naturalWidth,img.naturalHeight],pixel:[+picture.dataset.pixelWidth,+picture.dataset.pixelHeight],
      shown:[r.width,r.height],inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1,
      sources:[...document.querySelectorAll('.av-page .av-image')].map(x=>x.getAttribute('src')),
      tools:[...toolbar.querySelectorAll('.tool-label')].map(x=>x.textContent),toolbarBg:getComputedStyle(toolbar).backgroundColor,
      toolbarBlur:getComputedStyle(toolbar).backdropFilter,back:!!document.querySelector('.av-back'),
      left:!!document.querySelector('.av-nav.left'),right:!!document.querySelector('.av-nav.right'),
      diffViewer:!!document.querySelector('.diff-viewer'),originalButton:document.querySelector('.av-stage').textContent.includes('原始尺寸'),
      infoShown:document.querySelector('.av-stage').textContent.includes('.json') }; })()`);
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
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
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
      return {counts,squares:[...document.querySelectorAll('.model-item .model-sample')].every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1&&r.width>0}),
        sources:[...document.querySelectorAll('.model-item .model-sample img')].map(img=>({src:img.getAttribute('src'),natural:[img.naturalWidth,img.naturalHeight]})),
        overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
    assert.equal(report.hub.counts['anything-v5-mnn'].buttons, 4);
    assert.equal(report.hub.counts['animagine-v4-sdxl'].buttons, 3);
    // 同一模型的多个权重包已合并为一行：四张预览只出现一次（跨变体去重）
    assert.deepEqual(report.hub.counts['chillout-mix-qnn'], { buttons: 4, containers: 1 });
    assert(report.hub.squares && !report.hub.overflow);
    assert(report.hub.sources.every(x => x.natural[0] === 200 && x.natural[1] === 200 && x.src.includes('-200.webp')));
    await shot('walk-model-samples-hub-light.png');
    ok('模型中心只加载 200×200 thumb，权重包合并后相同预览只留一份', report.hub);

    await click('.model-item[data-model-id="anything-v5-mnn"] [data-arg="sample:anything-v5-mnn:1"]');
    await viewerReady();
    report.asset512 = await sampleMetrics();
    assert.equal(report.asset512.page, 'asset');
    assert.equal(report.asset512.counter.trim(), '2 / 4 · 图片');
    assert.deepEqual(report.asset512.natural, [512, 512]);
    assert.deepEqual(report.asset512.pixel, [512, 512]);
    assert(report.asset512.inside && report.asset512.back && report.asset512.left && report.asset512.right);
    assert.deepEqual(report.asset512.tools, ['分享', '详情']);
    assert(report.asset512.sources.every(src => src.includes('-512.webp') && !src.includes('-200.webp')));
    assert(!report.asset512.diffViewer && !report.asset512.originalButton && !report.asset512.infoShown);
    assert.equal(report.asset512.toolbarBg, 'rgba(18, 14, 30, 0.52)');
    assert(report.asset512.toolbarBlur.includes('blur(14px)'));
    await shot('walk-model-sample-viewer-512-light.png');
    ok('样例直接使用素材暗色舞台、返回、计数、左右键与玻璃工具区', report.asset512);

    const center = await point('.av-page[data-pos="0"] .av-media');
    await clickAt(center); await sleep(390);
    await waitFor(() => evaluate(`getComputedStyle(document.querySelector('.av-toolbar')).opacity==='0'`), 2000, 'sample chrome fade out');
    report.singleHide = await evaluate(`(() => ({hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden'),
      opacity:getComputedStyle(document.querySelector('.av-toolbar')).opacity,inert:document.querySelector('.av-toolbar').inert,
      backInert:document.querySelector('.av-back').inert,scale:S.x.avZoom.scale}))()`);
    assert(report.singleHide.hidden && report.singleHide.opacity === '0' && report.singleHide.inert && report.singleHide.backInert && report.singleHide.scale === 1,
      `single tap chrome mismatch: ${JSON.stringify(report.singleHide)}`);
    await shot('walk-model-sample-viewer-hidden.png');
    await clickAt(center); await sleep(390);
    assert(await evaluate(`!document.querySelector('.av-stage').classList.contains('chrome-hidden') && !document.querySelector('.av-toolbar').inert`));
    ok('单击显隐素材 chrome，隐藏层同步 inert', report.singleHide);

    const baseLayout = await evaluate(`(() => { const m=document.querySelector('.av-page[data-pos="0"] .av-picture');
      return [m.style.left,m.style.top,m.style.width,m.style.height].join(';'); })()`);
    await doubleClickAt(center); await sleep(340);
    report.doubleZoom = await evaluate(`(() => { const m=document.querySelector('.av-page[data-pos="0"] .av-picture');
      return {scale:S.x.avZoom.scale,id:S.x.viewId,hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden'),
        stableBase:[m.style.left,m.style.top,m.style.width,m.style.height].join(';'),transform:m.style.transform}; })()`);
    assert(report.doubleZoom.scale === 2.5 && report.doubleZoom.hidden && report.doubleZoom.stableBase === baseLayout);
    assert(report.doubleZoom.id === 'sample:anything-v5-mnn:1');
    await shot('walk-model-sample-viewer-double-zoom.png');
    await doubleClickAt(center); await sleep(320);
    assert(await evaluate(`S.x.avZoom.scale===1 && !document.querySelector('.av-stage').classList.contains('chrome-hidden')`));
    ok('双击 1×/2.5× 缩放复用素材连续几何与 chrome 规则', report.doubleZoom);

    const rect = await evaluate(`(() => { const r=document.querySelector('.av-pager').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}; })()`);
    const pinchCenter = { x:rect.x+rect.w/2, y:rect.y+rect.h/2 };
    await touch('touchStart', [{x:pinchCenter.x-40,y:pinchCenter.y,id:0},{x:pinchCenter.x+40,y:pinchCenter.y,id:1}]);
    await touch('touchMove', [{x:pinchCenter.x-90,y:pinchCenter.y,id:0},{x:pinchCenter.x+90,y:pinchCenter.y,id:1}]);
    await sleep(90);
    report.pinch = await evaluate(`({scale:S.x.avZoom.scale,id:S.x.viewId,hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden')})`);
    assert(report.pinch.scale > 1.8 && report.pinch.id === 'sample:anything-v5-mnn:1' && report.pinch.hidden);
    await touch('touchEnd', []); await sleep(80);
    await touch('touchStart', [{x:pinchCenter.x,y:pinchCenter.y,id:0}]);
    await touch('touchMove', [{x:pinchCenter.x+42,y:pinchCenter.y+20,id:0}]);
    await touch('touchEnd', []); await sleep(90);
    report.zoomPan = await evaluate(`({x:S.x.avZoom.x,y:S.x.avZoom.y,id:S.x.viewId,scale:S.x.avZoom.scale})`);
    assert(report.zoomPan.scale > 1 && Math.abs(report.zoomPan.x) > 10 && report.zoomPan.id === 'sample:anything-v5-mnn:1');
    await doubleClickAt(center); await sleep(320);
    ok('双指缩放与放大后单指平移不切页', { pinch:report.pinch, pan:report.zoomPan });

    await clickSelector('.av-nav.right'); await sleep(460); await viewerReady();
    assert.equal(await evaluate(`S.x.viewId`), 'sample:anything-v5-mnn:2');
    await clickSelector('.av-nav.left'); await sleep(460); await viewerReady();
    assert.equal(await evaluate(`S.x.viewId`), 'sample:anything-v5-mnn:1');
    await clickSelector('.av-nav.left'); await sleep(460); await viewerReady();
    assert.equal(await evaluate(`S.x.viewId`), 'sample:anything-v5-mnn:0');

    report.swipes = [];
    for (let target = 1; target <= 3; target++) {
      const start = { x:pinchCenter.x+80, y:pinchCenter.y };
      await touch('touchStart', [{...start,id:0}]);
      await touch('touchMove', [{x:start.x-60,y:start.y,id:0}]);
      await touch('touchMove', [{x:start.x-140,y:start.y,id:0}]);
      await sleep(60);
      if (target === 1) {
        report.following = await evaluate(`(() => { const t=document.querySelector('.av-pager-track'),m=new DOMMatrix(getComputedStyle(t).transform),
          w=document.querySelector('.av-pager').clientWidth;return {id:S.x.viewId,offset:m.m41+w}; })()`);
        assert(report.following.id === 'sample:anything-v5-mnn:0' && report.following.offset < -100 && report.following.offset > -220);
      }
      await touch('touchEnd', []); await sleep(440); await viewerReady();
      const state = await evaluate(`({id:S.x.viewId,counter:document.querySelector('.av-counter').textContent,
        src:document.querySelector('.av-page[data-pos="0"] .av-image').getAttribute('src')})`);
      assert.equal(state.id, `sample:anything-v5-mnn:${target}`);
      assert(state.counter.startsWith(`${target+1} / 4`) && state.src.includes('-512.webp'));
      report.swipes.push(state);
    }
    assert(await evaluate(`!document.querySelector('.av-nav.right') && !!document.querySelector('.av-nav.left')`));
    ok('左右按钮与真实横滑依次查看四张原图，拖动跟手且末张不越界', { following:report.following, swipes:report.swipes });

    await click('[data-a="av-info"]');
    assert(await evaluate(`document.querySelector('.dlg-title').textContent==='样例详情' && document.querySelector('.dlg').textContent.includes('512×512') && !document.querySelector('.dlg').textContent.includes('.json')`));
    await click('.dlg [data-dlg="0"]');
    await click('.av-back');
    assert.equal(await evaluate(`nav.current().page`), 'models');

    await evaluate(`nav.push('diffusion')`); await sleep(250);
    report.wizard = await evaluate(`(() => { const root=document.querySelector('.diff-step[data-step="0"]'); return {
      anything:root.querySelectorAll('.diff-model[data-model-id="anything-v5-mnn"] .model-sample').length,
      animagine:root.querySelectorAll('.diff-model[data-model-id="animagine-v4-sdxl"] .model-sample').length,
      chillout:root.querySelectorAll('.diff-model[data-model-id="chillout-mix-qnn"] .model-samples').length,
      families:root.querySelectorAll('.diff-family').length,
      variants:root.querySelectorAll('.diff-variant').length }; })()`);
    assert.deepEqual(report.wizard, { anything:4, animagine:3, chillout:1, families:3, variants:4 });
    // 家族组头吸顶：滚到底后仍可见（sticky 生效）
    assert(await evaluate(`(() => { const el=document.querySelector('.diff-family'); const r=el.getBoundingClientRect();
      const step=document.querySelector('.diff-step[data-step="0"]').getBoundingClientRect();
      return getComputedStyle(el).position==='sticky' && r.top >= step.top - 1; })()`), '家族组头吸顶');
    await click('.diff-step[data-step="0"] .diff-model[data-model-id="animagine-v4-sdxl"] [data-arg="sample:animagine-v4-sdxl:0"]');
    await viewerReady();
    report.asset1024 = await sampleMetrics();
    assert.deepEqual(report.asset1024.natural, [1024, 1024]);
    assert(report.asset1024.inside && report.asset1024.shown[0] < 1024 && report.asset1024.page === 'asset');
    assert(report.asset1024.sources.every(src => src.includes('-1024.webp') && !src.includes('-200.webp')));
    assert(!report.asset1024.diffViewer && !report.asset1024.originalButton);
    await click('.av-back');
    assert.equal(await evaluate(`nav.current().page`), 'diffusion');
    ok('生图向导进入同一素材查看器并加载 1024 原始 image', report.asset1024);

    await evaluate(`nav.pop()`); await sleep(150);
    await click('[data-a="theme-toggle"]');
    assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
    await shot('walk-model-samples-hub-dark.png');
    await click('[data-a="frame-toggle"]'); await metrics(1024, 680);
    report.landscape = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,
      squares:[...document.querySelectorAll('.model-item .model-sample')].every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1}),
      land:document.querySelector('.phone').classList.contains('land')})`);
    assert(!report.landscape.overflow && report.landscape.squares && report.landscape.land);
    await evaluate(`nav.push('diffusion')`); await sleep(300);
    await shot('walk-model-samples-wizard-dark-landscape.png');
    await click('.diff-step[data-step="0"] .diff-model[data-model-id="animagine-v4-sdxl"] [data-arg="sample:animagine-v4-sdxl:0"]');
    await viewerReady();
    assert((await sampleMetrics()).inside);
    await shot('walk-model-sample-viewer-1024-dark-landscape.png');
    await click('.av-back'); await evaluate(`nav.pop()`); await sleep(150);
    ok('暗色与 1024×680 横屏仍使用素材查看器适配', report.landscape);

    await click('[data-a="frame-toggle"]'); await metrics(360, 780);
    report.narrow = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,
      squares:[...document.querySelectorAll('.model-item .model-sample')].every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-r.height)<1&&r.width>0})})`);
    assert(!report.narrow.overflow && report.narrow.squares);
    await shot('walk-model-samples-hub-narrow-dark.png');
    ok('360px 窄屏列表无横向溢出', report.narrow);

    assert.deepEqual(externalRequests, [], `external requests: ${externalRequests.join(',')}`);
    assert.deepEqual(infoRequests, [], `info JSON was requested: ${infoRequests.join(',')}`);
    assert.deepEqual(exceptions, [], `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests = 0; report.infoRequests = 0; report.exceptions = 0;
    console.log(JSON.stringify({ ok:true, ...report }, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile, { recursive:true, force:true }); } catch {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
