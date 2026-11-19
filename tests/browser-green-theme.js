// 浅绿主色与原辅助色走查：文字渐变、原阴影参数、五个主 Tab、明暗、横竖屏与窄屏；每轮独立截图。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9342;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-green-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
let ws;
let nextId = 1;
const pending = new Map();
const externalRequests = [];
const exceptions = [];

async function waitFor(fn, timeout = 15000, label = 'condition') {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`timeout: ${label}`);
}
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
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(250);
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await waitFor(() => evaluate('document.readyState === "complete" && typeof nav === "object"'), 15000, 'page load');
  await sleep(300);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function dismissOnboard() {
  await evaluate(`(() => { const el = document.querySelector('.onboard'); if (el) el.click(); })()`);
  await sleep(80);
}
async function showTab(tab) {
  await evaluate(`nav.goTab('${tab}'); document.getElementById('content').scrollTop = 0`);
  await sleep(220);
  await dismissOnboard();
}
async function auditTabs(label) {
  const report = {};
  for (const tab of ['apk', 'goods', 'assets', 'ai', 'mine']) {
    await showTab(tab);
    report[tab] = await evaluate(`(() => {
      const c = document.getElementById('content');
      return { page: S.tab, docWidth: document.documentElement.scrollWidth,
        viewport: innerWidth, contentWidth: c.scrollWidth, contentClient: c.clientWidth,
        navVisible: !document.getElementById('app').classList.contains('nav-hidden') };
    })()`);
    assert(report[tab].page === tab, `${label}/${tab}: wrong page`);
    assert(report[tab].docWidth <= report[tab].viewport, `${label}/${tab}: document overflow ${JSON.stringify(report[tab])}`);
    assert(report[tab].contentWidth <= report[tab].contentClient + 1, `${label}/${tab}: content overflow ${JSON.stringify(report[tab])}`);
    assert(report[tab].navVisible, `${label}/${tab}: navigation hidden`);
  }
  return report;
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
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    const index = pathToFileURL(path.join(root, 'index.html')).href;

    await metrics(1280, 960);
    await navigate(`${index}?theme=light&frame=port#apk`);
    assert(await evaluate(`location.protocol === 'file:'`), 'prototype must run over file://');
    report.lightPortrait = await auditTabs('light portrait');
    await showTab('apk');
    report.lightColors = await evaluate(`(() => ({
      theme: document.documentElement.dataset.theme,
      primary: getComputedStyle(document.querySelector('.nav-item.on')).color,
      onPrimary: getComputedStyle(document.querySelector('.chip.on')).color,
      phoneBackground: getComputedStyle(document.querySelector('.phone')).backgroundImage,
      chipBackground: getComputedStyle(document.querySelector('.chip.on')).backgroundImage,
      textBackground: getComputedStyle(document.querySelector('.sec-title')).backgroundImage,
      chipShadow: getComputedStyle(document.querySelector('.chip.on')).boxShadow,
      navShadow: getComputedStyle(document.querySelector('.nav-item.on .ic')).boxShadow,
      glassShadow: getComputedStyle(document.querySelector('.navbar')).boxShadow
    }))()`);
    assert(report.lightColors.theme === 'light', 'light theme missing');
    assert(report.lightColors.primary === 'rgb(74, 114, 74)', `light primary mismatch: ${report.lightColors.primary}`);
    assert(report.lightColors.onPrimary === 'rgb(46, 70, 46)', `light on-primary mismatch: ${report.lightColors.onPrimary}`);
    assert(report.lightColors.phoneBackground.includes('214, 237, 214') && report.lightColors.phoneBackground.includes('213, 229, 249'), `green harmony mesh missing: ${report.lightColors.phoneBackground}`);
    assert(report.lightColors.chipBackground.includes('226, 243, 226') && report.lightColors.chipBackground.includes('169, 214, 169'), `green chip gradient missing: ${report.lightColors.chipBackground}`);
    assert(report.lightColors.textBackground.includes('131, 170, 131') && report.lightColors.textBackground.includes('74, 114, 74'), `balanced tonal green text gradient missing: ${report.lightColors.textBackground}`);
    assert(report.lightColors.chipShadow.includes('0px 2px 8px -3px') && !report.lightColors.chipShadow.includes('inset'), `original light chip shadow missing: ${report.lightColors.chipShadow}`);
    assert(report.lightColors.navShadow.includes('0px 4px 10px -3px') && !report.lightColors.navShadow.includes('inset'), `original light nav shadow missing: ${report.lightColors.navShadow}`);
    assert(!report.lightColors.glassShadow.includes('inset'), 'extra glass relief must remain removed');
    await shot('green-tonal-balanced-home-light.png');
    await showTab('mine');
    await shot('green-tonal-balanced-mine-light.png');
    await showTab('ai');
    await shot('green-tonal-balanced-ai-light.png');

    await navigate(`${index}?theme=dark&frame=port#apk`);
    report.darkPortrait = await auditTabs('dark portrait');
    await showTab('apk');
    report.darkColors = await evaluate(`(() => ({
      theme: document.documentElement.dataset.theme,
      primary: getComputedStyle(document.querySelector('.nav-item.on')).color,
      onPrimary: getComputedStyle(document.querySelector('.chip.on')).color,
      phoneBackground: getComputedStyle(document.querySelector('.phone')).backgroundImage,
      chipBackground: getComputedStyle(document.querySelector('.chip.on')).backgroundImage,
      textBackground: getComputedStyle(document.querySelector('.sec-title')).backgroundImage,
      chipShadow: getComputedStyle(document.querySelector('.chip.on')).boxShadow,
      navShadow: getComputedStyle(document.querySelector('.nav-item.on .ic')).boxShadow,
      glassShadow: getComputedStyle(document.querySelector('.navbar')).boxShadow
    }))()`);
    assert(report.darkColors.theme === 'dark', 'dark theme missing');
    assert(report.darkColors.primary === 'rgb(208, 228, 208)', `dark primary mismatch: ${report.darkColors.primary}`);
    assert(report.darkColors.onPrimary === 'rgb(39, 60, 39)', `dark on-primary mismatch: ${report.darkColors.onPrimary}`);
    assert(report.darkColors.phoneBackground.includes('54, 86, 54') && report.darkColors.phoneBackground.includes('36, 48, 94'), `dark harmony mesh missing: ${report.darkColors.phoneBackground}`);
    assert(report.darkColors.chipBackground.includes('227, 242, 227') && report.darkColors.chipBackground.includes('169, 210, 169'), `dark green chip gradient missing: ${report.darkColors.chipBackground}`);
    assert(report.darkColors.textBackground.includes('208, 228, 208') && report.darkColors.textBackground.includes('131, 170, 131'), `dark tonal green text gradient missing: ${report.darkColors.textBackground}`);
    assert(report.darkColors.chipShadow.includes('0px 2px 10px -3px') && !report.darkColors.chipShadow.includes('inset'), `original dark chip shadow missing: ${report.darkColors.chipShadow}`);
    assert(report.darkColors.navShadow.includes('0px 4px 14px -4px') && !report.darkColors.navShadow.includes('inset'), `original dark nav shadow missing: ${report.darkColors.navShadow}`);
    assert(!report.darkColors.glassShadow.includes('inset'), 'extra dark glass relief must remain removed');
    await shot('green-tonal-balanced-home-dark.png');
    await showTab('ai');
    await evaluate(`nav.push('models')`);
    await sleep(300);
    await shot('green-tonal-balanced-models-dark.png');

    await metrics(1024, 680);
    await navigate(`${index}?theme=light&frame=land#apk`);
    report.lightLandscape = await auditTabs('light landscape');
    await showTab('apk');
    assert(await evaluate(`document.querySelector('.navbar').getBoundingClientRect().width === 84`), 'light landscape rail missing');
    await shot('green-tonal-balanced-home-landscape-light.png');

    await navigate(`${index}?theme=dark&frame=land#apk`);
    report.darkLandscape = await auditTabs('dark landscape');
    await showTab('apk');
    assert(await evaluate(`document.querySelector('.navbar').getBoundingClientRect().width === 84`), 'dark landscape rail missing');
    await shot('green-tonal-balanced-home-landscape-dark.png');

    await metrics(360, 780);
    await navigate(`${index}?theme=light&frame=port#apk`);
    report.lightNarrow = await auditTabs('light narrow');
    await showTab('apk');
    await shot('green-tonal-balanced-home-narrow-light.png');
    await navigate(`${index}?theme=dark&frame=port#apk`);
    report.darkNarrow = await auditTabs('dark narrow');
    await showTab('apk');
    await shot('green-tonal-balanced-home-narrow-dark.png');

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
