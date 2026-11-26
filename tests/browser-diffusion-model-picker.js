// 零依赖 Chrome CDP 走查：已下载 / 全部模型、混合权重包、下载与响应式布局。
// 运行：node tests/browser-diffusion-model-picker.js（可用 CHROME_PATH 指定 Chrome）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9363;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-model-picker-'));
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
async function goStep(n) {
  await click(`.diff-step-dot[data-a="diff-go"][data-arg="${n}"]`);
  await sleep(420);
}
async function layoutState() {
  return evaluate(`(() => { const step=document.querySelector('.diff-step[data-step="0"]');
    return { overflow:step.scrollWidth>step.clientWidth+1, documentOverflow:document.documentElement.scrollWidth>innerWidth,
      cards:[...step.querySelectorAll('.diff-model')].map(el=>({id:el.dataset.modelId,ready:el.dataset.ready,selected:el.classList.contains('on')})),
      scope:[...step.querySelectorAll('.diff-model-scope button')].map(el=>({text:el.textContent.trim(),pressed:el.getAttribute('aria-pressed')})),
      columns:getComputedStyle(step.querySelector('.diff-models')).gridTemplateColumns,
      localSamples:step.querySelectorAll('.diff-local-model .model-samples').length,
      families:step.querySelectorAll('.diff-family').length }; })()`);
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
    await send('Page.navigate', { url: `${index}?theme=light&frame=port#ai/diffusion` });
    await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.diff-model-scope')`), 15000, 'model picker');
    await waitFor(() => evaluate(`[...document.querySelectorAll('.diff-step[data-step="0"] .model-sample img')].every(img=>img.complete&&img.naturalWidth>0)`), 10000, 'catalog thumbnails');

    report.initial = await layoutState();
    assert.equal(await evaluate(`window._diffusion.state().modelView`), 'all');
    assert.equal(report.initial.cards.length, 3);
    assert.equal(report.initial.families, 2);
    assert(report.initial.scope[0].text.includes('已下载0') && report.initial.scope[1].text.includes('全部模型3'));
    await shot('walk-diff-model-picker-all-light.png');
    ok('无下载时默认全部模型，保留三组目录与完整样例', report.initial);

    await click('[data-a="diff-model-view"][data-arg="downloaded"]');
    report.empty = await evaluate(`(() => ({empty:!!document.querySelector('.diff-model-empty'),
      text:document.querySelector('.diff-model-empty').textContent,
      step:window._diffusion.state().step,modelId:window._diffusion.state().modelId,
      cards:document.querySelectorAll('.diff-step[data-step="0"] .diff-model').length}))()`);
    assert(report.empty.empty && report.empty.text.includes('还没有已下载') && report.empty.cards === 0);
    assert(report.empty.step === 0 && report.empty.modelId === null);
    await shot('walk-diff-model-picker-empty-light.png');
    await click('.diff-model-empty [data-a="diff-model-view"][data-arg="all"]');
    assert.equal(await evaluate(`window._diffusion.state().modelView`), 'all');
    ok('已下载空态可返回全部，筛选不改选、不跳步', report.empty);

    // 两个基础模型、三个本机权重包；Chillout 的目录首包并未下载。
    await evaluate(`(() => { S.x.localModels=[
      {id:'anything-v5-mnn',name:'Anything-V5-SD15-MNN.zip',kind:'生图',size:1800000000},
      {id:'chillout-mix-qnn-8gen1',name:'ChilloutMix_qnn2.28_8gen1.zip',kind:'生图',size:1150000000},
      {id:'chillout-mix-mnn',name:'ChilloutMix_mnn_cpu.zip',kind:'生图',size:1800000000}
    ]; const d=window._diffusion.state(); d.modelId='chillout-mix-mnn'; d.modelPreviewId=null; d.modelView=null; render(); })()`);
    await waitFor(() => evaluate(`[...document.querySelectorAll('.diff-local-cover img')].every(img=>img.complete&&img.naturalWidth>0)`), 10000, 'local covers');
    report.downloaded = await layoutState();
    assert.equal(await evaluate(`window._diffusion.state().modelView`), 'downloaded');
    assert.deepEqual(report.downloaded.cards.map(x => x.id), ['chillout-mix-mnn', 'anything-v5-mnn']);
    assert(report.downloaded.cards.every(x => x.ready === 'true'));
    assert(report.downloaded.cards[0].selected && report.downloaded.localSamples === 0 && report.downloaded.families === 0);
    assert.equal(await evaluate(`document.querySelectorAll('.diff-local-model[data-model-id="chillout-mix-mnn"] .diff-variant.ready').length`), 2);
    assert(await evaluate(`window._diffusion.modelReady(window._diffusion.models.find(m=>m.id==='chillout-mix-mnn')) &&
      !window._diffusion.modelReady(window._diffusion.models.find(m=>m.id==='chillout-mix-qnn'))`));
    await shot('walk-diff-model-picker-downloaded-light.png');
    ok('已下载默认视图当前模型置顶，混合组展示真实已下载非首包', report.downloaded);

    await click('[data-a="diff-pick-use"][data-arg="anything-v5-mnn"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===1 && window._diffusion.state().modelId==='anything-v5-mnn'`), 3000, 'local model auto advance');
    await goStep(0);
    assert.equal((await layoutState()).cards[0].id, 'anything-v5-mnn');
    await click('[data-a="diff-pick-variant"][data-arg="chillout-mix-mnn"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===1 && window._diffusion.state().modelId==='chillout-mix-mnn'`), 3000, 'ready variant auto advance');
    await goStep(0);
    ok('本机卡片与权重包均直接选用并自动前进，返回后当前模型置顶');

    await click('[data-a="diff-model-view"][data-arg="all"]');
    report.allReady = await evaluate(`(() => { const root=document.querySelector('.diff-step[data-step="0"]');
      return {cards:root.querySelectorAll('.diff-model').length,ready:root.querySelectorAll('.diff-model[data-ready="true"]').length,
        badges:root.querySelectorAll('.diff-ready-tag').length,readyChips:root.querySelectorAll('.diff-variant.ready').length,
        samples:root.querySelectorAll('.model-samples').length,
        familySpan:getComputedStyle(root.querySelector('.diff-family')).gridColumn,
        step:window._diffusion.state().step,modelId:window._diffusion.state().modelId}; })()`);
    assert.deepEqual(report.allReady, { cards:3, ready:2, badges:2, readyChips:2, samples:3,
      familySpan:'1 / -1', step:0, modelId:'chillout-mix-mnn' });
    await shot('walk-diff-model-picker-all-ready-light.png');
    ok('全部视图保留样例，已下载标记清晰且家族标题横跨双列', report.allReady);

    // 下载同组的非首选包：旧选中包不得遮住新预览包，进度重绘不得回顶。
    await click('[data-a="diff-pick-variant"][data-arg="chillout-mix-qnn-min"]');
    await waitFor(() => evaluate(`document.querySelector('.diff-step[data-step="0"] .diff-model[data-model-id="chillout-mix-qnn-min"] .diff-model-progress')`), 3000, 'non-first package download');
    const beforeScroll = await evaluate(`(() => { const el=document.querySelector('.diff-step[data-step="0"]'); el.scrollTop=180; return el.scrollTop; })()`);
    await sleep(700);
    const afterScroll = await evaluate(`document.querySelector('.diff-step[data-step="0"]').scrollTop`);
    assert(Math.abs(afterScroll-beforeScroll)<=2, `download redraw moved list: ${beforeScroll} → ${afterScroll}`);
    assert.equal(await evaluate(`window._diffusion.state().modelId`), 'chillout-mix-mnn');
    assert.equal(await evaluate(`window._diffusion.state().step`), 0);
    await shot('walk-diff-model-picker-downloading-light.png');
    await waitFor(() => evaluate(`window._diffusion.state().step===1 && window._diffusion.state().modelId==='chillout-mix-qnn-min'`), 10000, 'download completion');
    assert(await evaluate(`S.x.localModels.some(m=>m.id==='chillout-mix-qnn-min')`));
    assert.equal(await evaluate(`window._diffusion.state().modelView`), 'all', '手动选择的全部视图不得被下载完成覆盖');
    ok('非首包下载保持可见与滚动位置，完成才登记、选用并前进', { beforeScroll, afterScroll });

    // A 下载途中明确选用 B 并继续计算设置：A 后台完成只能登记，不得覆盖 B。
    await goStep(0);
    await click('[data-a="diff-pick-variant"][data-arg="chillout-mix-qnn"]');
    await waitFor(() => evaluate(`!!S.x.jobs['diff-mdl-chillout-mix-qnn'] && !S.x.jobs['diff-mdl-chillout-mix-qnn'].done`), 3000, 'background download A');
    await click('[data-a="diff-pick-use"][data-arg="anything-v5-mnn"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===1 && window._diffusion.state().modelId==='anything-v5-mnn'`), 3000, 'newer selection B');
    await click('[data-a="diff-compute"][data-arg="gpu"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===2`), 3000, 'newer compute configuration');
    await waitFor(() => evaluate(`S.x.jobs['diff-mdl-chillout-mix-qnn'].done && S.x.localModels.some(m=>m.id==='chillout-mix-qnn')`), 10000, 'background A completion');
    report.backgroundSelection = await evaluate(`(() => { const d=window._diffusion.state();
      return {step:d.step,modelId:d.modelId,compute:d.compute,preview:d.modelPreviewId}; })()`);
    assert.deepEqual(report.backgroundSelection, { step:2, modelId:'anything-v5-mnn', compute:'gpu', preview:'anything-v5-mnn' });
    ok('后台下载仅登记，不覆盖后续模型选择、计算模式或所在步骤', report.backgroundSelection);

    await goStep(0);
    await click('[data-a="diff-model-view"][data-arg="downloaded"]');
    // 模型中心的 rec-dl 完成态也应直接被生图选择器识别。
    await evaluate(`(() => { S.x.jobs['rec-dl-animagine-v4-sdxl']={label:'下载',p:1,done:true}; render(); })()`);
    assert(await evaluate(`window._diffusion.modelReady(window._diffusion.models.find(m=>m.id==='animagine-v4-sdxl'))`));
    assert.equal((await layoutState()).cards.length, 3);
    ok('模型中心下载完成态与生图已下载视图互通');

    await click('[data-a="theme-toggle"]');
    await metrics(360, 780);
    report.narrow = await layoutState();
    assert(!report.narrow.overflow && !report.narrow.documentOverflow);
    assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
    await shot('walk-diff-model-picker-downloaded-narrow-dark.png');
    await click('[data-a="frame-toggle"]'); await metrics(1024, 680);
    report.landscape = await layoutState();
    assert(!report.landscape.overflow && !report.landscape.documentOverflow);
    assert.equal(report.landscape.columns.split(' ').length, 2);
    await shot('walk-diff-model-picker-downloaded-dark-landscape.png');
    await click('[data-a="theme-toggle"]');
    await shot('walk-diff-model-picker-downloaded-light-landscape.png');
    ok('360px 暗色与 1024×680 明暗双列无横向溢出', { narrow:report.narrow, landscape:report.landscape });

    // 删除一个确实持有关联完成任务的包，返回后不得再被历史任务判为已下载。
    await evaluate(`S.x.mdlCat='diffusion'; nav.push('models')`);
    await waitFor(() => evaluate(`!!document.querySelector('.mdl-page')`), 3000, 'model hub for deletion');
    await click('.model-item[data-model-id="chillout-mix-qnn-min"] [data-a="models-del"]');
    await click('.dlg [data-dlg="1"]');
    report.deletion = await evaluate(`(() => { const m=window._diffusion.models.find(x=>x.id==='chillout-mix-qnn-min');
      return {ready:window._diffusion.modelReady(m),local:S.x.localModels.some(x=>x.id===m.id),
        directTask:!!S.x.jobs['diff-mdl-'+m.id],hubTask:!!S.x.jobs['rec-dl-'+m.id]}; })()`);
    assert.deepEqual(report.deletion, { ready:false, local:false, directTask:false, hubTask:false });
    await evaluate(`nav.pop()`); await sleep(250);
    assert.equal(await evaluate(`document.querySelectorAll('.diff-step[data-step="0"] [data-a="diff-pick-variant"][data-arg="chillout-mix-qnn-min"]').length`), 0);
    ok('模型中心删除后清除历史完成态，生图已下载视图同步移除权重包', report.deletion);

    assert.deepEqual(externalRequests, [], `external requests: ${externalRequests.join(',')}`);
    assert.deepEqual(exceptions, [], `browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests = 0; report.exceptions = 0;
    console.log(JSON.stringify({ ok:true, ...report }, null, 2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile, { recursive:true, force:true }); } catch {}
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
