// 零依赖 Chrome CDP 走查：生成中的设备温度、负载、电量与条件提醒。
// 运行：node tests/browser-diffusion-device-status.js（可用 CHROME_PATH 指定 Chrome）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9346;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-diff-device-'));
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
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(320);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function scenario(name) {
  await evaluate(`(() => { window._diffusion.state().deviceDemo=${JSON.stringify(name)}; render(); })()`);
  await sleep(180);
}
async function layoutReport() {
  return evaluate(`(() => {
    const step=document.querySelector('.diff-step[data-step="4"]'), panel=document.querySelector('.diff-device'),
      main=document.querySelector('.diff-generating-main'), app=document.getElementById('app');
    const s=step.getBoundingClientRect(), p=panel.getBoundingClientRect(), m=main.getBoundingClientRect(), a=app.getBoundingClientRect();
    const pager=document.querySelector('#diff-pager');
    return { theme:document.documentElement.dataset.theme, width:innerWidth, height:innerHeight,
      currentStep:window._diffusion.state().step, pagerLeft:pager.scrollLeft, pagerWidth:pager.clientWidth,
      horizontalOverflow:step.scrollWidth>step.clientWidth || document.documentElement.scrollWidth>innerWidth,
      panelInside:p.left>=a.left-1&&p.right<=a.right+1, panelLeft:p.left, panelRight:p.right, appLeft:a.left, appRight:a.right,
      panelTop:p.top, panelBottom:p.bottom, stepBottom:s.bottom, sideBySide:p.left>=m.right-2&&Math.abs(p.top-m.top)<3,
      loads:document.querySelectorAll('.diff-load').length, advice:[...document.querySelectorAll('.diff-device-advice')].map(x=>x.textContent.trim()),
      temperature:document.querySelector('.diff-temp-ring strong').textContent,
      battery:document.querySelector('.diff-device-battery').textContent.trim(),
      scrollTop:step.scrollTop, scrollHeight:step.scrollHeight, clientHeight:step.clientHeight };
  })()`);
}

