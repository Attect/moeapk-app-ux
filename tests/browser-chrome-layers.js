// 零依赖 Chrome CDP 走查：真实边到边 chrome、磨砂底栏、滚动隐显、明暗与横竖屏。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9334;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-chrome-'));
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
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
function assert(value, message) { if (!value) throw new Error(message); }

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
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
}
async function scrollTo(y) {
  await evaluate(`(() => { const c = document.getElementById('content'); c.scrollTop = ${y}; })()`);
  await sleep(380);
}
async function dismissOnboard() {
  await evaluate(`(() => { const el = document.querySelector('.onboard'); if (el) el.click(); })()`);
  await sleep(100);
}
async function auditTabs() {
  const result = {};
  for (const tab of ['apk', 'goods', 'assets', 'ai', 'mine']) {
    await evaluate(`ACTIONS.tab({ arg: '${tab}' })`);
    await evaluate(`document.getElementById('content').scrollTop = 0`);
    await sleep(350);
    await dismissOnboard();
    const layout = await evaluate(`(() => {
      const a = document.getElementById('app').getBoundingClientRect();
      const c = document.getElementById('content'), r = c.getBoundingClientRect();
      const n = document.querySelector('.navbar').getBoundingClientRect();
      c.scrollTop = 0;
      return { fills: Math.abs(r.top-a.top)<1 && Math.abs(r.bottom-a.bottom)<1,
        navInside: n.left>=a.left && n.right<=a.right && n.bottom<=a.bottom,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
        max: c.scrollHeight-c.clientHeight };
    })()`);
    assert(layout.fills && layout.navInside && layout.noOverflow, `${tab} layout mismatch: ${JSON.stringify(layout)}`);
    if (layout.max > 220) {
      await scrollTo(210);
      layout.hides = await evaluate(`document.getElementById('app').classList.contains('nav-hidden')`);
      await scrollTo(170);
      layout.shows = await evaluate(`!document.getElementById('app').classList.contains('nav-hidden')`);
      assert(layout.hides && layout.shows, `${tab} scroll chrome mismatch: ${JSON.stringify(layout)}`);
    }
    result[tab] = layout;
  }
  return result;
}

