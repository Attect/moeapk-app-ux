// 零依赖 Chrome CDP 走查：素材图片单击显隐、双击/双指缩放、跟手分页与按钮对比度。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9337;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-viewer-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 15000, label = 'condition') {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(60);
  }
  throw new Error(`timeout: ${label}`);
}
function assert(value, message) { if (!value) throw new Error(message); }
let ws, nextId = 1;
const pending = new Map(), externalRequests = [], exceptions = [];
function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
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
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function point(selector) {
  const p = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x:r.left+r.width/2, y:r.top+r.height/2 }; })()`);
  return p;
}
async function mouse(type, p, clickCount = 1) {
  await send('Input.dispatchMouseEvent', { type, ...p, button: 'left', clickCount });
}
async function clickAt(p) {
  await mouse('mousePressed', p); await sleep(35); await mouse('mouseReleased', p);
}
async function clickSelector(selector) { await clickAt(await point(selector)); }
async function doubleClickAt(p) {
  await clickAt(p); await sleep(65); await mouse('mousePressed', p, 2); await sleep(35); await mouse('mouseReleased', p, 2);
}
async function touch(type, points) {
  await send('Input.dispatchTouchEvent', { type,
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id == null ? i : p.id })) });
}
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
}
async function resetFirst() {
  await evaluate(`(() => { S.x.viewId='as1'; S.x.avChrome=true; S.x.avZoomed=false; S.x.avZoomChrome=false; S.x.avZoom={id:'as1',scale:1,x:0,y:0}; render(); })()`);
  await sleep(120);
}

(async () => {
  const report = {};
  try {
    const page = await waitFor(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        return r.ok ? (await r.json()).find(p => p.type === 'page') : null;
      } catch { return null; }
    }, 10000, 'CDP endpoint');
    await connect(page.webSocketDebuggerUrl);
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await metrics(1280, 960);
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await send('Page.navigate', { url: `${index}?theme=light&frame=port#assets/asset/as1` });
    await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.av-pager')`), 15000, 'viewer load');
    await sleep(200);

    report.pages = await evaluate(`(() => ({ pages:document.querySelectorAll('.av-page').length,
      pos:Array.from(document.querySelectorAll('.av-page')).map(x=>x.dataset.pos), id:S.x.viewId,
      transform:getComputedStyle(document.querySelector('.av-pager-track')).transform }))()`);
    assert(report.pages.pages === 3 && report.pages.pos.join(',') === '-1,0,1' && report.pages.id === 'as1',
      `three-page track missing: ${JSON.stringify(report.pages)}`);

    // 把当前素材强制为纯白，验证按钮自身深色底与白色图标不依赖图片颜色。
    await evaluate(`document.querySelector('.av-page[data-pos="0"] .av-media').style.background='#fff'`);
    report.contrast = await evaluate(`(() => { const n=document.querySelector('.av-nav.right'), s=getComputedStyle(n), i=getComputedStyle(n.querySelector('.ic'));
      return { bg:s.backgroundColor, border:s.borderTopColor, icon:i.color, shadow:s.boxShadow }; })()`);
    assert(report.contrast.bg === 'rgba(10, 14, 24, 0.52)' && report.contrast.icon === 'rgb(255, 255, 255)',
      `navigation contrast regressed: ${JSON.stringify(report.contrast)}`);
    await shot('walk-asset-viewer-light-controls.png');

    const center = await point('.av-page[data-pos="0"] .av-media');
    await clickAt(center); await sleep(390);
    await waitFor(() => evaluate(`getComputedStyle(document.querySelector('.av-toolbar')).opacity==='0'`), 2000, 'chrome fade out');
    report.singleHide = await evaluate(`(() => ({ hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden'),
      opacity:getComputedStyle(document.querySelector('.av-toolbar')).opacity,
      inert:document.querySelector('.av-toolbar').inert, scale:S.x.avZoom.scale }))()`);
    assert(report.singleHide.hidden && report.singleHide.opacity === '0' && report.singleHide.inert && report.singleHide.scale === 1,
      `single tap did not hide all chrome: ${JSON.stringify(report.singleHide)}`);
    await shot('walk-asset-viewer-hidden.png');
    await clickAt(center); await sleep(390);
    report.singleShow = await evaluate(`!document.querySelector('.av-stage').classList.contains('chrome-hidden') && !document.querySelector('.av-toolbar').inert`);
    assert(report.singleShow, 'second single tap did not restore chrome');

    await doubleClickAt(center); await sleep(320);
    report.doubleZoom = await evaluate(`(() => { const p=document.querySelector('.av-pager'), m=document.querySelector('.av-page[data-pos="0"] .av-media');
      return { scale:S.x.avZoom.scale, hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden'),
      transform:m.style.transform, filled:m.offsetWidth===p.clientWidth&&m.offsetHeight===p.clientHeight,
      zoomed:document.querySelector('.av-page[data-pos="0"]').classList.contains('zoomed') }; })()`);
    assert(report.doubleZoom.scale === 2.5 && report.doubleZoom.hidden && report.doubleZoom.filled && report.doubleZoom.zoomed,
      `double tap zoom/full-bleed mismatch: ${JSON.stringify(report.doubleZoom)}`);
    await shot('walk-asset-viewer-double-zoom.png');
    await doubleClickAt(center); await sleep(300);
    assert(await evaluate(`S.x.avZoom.scale===1 && S.x.avZoom.x===0 && S.x.avZoom.y===0 && !document.querySelector('.av-stage').classList.contains('chrome-hidden')`),
      'double tap did not reset zoom and auto-restore chrome');

    const rect = await evaluate(`(() => { const r=document.querySelector('.av-pager').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; })()`);
    const pinchCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    await touch('touchStart', [{x:pinchCenter.x-40,y:pinchCenter.y,id:0},{x:pinchCenter.x+40,y:pinchCenter.y,id:1}]);
    await touch('touchMove', [{x:pinchCenter.x-90,y:pinchCenter.y,id:0},{x:pinchCenter.x+90,y:pinchCenter.y,id:1}]);
    await sleep(80);
    report.pinch = await evaluate(`({scale:S.x.avZoom.scale,id:S.x.viewId,
      hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden'),
      filled:document.querySelector('.av-page[data-pos="0"]').classList.contains('zoomed')})`);
    assert(report.pinch.scale > 1.8 && report.pinch.id === 'as1' && report.pinch.hidden && report.pinch.filled,
      `pinch did not zoom current image into full-bleed mode: ${JSON.stringify(report.pinch)}`);
    await touch('touchEnd', []); await sleep(80);
    await touch('touchStart', [{x:pinchCenter.x,y:pinchCenter.y,id:0}]);
    await touch('touchMove', [{x:pinchCenter.x+42,y:pinchCenter.y+20,id:0}]);
    await touch('touchEnd', []); await sleep(80);
    report.zoomPan = await evaluate(`({x:S.x.avZoom.x,y:S.x.avZoom.y,id:S.x.viewId,scale:S.x.avZoom.scale})`);
    assert(report.zoomPan.id === 'as1' && report.zoomPan.scale > 1 && Math.abs(report.zoomPan.x) > 10,
      `zoomed pan should move image, not page: ${JSON.stringify(report.zoomPan)}`);
    await doubleClickAt(center); await sleep(300);

    // 拖动中图片必须已跟手位移，viewId 到松手动画结束后才提交。
    const swipeStart = { x: pinchCenter.x + 80, y: pinchCenter.y };
    await touch('touchStart', [{...swipeStart,id:0}]);
    await touch('touchMove', [{x:swipeStart.x-60,y:swipeStart.y,id:0}]);
    await touch('touchMove', [{x:swipeStart.x-140,y:swipeStart.y,id:0}]);
    await sleep(60);
    report.following = await evaluate(`(() => { const t=document.querySelector('.av-pager-track'); const m=new DOMMatrix(getComputedStyle(t).transform);
      const w=document.querySelector('.av-pager').clientWidth; return {id:S.x.viewId,offset:m.m41+w,transition:getComputedStyle(t).transitionDuration}; })()`);
    assert(report.following.id === 'as1' && report.following.offset < -100 && report.following.offset > -220,
      `pager does not follow finger: ${JSON.stringify(report.following)}`);
    await shot('walk-asset-viewer-following.png');
    await touch('touchEnd', []); await sleep(420);
    report.swiped = await evaluate(`({id:S.x.viewId,counter:document.querySelector('.av-counter').textContent})`);
    assert(report.swiped.id === 'as2' && report.swiped.counter.startsWith('2 /'), `swipe did not settle next page: ${JSON.stringify(report.swiped)}`);

    await clickSelector('.av-nav.right'); await sleep(60);
    report.buttonDuring = await evaluate(`({id:S.x.viewId,animating:getComputedStyle(document.querySelector('.av-pager-track')).transitionDuration})`);
    assert(report.buttonDuring.id === 'as2' && report.buttonDuring.animating === '0.28s', `button change was not animated: ${JSON.stringify(report.buttonDuring)}`);
    await sleep(400);
    assert(await evaluate(`S.x.viewId==='as3'`), 'next button did not commit after animation');

    // 首张向右拖只回弹，不越界。
    await resetFirst();
    await touch('touchStart', [{x:pinchCenter.x-70,y:pinchCenter.y,id:0}]);
    await touch('touchMove', [{x:pinchCenter.x+70,y:pinchCenter.y,id:0}]);
    await touch('touchEnd', []); await sleep(390);
    assert(await evaluate(`S.x.viewId==='as1'`), 'boundary swipe crossed first page');

    await evaluate(`document.querySelector('[data-a="theme-toggle"]').click()`); await sleep(180);
    await shot('walk-asset-viewer-dark.png');
    report.dark = await evaluate(`({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.querySelector('.av-nav.right')).backgroundColor})`);
    assert(report.dark.theme === 'dark' && report.dark.bg === 'rgba(10, 14, 24, 0.52)', 'dark theme navigation contrast regressed');

    await metrics(360, 780);
    report.narrow = await evaluate(`(() => { const r=document.querySelector('.av-nav.right').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,inside:r.left>=0&&r.right<=innerWidth}; })()`);
    assert(!report.narrow.overflow && report.narrow.inside, `narrow viewer mismatch: ${JSON.stringify(report.narrow)}`);

    await metrics(1280, 960);
    await evaluate(`document.querySelector('[data-a="frame-toggle"]').click()`); await sleep(300);
    report.landscape = await evaluate(`(() => { const p=document.querySelector('.av-pager').getBoundingClientRect(), n=document.querySelector('.av-nav.right').getBoundingClientRect();
      return {width:p.width,height:p.height,navInside:n.left>=p.left&&n.right<=p.right&&n.top>=p.top&&n.bottom<=p.bottom}; })()`);
    assert(report.landscape.width > report.landscape.height && report.landscape.navInside, `landscape viewer mismatch: ${JSON.stringify(report.landscape)}`);
    await shot('walk-asset-viewer-landscape-dark.png');
    const landCenter = await point('.av-page[data-pos="0"] .av-media');
    await doubleClickAt(landCenter); await sleep(320);
    report.landscapeFill = await evaluate(`(() => { const p=document.querySelector('.av-pager'), m=document.querySelector('.av-page[data-pos="0"] .av-media');
      return {filled:m.offsetWidth===p.clientWidth&&m.offsetHeight===p.clientHeight,
        hidden:document.querySelector('.av-stage').classList.contains('chrome-hidden')}; })()`);
    assert(report.landscapeFill.filled && report.landscapeFill.hidden,
      `landscape zoom left letterbox or chrome: ${JSON.stringify(report.landscapeFill)}`);
    await shot('walk-asset-viewer-landscape-fill.png');

    assert(!externalRequests.length, `external requests: ${externalRequests.join(',')}`);
    assert(!exceptions.length, `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests = 0; report.exceptions = 0;
    console.log(JSON.stringify({ok:true,...report},null,2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile,{recursive:true,force:true}); } catch {}
  }
})().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