(async () => {
  const report = { checks: [] };
  const ok = (name, detail) => report.checks.push({ name, detail: detail == null ? true : detail });
  try {
    const page = await waitFor(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        return r.ok ? (await r.json()).find(p => p.type === 'page') : null;
      } catch { return null; }
    }, 10000, 'CDP endpoint');
    await connect(page.webSocketDebuggerUrl);
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await metrics(412, 860);
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await send('Page.navigate', { url: `${index}?theme=light&frame=port#ai/diffusion` });
    await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.diff-wizard')`), 15000, 'wizard load');
    await evaluate(`(() => {
      const d=window._diffusion.state(); d.modelId='anything-v5-mnn'; d.compute='gpu'; d.step=4; d.curId=null; d.lastError=null;
      d.evictNote='可计算 · MNN 计算';
      mock.startJob('diff-gen','文生图 · GPU',60000,['编码提示词','去噪 20 步','解码']);
      S.x.jobs['diff-gen'].p=.42; S.x.jobs['diff-gen'].phase='去噪 20 步'; render();
    })()`);
    await waitFor(() => evaluate(`!!document.querySelector('.diff-device')`), 3000, 'device panel');

    await scenario('stable');
    report.stableLight = await layoutReport();
    assert.equal(report.stableLight.loads, 4);
    assert.deepEqual(report.stableLight.advice, []);
    assert(!report.stableLight.horizontalOverflow && report.stableLight.panelInside, JSON.stringify(report.stableLight));
    assert(report.stableLight.temperature.includes('37.2') && report.stableLight.battery.includes('78%'));
    await shot('walk-diff-device-stable-light.png');
    ok('竖屏亮色平稳状态与四项负载', report.stableLight);

    await scenario('warming');
    assert.equal(await evaluate(`document.querySelectorAll('.diff-device-advice').length`), 1);
    assert(await evaluate(`document.querySelector('.diff-device-advice').textContent.includes('摘下手机保护壳') && document.querySelector('.diff-device-advice').textContent.includes('安装散热器')`));
    await scenario('low');
    assert.equal(await evaluate(`document.querySelectorAll('.diff-device-advice').length`), 1);
    assert(await evaluate(`document.querySelector('.diff-device-advice').textContent.includes('连接充电器电源')`));
    ok('升温与低电量分别只显示对应建议');

    await scenario('combined');
    report.combinedLight = await layoutReport();
    assert.equal(report.combinedLight.advice.length, 2);
    assert(report.combinedLight.advice[0].includes('温度正在升高') && report.combinedLight.advice[1].includes('电量低于 50%'));
    assert(!report.combinedLight.horizontalOverflow && report.combinedLight.panelInside);
    await shot('walk-diff-device-combined-light.png');
    ok('升温与低电量同时提示', report.combinedLight);

    report.thresholds = await evaluate(`(() => { const d=window._diffusion.state(), f=window._diffusion.deviceMetrics;
      d.deviceDemo='auto'; d.compute='gpu';
      const at50=f(d,{p:18/26}), below50=f(d,{p:.8}), stable=f(d,{p:.2}), rising=f(d,{p:.3});
      d.deviceDemo='charging'; const charging=f(d,{p:.5});
      d.compute='npu'; const npu=f(d,{p:.5}); d.compute='cpu'; const cpu=f(d,{p:.5});
      return { at50:{battery:at50.battery,low:at50.lowBattery}, below50:{battery:below50.battery,low:below50.lowBattery},
        stable:stable.warming,rising:rising.warming,charging:{battery:charging.battery,low:charging.lowBattery,charging:charging.charging},
        npu:{gpu:npu.gpu,npu:npu.npu},cpu:{cpu:cpu.cpu,gpu:cpu.gpu,npu:cpu.npu} }; })()`);
    await evaluate(`window._diffusion.state().compute='gpu'`);
    assert.equal(report.thresholds.at50.battery, 50); assert(!report.thresholds.at50.low);
    assert(report.thresholds.below50.battery < 50 && report.thresholds.below50.low);
    assert(!report.thresholds.stable && report.thresholds.rising);
    assert(report.thresholds.charging.charging && !report.thresholds.charging.low);
    assert(report.thresholds.npu.npu > 90 && report.thresholds.npu.gpu < 10);
    assert(report.thresholds.cpu.cpu > 90 && report.thresholds.cpu.npu === 0);
    ok('50% 边界、充电中与计算模式负载', report.thresholds);

    await scenario('combined');
    await metrics(360, 780);
    await evaluate(`(() => { const s=document.querySelector('.diff-step[data-step="4"]'); s.scrollTop=s.scrollHeight; })()`);
    await sleep(120);
    report.scrollBefore = await evaluate(`document.querySelector('.diff-step[data-step="4"]').scrollTop`);
    assert(report.scrollBefore>0, 'scroll preservation test must start from a genuinely scrollable position');
    await sleep(750);
    report.scrollAfter = await evaluate(`document.querySelector('.diff-step[data-step="4"]').scrollTop`);
    assert(Math.abs(report.scrollAfter-report.scrollBefore)<2, `generation refresh reset scroll: ${report.scrollBefore} -> ${report.scrollAfter}`);
    ok('进度刷新保持结果步滚动位置', { before:report.scrollBefore, after:report.scrollAfter });
    await evaluate(`document.querySelector('.diff-step[data-step="4"]').scrollTop=0`);

    await evaluate(`theme.toggle()`);
    await metrics(412, 860);
    report.combinedDark = await layoutReport();
    assert.equal(report.combinedDark.theme, 'dark');
    assert(!report.combinedDark.horizontalOverflow && report.combinedDark.panelInside);
    await shot('walk-diff-device-combined-dark.png');
    ok('竖屏暗色双提醒', report.combinedDark);

    await metrics(360, 780);
    report.narrowDark = await layoutReport();
    assert.equal(report.narrowDark.width, 360);
    assert(!report.narrowDark.horizontalOverflow && report.narrowDark.panelInside, JSON.stringify(report.narrowDark));
    await shot('walk-diff-device-narrow-dark.png');
    ok('360px 窄屏无横向溢出', report.narrowDark);

    await evaluate(`theme.toggle(); document.querySelector('[data-a="frame-toggle"]').click()`);
    await metrics(1024, 680);
    report.landscapeLight = await layoutReport();
    await shot('walk-diff-device-landscape-light.png');
    assert(report.landscapeLight.sideBySide, JSON.stringify(report.landscapeLight));
    assert(!report.landscapeLight.horizontalOverflow && report.landscapeLight.panelInside, JSON.stringify(report.landscapeLight));
    ok('1024×680 亮色画面与设备状态双栏', report.landscapeLight);

    await evaluate(`theme.toggle()`); await sleep(220);
    report.landscapeDark = await layoutReport();
    assert(report.landscapeDark.sideBySide && report.landscapeDark.theme==='dark');
    assert(!report.landscapeDark.horizontalOverflow && report.landscapeDark.panelInside, JSON.stringify(report.landscapeDark));
    await shot('walk-diff-device-landscape-dark.png');
    ok('1024×680 暗色双栏', report.landscapeDark);

    assert.deepEqual(externalRequests, [], `external requests: ${externalRequests.join(',')}`);
    assert.deepEqual(exceptions, [], `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests=0; report.exceptions=0;
    console.log(JSON.stringify({ok:true,...report},null,2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile,{recursive:true,force:true}); } catch {}
  }
})().catch(err => { console.error(err.stack||err); process.exitCode=1; });