(async () => {
  const report = {};
  try {
    const pages = await waitFor(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        return r.ok ? (await r.json()).find(p => p.type === 'page') : null;
      } catch { return null; }
    }, 10000, 'CDP endpoint');
    await connect(pages.webSocketDebuggerUrl);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await metrics(1280, 960);
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await navigate(`${index}?theme=light&frame=port#apk`);
    await dismissOnboard();

    report.initial = await evaluate(`(() => {
      const app = document.getElementById('app');
      const content = document.getElementById('content');
      const top = document.querySelector('.top-chrome');
      const nav = document.querySelector('.navbar');
      const a = app.getBoundingClientRect(), c = content.getBoundingClientRect();
      const t = top.getBoundingClientRect(), n = nav.getBoundingClientRect();
      return {
        contentFills: Math.abs(c.top-a.top) < 1 && Math.abs(c.bottom-a.bottom) < 1 && Math.abs(c.left-a.left) < 1,
        topFills: Math.abs(t.top-a.top) < 1,
        floating: n.left > a.left && n.right < a.right && n.bottom < a.bottom,
        blur: getComputedStyle(nav).backdropFilter,
        topBlur: getComputedStyle(top).backdropFilter,
        radius: getComputedStyle(nav).borderRadius,
        status: !!document.querySelector('.top-chrome .statusbar'),
        paddingTop: parseFloat(getComputedStyle(content).paddingTop),
        chromeHeight: t.height
      };
    })()`);
    assert(report.initial.contentFills, `content is not edge-to-edge: ${JSON.stringify(report.initial)}`);
    assert(report.initial.topFills && report.initial.floating, `chrome is not overlaid: ${JSON.stringify(report.initial)}`);
    assert(report.initial.blur.includes('blur') && report.initial.topBlur.includes('blur'), 'chrome backdrop blur missing');
    assert(report.initial.status && report.initial.paddingTop >= report.initial.chromeHeight, 'status/top safe padding missing');
    await shot('walk-chrome-light-top.png');

    await scrollTo(430);
    report.hidden = await evaluate(`(() => {
      const app = document.getElementById('app'), nav = document.querySelector('.navbar');
      return { cls: app.classList.contains('nav-hidden'), aria: nav.getAttribute('aria-hidden'), inert: nav.inert,
        opacity: getComputedStyle(nav).opacity, transform: getComputedStyle(nav).transform };
    })()`);
    assert(report.hidden.cls && report.hidden.aria === 'true' && report.hidden.inert, `nav did not hide accessibly: ${JSON.stringify(report.hidden)}`);
    assert(Number(report.hidden.opacity) === 0 && report.hidden.transform !== 'none', 'nav hide animation did not finish');
    await shot('walk-chrome-light-hidden.png');

    await scrollTo(390);
    report.shown = await evaluate(`(() => {
      const app = document.getElementById('app'), nav = document.querySelector('.navbar'), n = nav.getBoundingClientRect();
      const layers = document.elementsFromPoint(n.left + n.width * .5, n.top + 12).map(el => el.id || el.className || el.tagName);
      return { cls: app.classList.contains('nav-hidden'), aria: nav.getAttribute('aria-hidden'), inert: nav.inert,
        opacity: getComputedStyle(nav).opacity, layers,
        behind: document.elementsFromPoint(n.left + n.width * .5, n.top + 12).some(el => el.id === 'content' || el.closest('.card')) };
    })()`);
    assert(!report.shown.cls && report.shown.aria === 'false' && !report.shown.inert, `nav did not reappear: ${JSON.stringify(report.shown)}`);
    assert(Number(report.shown.opacity) === 1 && report.shown.behind, `no real content behind nav: ${JSON.stringify(report.shown)}`);
    await shot('walk-chrome-light-scrolled.png');

    report.topLayers = await evaluate(`(() => {
      const a = document.getElementById('app').getBoundingClientRect();
      return document.elementsFromPoint(a.left + a.width * .5, a.top + 5).some(el => el.id === 'content' || el.closest('.card'));
    })()`);
    assert(report.topLayers, 'content does not extend behind status/title chrome');

    await scrollTo(650);
    await scrollTo(520);
    report.float = await evaluate(`(() => {
      const nav = document.querySelector('.navbar').getBoundingClientRect();
      const top = document.querySelector('.to-top');
      const r = top.getBoundingClientRect();
      return { on: top.classList.contains('on'), above: r.bottom < nav.top,
        navVisible: !document.getElementById('app').classList.contains('nav-hidden'),
        y: document.getElementById('content').scrollTop, state: S.x.showTop,
        max: document.getElementById('content').scrollHeight - document.getElementById('content').clientHeight,
        blur: getComputedStyle(top).backdropFilter };
    })()`);
    assert(report.float.on && report.float.above && report.float.navVisible && report.float.blur.includes('blur'), `floating action mismatch: ${JSON.stringify(report.float)}`);

    report.lightTabs = await auditTabs();
    await evaluate(`nav.goTab('apk')`);
    await scrollTo(520);
    await evaluate(`document.querySelector('[data-a="theme-toggle"]').click()`);
    await sleep(250);
    report.darkTabs = await auditTabs();
    await evaluate(`nav.goTab('apk')`);
    await scrollTo(520);
    await scrollTo(500);
    await shot('walk-chrome-dark-scrolled.png');
    report.dark = await evaluate(`({ theme: document.documentElement.dataset.theme,
      navBg: getComputedStyle(document.querySelector('.navbar')).backgroundColor })`);
    assert(report.dark.theme === 'dark', 'dark theme did not apply');

    await evaluate(`nav.goTab('assets')`);
    await sleep(250);
    await dismissOnboard();
    report.assets = await evaluate(`(() => {
      const a = document.getElementById('app').getBoundingClientRect();
      const n = document.querySelector('.navbar').getBoundingClientRect();
      return { inside: n.left >= a.left && n.right <= a.right && n.bottom <= a.bottom,
        visible: !document.getElementById('app').classList.contains('nav-hidden') };
    })()`);
    assert(report.assets.inside && report.assets.visible, 'tab switch did not restore floating nav');

    await metrics(360, 780);
    report.narrow = await evaluate(`(() => {
      const a = document.getElementById('app').getBoundingClientRect();
      const n = document.querySelector('.navbar').getBoundingClientRect();
      return { noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
        inside: n.left >= a.left && n.right <= a.right };
    })()`);
    assert(report.narrow.noPageOverflow && report.narrow.inside, `narrow layout overflow: ${JSON.stringify(report.narrow)}`);

    await metrics(1024, 680);
    await evaluate(`(() => { if (S.frame !== 'land') document.querySelector('[data-a="frame-toggle"]').click(); })()`);
    await sleep(350);
    await evaluate(`nav.goTab('apk')`);
    await dismissOnboard();
    await scrollTo(430);
    report.rail = await evaluate(`(() => {
      const app = document.getElementById('app'), content = document.getElementById('content');
      const a = app.getBoundingClientRect(), c = content.getBoundingClientRect();
      const nav = document.querySelector('.navbar'), n = nav.getBoundingClientRect();
      return { width: n.width, visible: !app.classList.contains('nav-hidden'), aria: nav.getAttribute('aria-hidden'),
        contentLeft: Math.abs(c.left-a.left) < 1, paddingLeft: parseFloat(getComputedStyle(content).paddingLeft) };
    })()`);
    assert(report.rail.width === 84 && report.rail.visible && report.rail.aria === 'false', `rail should stay visible: ${JSON.stringify(report.rail)}`);
    assert(report.rail.contentLeft && report.rail.paddingLeft >= 100, `rail is not a real overlay: ${JSON.stringify(report.rail)}`);
    await shot('walk-chrome-land.png');

    await evaluate(`nav.push('llm')`);
    await sleep(200);
    const inputPoint = await evaluate(`(() => { const r = document.querySelector('[data-kb="1"]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...inputPoint, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...inputPoint, button: 'left', clickCount: 1 });
    await sleep(300);
    report.keyboard = await evaluate(`(() => {
      const c = document.getElementById('content').getBoundingClientRect();
      const kb = document.querySelector('.kbdemo');
      if (!kb) return { shown: false, state: S.x.kbDemo, page: nav.current() && nav.current().page,
        active: document.activeElement && document.activeElement.outerHTML,
        input: !!document.querySelector('[data-kb="1"]') };
      const k = kb.getBoundingClientRect();
      return { shown: true, fits: Math.abs(c.bottom-k.top) < 2 };
    })()`);
    assert(report.keyboard.shown && report.keyboard.fits, `keyboard layout regressed: ${JSON.stringify(report.keyboard)}`);

    await evaluate(`nav.goTab('assets'); nav.push('asset');`);
    await sleep(250);
    report.full = await evaluate(`(() => {
      const a = document.getElementById('app').getBoundingClientRect();
      const c = document.getElementById('content').getBoundingClientRect();
      return { status: !!document.querySelector('.statusbar.full'), noTop: !document.querySelector('.top-chrome'),
        fills: Math.abs(c.top-a.top) < 1 && Math.abs(c.bottom-a.bottom) < 1 };
    })()`);
    assert(report.full.status && report.full.noTop && report.full.fills, `immersive layout regressed: ${JSON.stringify(report.full)}`);

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
