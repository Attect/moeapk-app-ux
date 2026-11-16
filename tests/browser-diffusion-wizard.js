// 零依赖 Chrome CDP 走查：独立五步生图向导、SoC/后端、手势、创作工具、结果查看器。
// 运行：node tests/browser-diffusion-wizard.js（可用 CHROME_PATH 指定 Chrome）。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9341;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moeapk-ux-diff35-'));
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
async function click(selector) {
  const ok = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.click(); return true; })()`);
  assert(ok, `missing click target: ${selector}`);
  await sleep(80);
}
async function goStep(n) { await click(`.diff-step-dot[data-a="diff-go"][data-arg="${n}"]`); await sleep(360); }
async function setValue(selector, value) {
  await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)};
    el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(100);
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, 'shots', name), Buffer.from(result.data, 'base64'));
}
async function metrics(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(320);
}
async function touch(type, points) {
  await send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x:p.x, y:p.y, id:p.id == null ? i : p.id })) });
}
async function swipe(direction) {
  const rect = await evaluate(`(() => { const r=document.querySelector('#diff-pager').getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,width:r.width}; })()`);
  const y = rect.top + 34;
  const startX = direction < 0 ? rect.right - 54 : rect.left + 54;
  const endX = direction < 0 ? rect.left + 54 : rect.right - 54;
  await touch('touchStart', [{x:startX,y,id:0}]);
  for (let i=1;i<=6;i++) {
    await touch('touchMove', [{x:startX+(endX-startX)*i/6,y,id:0}]);
    await sleep(24);
  }
  await touch('touchEnd', []);
  await sleep(650);
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
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await metrics(412, 860);
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    await send('Page.navigate', { url: `${index}?theme=light&frame=port#ai/diffusion` });
    await waitFor(() => evaluate(`document.readyState==='complete' && !!document.querySelector('.diff-wizard')`), 15000, 'wizard load');
    await sleep(250);

    report.initial = await evaluate(`(() => {
      const a=document.getElementById('app').getBoundingClientRect(), w=document.querySelector('.diff-wizard').getBoundingClientRect();
      return { steps:document.querySelectorAll('.diff-step').length, nav:!!document.querySelector('.navbar'),
        globalTop:!!document.querySelector('.top-chrome'), history:!!document.querySelector('.diff-head [data-a="diff-menu"]'),
        modes:window._diffusion.computeModes.map(x=>x.id), fills:Math.abs(a.left-w.left)<1&&Math.abs(a.top-w.top)<1&&Math.abs(a.right-w.right)<1&&Math.abs(a.bottom-w.bottom)<1 };
    })()`);
    assert.equal(report.initial.steps, 5);
    assert(!report.initial.nav && !report.initial.globalTop && report.initial.history && report.initial.fills, `not independent fullscreen: ${JSON.stringify(report.initial)}`);
    assert.deepEqual(report.initial.modes, ['cpu','gpu','npu']);
    ok('独立全屏五步且无主底栏', report.initial);
    await shot('walk-diff-wizard-model-light.png');

    await click('[data-a="diff-pick-dl"][data-arg="anything-v5-mnn"]');
    await waitFor(() => evaluate(`window._diffusion.state().modelId==='anything-v5-mnn' && window._diffusion.state().step===1`), 10000, 'download then auto advance');
    await sleep(450);
    report.autoAdvance = await evaluate(`({step:window._diffusion.state().step,left:document.querySelector('#diff-pager').scrollLeft,
      width:document.querySelector('#diff-pager').clientWidth})`);
    assert(Math.abs(report.autoAdvance.left-report.autoAdvance.width)<3, `auto pager did not settle: ${JSON.stringify(report.autoAdvance)}`);
    ok('模型下载选择后自动横滑', report.autoAdvance);

    report.backends = await evaluate(`(() => { const d=window._diffusion, generic=d.models.find(m=>m.id==='anything-v5-mnn'),
      qnn=d.models.find(m=>m.id==='chillout-mix-qnn');
      return { genericNpu:d.compatibility(generic,'npu','qcom-8g3'), genericCpu:d.compatibility(generic,'cpu','other-arm'),
        genericOtherGpu:d.compatibility(generic,'gpu','other-arm'), qnnCpu:d.compatibility(qnn,'cpu','qcom-8g3'),
        qnnQcom:d.compatibility(qnn,'npu','qcom-8g3'), qnnMtk:d.compatibility(qnn,'npu','mtk-9300') }; })()`);
    assert(!report.backends.genericNpu.ok && report.backends.genericNpu.reason.includes('无法计算'));
    assert(report.backends.genericCpu.ok && !report.backends.genericOtherGpu.ok);
    assert(!report.backends.qnnCpu.ok && report.backends.qnnQcom.ok && !report.backends.qnnMtk.ok);
    ok('按模型与 SoC 过滤真实后端', report.backends);

    await click('[data-a="diff-compute"][data-arg="npu"]');
    assert(await evaluate(`window._diffusion.state().step===1 && window._diffusion.state().computeError.includes('无法计算') && !!document.querySelector('.diff-unable')`));
    await shot('walk-diff-wizard-compute-unable-light.png');
    await click('[data-a="diff-soc"][data-arg="mtk-9300"]');
    await click('[data-a="diff-compute"][data-arg="npu"]');
    assert(await evaluate(`window._diffusion.state().computeError.includes('联发科') && window._diffusion.state().computeError.includes('无法计算')`));
    await click('[data-a="diff-soc"][data-arg="other-arm"]');
    await click('[data-a="diff-compute"][data-arg="gpu"]');
    assert(await evaluate(`window._diffusion.state().computeError.includes('无法计算')`));
    ok('高通/联发科/其它 SoC 与不兼容明确提示');
    await click('[data-a="diff-soc"][data-arg="qcom-8g3"]');
    await click('[data-a="diff-compute"][data-arg="gpu"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===2`), 3000, 'compute auto advance');

    report.promptLayout = await evaluate(`(() => { const p=document.querySelector('.diff-prompt').getBoundingClientRect();
      return { height:p.height, textButtons:[...document.querySelectorAll('.diff-prompt-actions .diff-text-btn')].map(x=>x.textContent.trim()),
        modelHints:window._diffusion.modelPromptSuggestions(window._diffusion.models.find(x=>x.id==='anything-v5-mnn')).length }; })()`);
    assert(report.promptLayout.height>=150 && report.promptLayout.modelHints===1, `prompt layout: ${JSON.stringify(report.promptLayout)}`);
    assert(report.promptLayout.textButtons.some(x=>x.includes('提示词库')) && report.promptLayout.textButtons.some(x=>x.includes('图像反推')) && report.promptLayout.textButtons.some(x=>x.includes('检查提示词')));
    ok('大提示词输入框与三个文字操作按钮', report.promptLayout);

    // 真实触摸横滑：第 3 步 → 第 4 步，再向右滑回。
    await swipe(-1);
    report.swipeNext = await evaluate(`({step:window._diffusion.state().step,index:document.querySelector('#diff-pager').scrollLeft/document.querySelector('#diff-pager').clientWidth})`);
    assert.equal(report.swipeNext.step, 3, `touch swipe next failed: ${JSON.stringify(report.swipeNext)}`);
    await swipe(1);
    report.swipePrev = await evaluate(`window._diffusion.state().step`);
    report.swipePrevDetails = await evaluate(`({left:document.querySelector('#diff-pager').scrollLeft,width:document.querySelector('#diff-pager').clientWidth,
      index:document.querySelector('#diff-pager').scrollLeft/document.querySelector('#diff-pager').clientWidth})`);
    assert.equal(report.swipePrev, 2, `touch swipe previous failed: ${JSON.stringify(report.swipePrevDetails)}`);
    ok('真实触摸左右滑动切步', { next:report.swipeNext, previous:report.swipePrev });

    await click('[data-a="diff-prompt-lib"]');
    assert(await evaluate(`document.querySelector('.dlg-title').textContent.includes('提示词库') && document.querySelectorAll('.dlg [data-a="plib-model-use"]').length===1`));
    await click('.dlg [data-a="plib-model-use-append"]');
    assert(await evaluate(`window._diffusion.state().prompt.includes('white hair')`));
    await click('[data-a="diff-prompt-lib"]');
    const savedBefore = await evaluate(`document.querySelectorAll('.dlg [data-a="plib-use"]').length`);
    await click('.dlg [data-a="plib-save-current"]');
    assert.equal(await evaluate(`document.querySelectorAll('.dlg [data-a="plib-use"]').length`), savedBefore+1);
    assert(await evaluate(`document.querySelector('.dlg').textContent.includes('我的收藏')`));
    await click('.dlg [data-a="plib-use"]');
    await setValue('#diff-prompt', '1girl, (masterpiece:abc');
    await click('[data-a="diff-prompt-check"]');
    report.promptValidation = await evaluate(`document.querySelector('.dlg').textContent`);
    assert(report.promptValidation.includes('未闭合') && report.promptValidation.includes('不是有效数字'));
    await click('.dlg [data-dlg="0"]');
    await setValue('#diff-prompt', '1girl, (masterpiece:1.2), best quality');
    await click('[data-a="diff-prompt-check"]');
    assert(await evaluate(`document.querySelector('.dlg-title').textContent.includes('语法正常')`));
    await click('.dlg [data-dlg="0"]');
    assert.deepEqual(await evaluate(`window._diffusion.modelPromptSuggestions(window._diffusion.models.find(x=>x.id==='chillout-mix-qnn'))`), []);
    ok('模型推荐直接追加、当前草稿页内收藏与语法检查', report.promptValidation);
    await click('[data-a="diff-neg-toggle"]');
    assert(await evaluate(`!!document.querySelector('[data-keep="diff-neg"]')`));
    await click('[data-a="diff-caption"]');
    await click('.dlg [data-a="diff-caption-img"]');
    await waitFor(() => evaluate(`!!document.querySelector('.dlg-title') && document.querySelector('.dlg-title').textContent.includes('反推结果')`), 7000, 'caption result');
    await click('[data-a="caption-mode"][data-arg="short"]');
    assert(await evaluate(`document.querySelector('.caption-result').textContent.length>10`));
    await click('.dlg [data-dlg="1"]');
    await sleep(2750); // 让反推 toast 自然退出，避免遮住后续遮罩工具栏走查图。
    ok('提示词库、负向词与三档图片反推保留');

    // 改走局部重绘：上方大画面 canvas，下方编辑工具栏。
    await goStep(0);
    await click('[data-a="diff-mode"][data-arg="inpaint"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===1`), 3000, 'inpaint returns compute');
    await click('[data-a="diff-compute"][data-arg="gpu"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===2`), 3000, 'inpaint input');
    await click('.diff-stage-empty[data-a="diff-base"]');
    await click('.dlg [data-a="diff-pick-base"]');
    await sleep(550);
    const maskLayout = await evaluate(`(() => { const c=document.querySelector('#mask-canvas'), t=document.querySelector('.mask-toolbar');
      if(!c||!t) return null; const a=c.getBoundingClientRect(), b=t.getBoundingClientRect(), app=document.getElementById('app').getBoundingClientRect();
      const first=t.querySelector('button').getBoundingClientRect(), last=t.querySelector('.diff-strokes').getBoundingClientRect();
      return { canvasHeight:a.height, stacked:a.bottom<=b.top+1, leftInset:first.left-app.left, rightInset:app.right-last.right,
        x:a.left+a.width*.45, y:a.top+a.height*.45 }; })()`);
    assert(maskLayout && maskLayout.canvasHeight>=180 && maskLayout.stacked, `mask stage/toolbar mismatch: ${JSON.stringify(maskLayout)}`);
    assert(maskLayout.leftInset>=8 && maskLayout.rightInset>=8, `mask controls touch screen edge: ${JSON.stringify(maskLayout)}`);
    await send('Input.dispatchMouseEvent', {type:'mousePressed',x:maskLayout.x,y:maskLayout.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:maskLayout.x+45,y:maskLayout.y+30,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:maskLayout.x+45,y:maskLayout.y+30,button:'left',clickCount:1});
    await sleep(120);
    assert(await evaluate(`window._diffusion.state().mask.strokes.length>0`), 'mask pointer drawing missing');
    assert(await evaluate(`document.querySelector('.diff-strokes').textContent.trim()==='1 笔'`), 'mask stroke count did not update on pointer up');
    report.creativeLight = await evaluate(`(() => { const css=el=>getComputedStyle(el);
      return { editor:css(document.querySelector('.diff-media-editor')).backgroundColor,
        prompt:css(document.querySelector('.diff-prompt-block')).backgroundColor,
        stage:css(document.querySelector('.diff-workstage')).backgroundColor,
        input:css(document.querySelector('.diff-prompt')).backgroundColor,
        hintBg:css(document.querySelector('.diff-mask-label')).backgroundColor,
        hintColor:css(document.querySelector('.diff-mask-label')).color,
        onSurface:css(document.querySelector('.diff-workhead h2')).color }; })()`);
    assert.equal(report.creativeLight.editor,report.creativeLight.prompt,'创作工具与提示词必须统一主题 surface');
    assert.equal(report.creativeLight.stage,report.creativeLight.input,'创作画布必须使用主题 surfaceVariant 对应色');
    assert.equal(report.creativeLight.hintColor,report.creativeLight.onSurface,'遮罩提示必须随主题前景色');
    assert(!/rgba?\(10, 14, 24|rgba?\(56, 44, 72/.test(report.creativeLight.stage+report.creativeLight.hintBg));
    await shot('walk-diff-wizard-inpaint-light.png');
    ok('局部重绘上画面下工具栏与真实涂抹', maskLayout);
    ok('亮色创作画布/工具/提示统一主题', report.creativeLight);

    await click('#diff-foot [data-a="diff-next"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===3`), 3000, 'params step');
    const beforeSteps = await evaluate(`window._diffusion.state().steps`);
    await click('[data-a="diff-step-delta"][data-arg="1"]');
    assert.equal(await evaluate(`window._diffusion.state().steps`), beforeSteps+1);
    await click('[data-a="diff-step-delta"][data-arg="-1"]');
    await setValue('[data-live="diff-steps"]', '28');
    assert.equal(await evaluate(`window._diffusion.state().steps`), 28);
    report.params = await evaluate(`({numeric:document.querySelector('[data-live="diff-steps"]').type,
      range:!!document.querySelector('input[type="range"][data-live="diff-steps"]'),samplers:document.querySelectorAll('[data-a="dc-sampler"]').length,
      sweep:!!document.querySelector('[data-a="diff-sweep-open"]'),hires:!!document.querySelector('[data-a="diff-hires"]'),
      aspect:document.querySelectorAll('[data-a="dc-ar"]').length})`);
    assert.equal(report.params.numeric,'number'); assert(!report.params.range);
    assert.equal(report.params.samplers,9); assert(report.params.sweep&&report.params.hires);
    assert.equal(report.params.aspect,0,'SD1.5 Anything V5 不得套用 SDXL 宽高比');
    await click('[data-a="diff-sweep-open"]');
    await setValue('.dlg [data-keep="sw-v1"]', '1..2');
    assert(await evaluate(`document.querySelector('.dlg').textContent.includes('预计 2 张')`));
    await click('.dlg [data-dlg="1"]');
    assert(await evaluate(`window._diffusion.state().sweep.enabled && window._diffusion.state().sweep.items.length===2`));
    await click('[data-a="diff-hires"]'); await click('[data-a="diff-hires"]');
    await sleep(2750);
    await shot('walk-diff-wizard-params-light.png');
    ok('步数数字加减及全部高级参数/双图扫描', report.params);

    await click('#diff-foot [data-a="diff-gen"]');
    await waitFor(() => evaluate(`window._diffusion.state().step===4`), 3000, 'auto advance to result');
    await waitFor(() => evaluate(`window._diffusion.state().history.length===2 && window._diffusion.state().curId`), 12000, 'sweep results');
    await sleep(350);
    report.result = await evaluate(`(() => { const d=window._diffusion.state(),r=d.history.find(x=>x.id===d.curId);
      return { count:d.history.length,info:r.info,save:!!document.querySelector('.diff-head [data-a="diff-save-asset"]'),
        share:!!document.querySelector('.diff-head [data-a="diff-share"]'),template:!!document.querySelector('[data-a="diff-as-template"]'),
        rerun:!!document.querySelector('[data-a="diff-rerun"]') }; })()`);
    assert.equal(report.result.count,2); assert(report.result.info.includes('MNN 计算'));
    assert(report.result.info.startsWith('Anything V5'),'结果必须来自真实 SD1.5 MNN 演示模型');
    assert(!report.result.info.includes('Anima'),'不得再出现虚构 Anima CPU/MNN 结果');
    assert(report.result.save&&report.result.share&&report.result.template&&report.result.rerun);
    report.resultSurfaceLight = await evaluate(`(() => { const css=el=>getComputedStyle(el);
      return { frame:css(document.querySelector('.diff-art-frame')).backgroundColor,
        zoomBg:css(document.querySelector('.diff-zoom-badge')).backgroundColor,
        zoomColor:css(document.querySelector('.diff-zoom-badge')).color,
        favBg:css(document.querySelector('.diff-fav')).backgroundColor,
        onSurface:css(document.querySelector('.diff-result-info')).color }; })()`);
    assert.equal(report.resultSurfaceLight.frame,report.creativeLight.stage,'结果画布必须使用主题 surfaceVariant 对应色');
    assert.equal(report.resultSurfaceLight.zoomColor,report.resultSurfaceLight.onSurface);
    assert.equal(report.resultSurfaceLight.zoomBg,report.resultSurfaceLight.favBg);
    assert(!/rgba?\(10, 14, 24/.test(report.resultSurfaceLight.frame+report.resultSurfaceLight.zoomBg+report.resultSurfaceLight.favBg));
    await shot('walk-diff-wizard-result-light.png');
    ok('扫描结果与标题栏保存/分享', report.result);

    await click('.diff-result-stage [data-a="diff-open-result"]');
    await waitFor(() => evaluate(`!!document.querySelector('.diff-viewer') && nav.current().page==='diff-image'`), 3000, 'result fullscreen viewer');
    assert(await evaluate(`!!document.querySelector('.diff-viewer-stage') && !!document.querySelector('.diff-viewer-tools') && !document.querySelector('.navbar')`));
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.diff-viewer')).backgroundColor`),'rgb(10, 7, 18)','只有全屏查看器保留黑底');
    await click('[data-a="diff-view-zoom"]');
    assert(await evaluate(`document.querySelector('.diff-viewer-stage').classList.contains('zoomed')`));
    await click('.diff-viewer-head [data-a="back"]');
    assert(await evaluate(`nav.current().page==='diffusion' && window._diffusion.state().step===4`));
    await click('.diff-head [data-a="diff-menu"]');
    assert(await evaluate(`document.querySelectorAll('.drawer [data-a="diff-open-result"]').length>=1 && !!document.querySelector('.drawer [data-keep="diff-hist-q"]')`));
    await click('.drawer [data-a="diff-open-result"]');
    await waitFor(() => evaluate(`nav.current().page==='diff-image'`), 3000, 'history fullscreen viewer');
    await click('.diff-viewer-head [data-a="back"]');
    ok('结果与历史图片均可点击全屏放大并返回');

    await click('.diff-head [data-a="diff-save-asset"]');
    await click('.diff-head [data-a="diff-share"]');
    assert(await evaluate(`S.x.assets.some(a=>a.from==='ai')`));
    await click('.diff-head [data-a="diff-menu"]');
    await click('.drawer [data-a="diff-settings"]');
    assert(await evaluate(`nav.current().page==='diff-config' && !!document.querySelector('.diff-config-legacy [data-live="diff-steps"]')`));
    await evaluate(`nav.pop()`); await sleep(120);
    ok('保存素材、分享及原独立生成设置页保留');

    await sleep(2750); // 结果暗色 / 横屏走查图不被人为堆叠的 toast 遮挡。
    await evaluate(`theme.toggle()`); await sleep(250);
    report.resultSurfaceDark = await evaluate(`(() => { const css=el=>getComputedStyle(el);
      return { frame:css(document.querySelector('.diff-art-frame')).backgroundColor,
        zoomBg:css(document.querySelector('.diff-zoom-badge')).backgroundColor,
        zoomColor:css(document.querySelector('.diff-zoom-badge')).color,
        onSurface:css(document.querySelector('.diff-result-info')).color }; })()`);
    assert.notEqual(report.resultSurfaceDark.frame,report.resultSurfaceLight.frame,'暗色画布必须切换主题表面');
    assert.notEqual(report.resultSurfaceDark.zoomBg,report.resultSurfaceLight.zoomBg,'暗色放大提示必须切换主题表面');
    assert.equal(report.resultSurfaceDark.zoomColor,report.resultSurfaceDark.onSurface);
    await shot('walk-diff-wizard-result-dark.png');
    assert.equal(await evaluate(`document.documentElement.dataset.theme`),'dark');
    await evaluate(`document.querySelector('[data-a="frame-toggle"]').click()`);
    await metrics(1024,680);
    assert(await evaluate(`!document.querySelector('.navbar') && document.querySelector('.diff-wizard').getBoundingClientRect().width>700`));
    await shot('walk-diff-wizard-result-landscape-dark.png');
    await goStep(2); await sleep(450);
    await shot('walk-diff-wizard-inpaint-landscape-dark.png');
    report.landscape = await evaluate(`(() => { const css=el=>getComputedStyle(el);
      return { overflow:document.documentElement.scrollWidth>innerWidth,
        stage:!!document.querySelector('#mask-canvas'),nav:!!document.querySelector('.navbar'),
        editor:css(document.querySelector('.diff-media-editor')).backgroundColor,
        prompt:css(document.querySelector('.diff-prompt-block')).backgroundColor,
        canvas:css(document.querySelector('.diff-workstage')).backgroundColor,
        hintColor:css(document.querySelector('.diff-mask-label')).color,
        onSurface:css(document.querySelector('.diff-workhead h2')).color }; })()`);
    assert(!report.landscape.overflow&&report.landscape.stage&&!report.landscape.nav);
    assert.equal(report.landscape.editor,report.landscape.prompt,'暗色创作工具和提示词必须同 surface');
    assert.notEqual(report.landscape.canvas,report.creativeLight.stage,'暗色创作画布必须切换主题表面');
    assert.equal(report.landscape.hintColor,report.landscape.onSurface);
    ok('暗色创作与结果表面随主题', { result:report.resultSurfaceDark, creative:report.landscape });
    ok('暗色与 1024×680 横屏');

    await evaluate(`document.querySelector('[data-a="frame-toggle"]').click()`);
    await metrics(360,780); await goStep(4);
    report.narrow = await evaluate(`(() => { const a=document.getElementById('app').getBoundingClientRect(),h=document.querySelector('.diff-head-actions').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,actionsInside:h.right<=a.right+1,steps:document.querySelectorAll('.diff-step').length}; })()`);
    assert(!report.narrow.overflow&&report.narrow.actionsInside&&report.narrow.steps===5,`narrow mismatch: ${JSON.stringify(report.narrow)}`);
    await shot('walk-diff-wizard-result-narrow-dark.png');
    ok('360px 窄屏与结果顶栏操作');

    await evaluate(`ACTIONS['diff-exit']()`); await sleep(100);
    assert(await evaluate(`!nav.current() && S.tab==='ai' && !!document.querySelector('.navbar')`));
    ok('退出向导恢复 AI 主界面底栏');
    assert.deepEqual(externalRequests,[],`external requests: ${externalRequests.join(',')}`);
    assert.deepEqual(exceptions,[],`browser exceptions: ${JSON.stringify(exceptions)}`);
    report.externalRequests=0; report.exceptions=0;
    console.log(JSON.stringify({ok:true,...report},null,2));
  } finally {
    try { if (ws) ws.close(); } catch {}
    chrome.kill(); await sleep(400);
    try { fs.rmSync(profile,{recursive:true,force:true}); } catch {}
  }
})().catch(err => { console.error(err.stack||err); process.exitCode=1; });
