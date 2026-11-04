// 零依赖 Chrome CDP 走查：LLM 配置 + 流式自由滚动 + file:// + 明暗/横竖屏。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-ai25-'));
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

let ws;
let nextId = 1;
const pending = new Map();
const externalRequests = [];
const exceptions = [];
function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve());
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
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function navigate(url) {
  await send('Page.navigate', { url });
  await waitFor(() => evaluate('document.readyState === "complete" && typeof nav === "object"'), 15000, 'page load');
  await sleep(200);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}

(async () => {
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 412, height: 860, deviceScaleFactor: 1, mobile: false,
    });
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await navigate(`${index}#ai/llm-config/bonsai-vl`);
    const configText = await evaluate('document.body.innerText');
    if (!configText.includes('输出上限') || !configText.includes('微批大小')) {
      throw new Error('LLM config labels missing');
    }
    if (configText.includes('NPU') && !configText.includes('没有 NPU')) {
      throw new Error('unexpected selectable NPU');
    }
    await evaluate('document.querySelector(\'[data-a="lc-max-output"][data-arg="8192"]\').click()');
    const output = await evaluate('window._aiShared.cfgOf("bonsai-vl").maxOutput');
    if (output !== 8192) throw new Error(`maxOutput=${output}`);
    await evaluate('document.querySelector(\'[data-a="lc-ctx"][data-arg="262144"]\').click()');
    const context = await evaluate('window._aiShared.cfgOf("bonsai-vl").ctxLen');
    if (context !== 262144) throw new Error(`ctxLen=${context}`);
    await shot('walk-round26-config-light.png');

    await evaluate('location.hash = "#ai/llm-config/bonsai-1-7b-q1"');
    await sleep(200);
    const smallModel = await evaluate(`({
      has32k: !!document.querySelector('[data-a="lc-ctx"][data-arg="32768"]'),
      has256k: !!document.querySelector('[data-a="lc-ctx"][data-arg="262144"]')
    })`);
    if (!smallModel.has32k || smallModel.has256k) {
      throw new Error(`model context choices incorrect: ${JSON.stringify(smallModel)}`);
    }
    await evaluate('document.querySelector(\'[data-a="lc-ctx"][data-arg="32768"]\').click()');
    await evaluate('location.hash = "#apk"');
    await sleep(200);
    await shot('walk-round26-update-light.png');
    await evaluate('document.querySelector(\'[data-a="theme-toggle"]\').click()');
    await sleep(150);
    await shot('walk-round26-update-dark.png');
    await evaluate('document.querySelector(\'[data-a="theme-toggle"]\').click()');

    await evaluate('nav.push("llm")');
    await sleep(200);
    await evaluate('keepSet("llm-q", "你好"); document.querySelector(\'[data-a="llm-send"]\').click()');
    await waitFor(() => evaluate('!!(window._aiShared.curSess() && window._aiShared.curSess().loaded)'), 15000, 'model loaded');
    await waitFor(() => evaluate('window._aiShared.curSess() && window._aiShared.curSess().thinking === false'), 15000, 'first reply');

    await evaluate(`(() => {
      const s = window._aiShared.curSess();
      for (let i = 0; i < 14; i++) s.messages.push({ role: 'ai', text: '历史消息 ' + i + '：' + '用于验证滚动位置。'.repeat(18) });
      render();
      const c = document.getElementById('chat');
      c.scrollTop = c.scrollHeight;
      c.dispatchEvent(new Event('scroll'));
      keepSet('llm-q', '继续');
      document.querySelector('[data-a="llm-send"]').click();
    })()`);
    await waitFor(() => evaluate('window._aiShared.curSess().thinking && window._aiShared.curSess().partial.length >= 12'), 10000, 'streaming');
    const before = await evaluate(`(() => {
      const c = document.getElementById('chat');
      c.scrollTop = 0;
      c.dispatchEvent(new Event('scroll'));
      return window._aiShared.curSess().partial.length;
    })()`);
    await sleep(500);
    const scrolled = await evaluate(`(() => {
      const c = document.getElementById('chat');
      return { top: c.scrollTop, partial: window._aiShared.curSess().partial.length,
        latest: document.querySelector('.chat-latest').classList.contains('on'),
        follow: S.x.llmFollow };
    })()`);
    if (scrolled.top !== 0 || scrolled.partial <= before || !scrolled.latest || scrolled.follow !== false) {
      throw new Error(`free scroll failed: ${JSON.stringify({ before, scrolled })}`);
    }
    await shot('walk-round26-scroll-paused-light.png');
    await evaluate('document.querySelector(\'.chat-latest\').click()');
    await waitFor(() => evaluate(`(() => {
      const c = document.getElementById('chat');
      return S.x.llmFollow === true && c.scrollHeight - c.scrollTop - c.clientHeight <= 26;
    })()`), 5000, 'return to latest');

    await evaluate('document.querySelector(\'[data-a="theme-toggle"]\').click()');
    await evaluate('document.querySelector(\'[data-a="frame-toggle"]\').click()');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1024, height: 680, deviceScaleFactor: 1, mobile: false,
    });
    await sleep(300);
    await shot('walk-round26-chat-dark-land.png');
    if (externalRequests.length) throw new Error(`external requests: ${externalRequests.join(',')}`);
    if (exceptions.length) throw new Error(`browser exceptions: ${JSON.stringify(exceptions)}`);
    console.log(JSON.stringify({ ok: true, output, context, smallModel, before, scrolled, externalRequests: 0, exceptions: 0 }, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome 子进程退出稍慢时仅保留临时目录，不影响走查结论 */ }
  }
})().catch(err => {
  console.error(err.stack || err);
  process.exitCode = 1;
});
