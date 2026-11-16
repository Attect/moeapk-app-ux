// 独立全屏生图向导 + 生成设置 + 结果查看器。
// 对应 ui/ai/DiffusionScreen.kt、DiffConfigScreen.kt（Compose 同步见 docs/design-notes.md）。
// 保留能力：局部重绘 / 高清修复 / 宽高比 / 过程预览 / 9 种采样器 / 参数扫描 /
// 结果模板与重跑 / 收藏与删除撤销 / 提示词库·tag 工具·补全·反推 / seed 锁 / 分阶段耗时。
(function () {
  const { A } = window._aiShared;
  const DIFF_MODELS = DB.AI.filter(m => m.type === 'model' && m.kind === 'diffusion');
  const DIFF_DEF = { sampler: 'DPM++ 2M', cfg: 7, seed: -1, size: 512, ar: '1:1', preview: true, hiresTile: 512 };
  const SAMPLERS = ['DPM++ 2M', 'DPM++ 2M Karras', 'DPM++ 2M SDE', 'DPM++ 2M SDE Karras', 'Euler', 'Euler Karras', 'Euler A', 'Euler A Karras', 'LCM'];
  const DIFF_HUES = [340, 26, 200, 268, 150, 45];
  const STEPS = [
    { title: '模型与生成方式', short: '模型' },
    { title: '计算模式', short: '计算' },
    { title: '创作输入', short: '输入' },
    { title: '生成参数', short: '参数' },
    { title: '生成结果', short: '结果' }
  ];
  // 计算模式只有三种。Anima 是模型家族，永远不出现在这里。
  const COMPUTE = [
    { id: 'cpu', label: 'CPU', engine: 'CPU 计算', desc: '通用 arm64 路径，兼容性优先，速度与功耗成本较高。' },
    { id: 'gpu', label: 'GPU', engine: 'MNN 计算', desc: '使用模型随附的 MNN 计算包与设备 GPU 驱动。' },
    { id: 'npu', label: 'NPU', engine: 'QNN / Hexagon 计算', desc: '仅高通兼容 QNN / Hexagon 后端；不把其它 NPU 冒充 QNN。' }
  ];
  const SOCS = [
    { id: 'qcom-8g3', button: '高通', vendor: 'Qualcomm', name: '骁龙 8 Gen 3', model: 'SM8650', abi: 'arm64-v8a', generation: 3, caps: { cpu: true, gpu: true, npu: true } },
    { id: 'mtk-9300', button: '联发科', vendor: 'MediaTek', name: '天玑 9300', model: 'MT6985', abi: 'arm64-v8a', generation: 0, caps: { cpu: true, gpu: true, npu: false } },
    { id: 'other-arm', button: '其它 SoC', vendor: 'Unknown', name: '通用 ARM 设备', model: 'Generic SoC', abi: 'arm64-v8a', generation: 0, caps: { cpu: true, gpu: false, npu: false } }
  ];

  registerScreen('diffusion', { title: '图片生成', full: true, render: diffPage });
  registerScreen('diff-image', { title: '查看图片', full: true, render: diffImagePage });

  function D() {
    A().diff = A().diff || {
      mode: 'txt', modelId: null, compute: null, soc: 'qcom-8g3', step: 0,
      prompt: (S.x.keep && S.x.keep['diff-prompt']) || '1girl, anime style, masterpiece, best quality',
      neg: (S.x.keep && S.x.keep['diff-neg']) || 'lowres, bad anatomy, blurry',
      steps: 20, denoise: 0.6, baseId: null, curId: null, batch: 1, history: [],
      hires: false, mask: null, sweep: null, debugFail: false
    };
    const d = A().diff;
    if (d.step == null) d.step = 0;
    if (!d.soc) d.soc = 'qcom-8g3';
    if (d.compute === undefined) d.compute = null;
    return d;
  }
  function diffCfgOf(id) {
    S.x.diffCfg = S.x.diffCfg || {};
    if (!S.x.diffCfg[id]) S.x.diffCfg[id] = Object.assign({}, DIFF_DEF);
    return S.x.diffCfg[id];
  }
  function modelOf(id) { return DIFF_MODELS.find(m => m.id === id) || null; }
  function socOf(id) { return SOCS.find(s => s.id === id) || SOCS[SOCS.length - 1]; }
  function computeOf(id) { return COMPUTE.find(c => c.id === id) || COMPUTE[0]; }
  function activeModel() {
    const cur = nav.current();
    return modelOf(cur && cur.page === 'diff-config' ? S.x.dcId : D().modelId) || DIFF_MODELS[0];
  }
  function activeCfg() { return diffCfgOf(activeModel().id); }
  function backendsOf(m) {
    if (m && m.diffusion && Array.isArray(m.diffusion.backends)) return m.diffusion.backends;
    // 旧目录兼容：QNN 命名包只代表 NPU，不能据此虚构 CPU / MNN 支持。
    return m && /qnn/i.test((m.parts || []).map(p => p.name).join(' ')) ? ['npu'] : ['cpu'];
  }
  function familyOf(m) { return m && m.diffusion && m.diffusion.family || (isSdxl(m) ? 'SDXL' : 'SD1.5'); }
  function modelReady(m) { const j = m && mock.job('diff-mdl-' + m.id); return !!(j && j.done); }
  function compatibility(m, mode, socId) {
    const c = computeOf(mode);
    const soc = socOf(socId);
    if (!m) return { ok: false, reason: '无法计算 · 请先在第 1 步选择模型' };
    if (!COMPUTE.some(x => x.id === mode)) return { ok: false, reason: '无法计算 · 未知计算模式' };
    if (!soc.caps[mode]) {
      const reason = mode === 'npu'
        ? '无法计算 · NPU 仅对应 QNN / Hexagon，当前' + (soc.vendor === 'MediaTek' ? '联发科' : '其它') + ' SoC 没有兼容实现'
        : '无法计算 · 当前 SoC 未识别到可用的' + c.engine + '驱动';
      return { ok: false, reason };
    }
    if (!backendsOf(m).includes(mode)) {
      return { ok: false, reason: '无法计算 · “' + familyOf(m) + '”模型包未提供' + c.engine + '所需权重或后端' };
    }
    if (mode === 'npu') {
      const req = m.diffusion || {};
      if (req.npuVendor && req.npuVendor !== soc.vendor) {
        return { ok: false, reason: '无法计算 · 模型要求 ' + req.npuVendor + ' QNN / Hexagon，当前为 ' + soc.vendor };
      }
      if ((req.minGeneration || 0) > soc.generation) {
        return { ok: false, reason: '无法计算 · 此 QNN 包要求骁龙 8 Gen ' + req.minGeneration + ' 及以上，当前为 ' + soc.name };
      }
    }
    return { ok: true, reason: '可计算 · ' + c.engine + ' · ' + soc.name };
  }
  // 供零依赖契约测试与浏览器走查读取真实判定，不另写一套测试规则。
  window._diffusion = { state: D, models: DIFF_MODELS, computeModes: COMPUTE, socs: SOCS, compatibility, backendsOf, validatePromptSyntax, promptTerms, unknownPromptTerms };

  const isSdxl = m => !!(m && (m.diffusion && m.diffusion.architecture ? m.diffusion.architecture === 'SDXL' : /sdxl/i.test(m.id + ' ' + m.name)));
  function dimsOf(size, ar) {
    if (!ar || ar === '1:1') return { w: size, h: size };
    const seg = ar.split(':').map(Number);
    const ratio = seg[0] / seg[1];
    return ratio > 1 ? { w: size, h: Math.round(size / ratio) } : { w: Math.round(size * ratio), h: size };
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function maskState() {
    const d = D();
    if (!d.mask) d.mask = { strokes: [], brush: 28, erase: false };
    return d.mask;
  }
  function currentResult() { const d = D(); return d.history.find(x => x.id === d.curId) || null; }
  function hueBg(hue, angle) {
    return 'linear-gradient(' + (angle || 135) + 'deg,hsl(' + hue + ',62%,64%),hsl(' + ((hue + 60) % 360) + ',48%,30%))';
  }
  function imageArt(r, cls, actionName, id) {
    const p = r.params || { size: 512, ar: '1:1' };
    const dims = dimsOf(p.size || 512, p.ar || '1:1');
    const inner = '<div class="diff-art ' + (cls || '') + '" style="background:' + hueBg(r.hue == null ? 268 : r.hue) + ';aspect-ratio:' + dims.w + '/' + dims.h + '">' +
      '<span>模拟出图（原型占位）</span><small>' + dims.w + ' × ' + dims.h + '</small>' + (actionName ? '<i class="diff-zoom-badge">' + icon('zoom_in') + '</i>' : '') + '</div>';
    if (!actionName) return inner;
    return '<button class="diff-art-button" data-a="' + actionName + '" data-arg="' + esc(id || r.id) + '" title="点击全屏放大" aria-label="全屏查看图片">' + inner + '</button>';
  }
  function afterRenderGo(step) { requestAnimationFrame(() => goStep(step, true)); }

  // ---------- 独立全屏向导：原生横向 scroll-snap + 每步独立纵向工作区 ----------
  function diffPage() {
    const d = D();
    d.step = clamp(d.step || 0, 0, STEPS.length - 1);
    const h = '<div class="diff-wizard" id="diff-wizard">' +
      '<div id="diff-head">' + diffHeadHtml(d) + '</div>' +
      '<div class="diff-stepper" aria-label="生图步骤">' + STEPS.map((s, i) =>
        '<button class="diff-step-dot' + (i === d.step ? ' on' : '') + (i < d.step ? ' done' : '') + '" data-a="diff-go" data-arg="' + i + '" aria-label="第 ' + (i + 1) + ' 步：' + esc(s.title) + '">' +
        '<b>' + (i + 1) + '</b><span>' + esc(s.short) + '</span></button>').join('') + '</div>' +
      '<div class="diff-pager" id="diff-pager">' + STEPS.map((s, i) =>
        '<section class="diff-step" data-step="' + i + '" aria-label="' + esc(s.title) + '" aria-hidden="' + (i === d.step ? 'false' : 'true') + '"' + (i === d.step ? '' : ' inert') + '>' +
        '<div class="diff-step-inner">' + renderStep(i, d) + '</div></section>').join('') + '</div>' +
      '<div id="diff-foot">' + diffFootHtml(d) + '</div></div>' +
      (S.x.diffDrawer ? diffDrawerHtml() : '');
    // 普通状态重绘保持当前页；goStep 的自动横滑直接操作常驻 pager，不重建 canvas / 输入框。
    requestAnimationFrame(() => syncWizardPager(false));
    return h;
  }
  function diffHeadHtml(d) {
    const r = currentResult();
    let h = '<header class="diff-head"><button class="diff-icon" data-a="diff-exit" title="退出生图" aria-label="返回">' + icon('arrow_back') + '</button>' +
      '<div class="diff-head-copy"><strong>图片生成</strong><span>0' + (d.step + 1) + ' / 05 · ' + esc(STEPS[d.step].title) + '</span></div><div class="diff-head-actions">';
    if (d.step === 4 && r) {
      h += '<button class="diff-icon" data-a="diff-save-asset" data-arg="' + r.id + '" title="保存到素材" aria-label="保存到素材">' + icon('save') + '</button>' +
        '<button class="diff-icon" data-a="diff-save-album" data-arg="' + r.id + '" title="保存到相册" aria-label="保存到相册">' + icon('download') + '</button>' +
        '<button class="diff-icon" data-a="diff-share" data-arg="' + r.id + '" title="分享" aria-label="分享">' + icon('share') + '</button>';
    }
    h += '<button class="diff-icon" data-a="diff-menu" title="生成历史（' + d.history.length + '）" aria-label="生成历史">' + icon('schedule') + '</button></div></header>';
    return h;
  }
  function diffFootHtml(d) {
    const last = d.step === STEPS.length - 1;
    const primary = d.step === 3 ? '开始生成' : last ? '再来一张' : '下一步';
    const act = d.step === 3 || last ? 'diff-gen' : 'diff-next';
    return '<footer class="diff-foot"><button class="diff-btn ghost" data-a="diff-prev">' + icon('arrow_back') + (d.step ? '上一步' : '退出') + '</button>' +
      '<span class="diff-foot-hint">左右滑动切换步骤</span>' +
      '<button class="diff-btn" data-a="' + act + '">' + (d.step === 3 ? icon('auto_awesome') : '') + primary + '</button></footer>';
  }
  function updateWizardChrome() {
    const root = document.getElementById('diff-wizard');
    if (!root) return;
    const d = D();
    const head = document.getElementById('diff-head'), foot = document.getElementById('diff-foot');
    if (head) head.innerHTML = diffHeadHtml(d);
    if (foot) foot.innerHTML = diffFootHtml(d);
    root.querySelectorAll('.diff-step-dot').forEach((el, i) => {
      el.classList.toggle('on', i === d.step);
      el.classList.toggle('done', i < d.step);
      el.setAttribute('aria-current', i === d.step ? 'step' : 'false');
    });
    root.querySelectorAll('.diff-step').forEach((el, i) => {
      el.setAttribute('aria-hidden', i === d.step ? 'false' : 'true');
      if (i === d.step) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    });
  }
  function syncWizardPager(animate) {
    const p = document.getElementById('diff-pager');
    if (!p) return;
    const left = D().step * p.clientWidth;
    if (animate) p.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    else p.scrollLeft = left;
  }
  function goStep(step, animate) {
    const d = D();
    const next = clamp(step, 0, STEPS.length - 1);
    d.step = next;
    updateWizardChrome();
    syncWizardPager(animate !== false);
  }
  // 单页跟手手势：禁用浏览器横向惯性，避免一次快滑跳过多个依赖步骤。
  // 输入控件、按钮与遮罩画布不启动分页；垂直滚动仍交给每一步自身。
  let pagerDrag = null;
  document.addEventListener('pointerdown', e => {
    const p = e.target.closest && e.target.closest('#diff-pager');
    if (!p || e.target.closest('button,input,textarea,canvas,select,[data-a]') || e.isPrimary === false) return;
    pagerDrag = { p, id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, time: performance.now(),
      start: D().step, left: p.scrollLeft, width: p.clientWidth, active: false, velocity: 0 };
  });
  document.addEventListener('pointermove', e => {
    const g = pagerDrag;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) + 6) return;
      g.active = true; g.p.__dragging = true; g.p.classList.add('dragging');
      try { g.p.setPointerCapture(e.pointerId); } catch (err) { }
    }
    if (e.cancelable) e.preventDefault();
    const now = performance.now(), dt = Math.max(1, now - g.time);
    g.velocity = (e.clientX - g.lastX) / dt; g.lastX = e.clientX; g.time = now;
    let offset = g.left - dx;
    const max = (STEPS.length - 1) * g.width;
    if (offset < 0) offset *= 0.25;
    if (offset > max) offset = max + (offset - max) * 0.25;
    g.p.scrollLeft = offset;
  }, { passive: false });
  function finishPagerDrag(e, cancelled) {
    const g = pagerDrag;
    if (!g || g.id !== e.pointerId) return;
    pagerDrag = null;
    g.p.__dragging = false; g.p.classList.remove('dragging');
    if (!g.active) return;
    const dx = e.clientX - g.x;
    const useVelocity = Math.abs(g.velocity) > 0.45 && Math.abs(dx) > 24;
    const direction = useVelocity ? (g.velocity < 0 ? 1 : -1) : (Math.abs(dx) > g.width * 0.14 ? (dx < 0 ? 1 : -1) : 0);
    goStep(cancelled ? g.start : g.start + direction, true);
  }
  document.addEventListener('pointerup', e => finishPagerDrag(e, false));
  document.addEventListener('pointercancel', e => finishPagerDrag(e, true));
  let pagerScrollTimer = null;
  document.addEventListener('scroll', e => {
    if (!e.target || e.target.id !== 'diff-pager' || e.target.__dragging) return;
    clearTimeout(pagerScrollTimer);
    const p = e.target;
    pagerScrollTimer = setTimeout(() => {
      if (!p.isConnected || !p.clientWidth) return;
      const next = clamp(Math.round(p.scrollLeft / p.clientWidth), 0, STEPS.length - 1);
      if (next !== D().step) { D().step = next; updateWizardChrome(); }
    }, 120);
  }, true);
  action('diff-go', ds => goStep(+ds.arg, true));
  action('diff-exit', () => { if (!nav.pop()) nav.goTab('ai'); });
  action('diff-prev', () => { const d = D(); if (d.step) goStep(d.step - 1, true); else if (!nav.pop()) nav.goTab('ai'); });
  action('diff-next', () => {
    const d = D();
    if (d.step === 0) {
      if (!d.modelId) { toast('请先下载并选择生图模型'); return; }
      goStep(1, true); return;
    }
    if (d.step === 1) {
      const check = compatibility(modelOf(d.modelId), d.compute, d.soc);
      if (!check.ok) { d.computeError = check.reason; render(); toast(check.reason); return; }
      goStep(2, true); return;
    }
    if (d.step === 2) {
      if ((d.mode === 'img' || d.mode === 'inpaint') && !d.baseId) { toast('请先选择底图'); return; }
      if (d.mode === 'inpaint' && !maskState().strokes.length) { toast('请在上方大画面涂抹重绘区域'); return; }
      goStep(3, true); return;
    }
    if (d.step < 4) goStep(d.step + 1, true);
  });

  function renderStep(i, d) {
    if (i === 0) return modelStep(d);
    if (i === 1) return computeStep(d);
    if (i === 2) return inputStep(d);
    if (i === 3) return paramsStep(d);
    return resultStep(d);
  }
  function stepTitle(title, hint, right) {
    return '<div class="diff-workhead"><div><h2>' + esc(title) + '</h2>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  function selectionSummary(d) {
    const m = modelOf(d.modelId), c = computeOf(d.compute), soc = socOf(d.soc);
    return '<div class="diff-summary"><span>' + esc(m ? familyOf(m) + ' · ' + m.name : '未选模型') + '</span>' +
      '<span>' + esc(d.compute ? c.engine : '未选计算模式') + ' · ' + esc(soc.name) + '</span></div>';
  }

  // ---------- 1：模型 + 生成方式 ----------
  function modelStep(d) {
    let h = stepTitle('先确定创作方式与模型', '选择已下载模型后自动进入计算模式；模型家族不等于计算后端。');
    h += '<div class="diff-segment" role="group" aria-label="生成方式">' +
      [['txt', '文生图'], ['img', '图生图'], ['inpaint', '局部重绘']].map(x =>
        '<button class="' + (d.mode === x[0] ? 'on' : '') + '" data-a="diff-mode" data-arg="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
      '<div class="diff-caption">图生图 / 局部重绘会在创作输入步选择底图；切换方式不保留旧遮罩。</div>';
    h += '<div class="diff-models">' + DIFF_MODELS.map(m => modelRow(m, d)).join('') + '</div>';
    return h;
  }
  function modelRow(m, d) {
    const size = m.parts.reduce((s, p) => s + p.size, 0);
    const j = mock.job('diff-mdl-' + m.id);
    const selected = d.modelId === m.id;
    const backendNames = { cpu: 'CPU', gpu: 'MNN', npu: 'QNN' };
    let trail;
    if (j && !j.done) trail = '<span class="diff-model-progress">' + Math.round(j.p * 100) + '%</span>';
    else if (j && j.done) trail = '<button class="diff-btn small ' + (selected ? 'ghost' : '') + '" data-a="diff-pick-use" data-arg="' + m.id + '">' + (selected ? '当前' : '选择') + '</button>';
    else trail = '<button class="diff-btn small ghost" data-a="diff-pick-dl" data-arg="' + m.id + '">下载</button>';
    return '<article class="diff-model' + (selected ? ' on' : '') + '">' +
      '<div class="diff-model-top"><div><strong>' + esc(m.name) + '</strong><div class="diff-tags"><span>' + esc(familyOf(m)) + '</span>' +
      backendsOf(m).map(b => '<span>' + backendNames[b] + '</span>').join('') + (isSdxl(m) ? '<span>宽高比</span>' : '') + '</div></div>' + trail + '</div>' +
      '<p>' + esc(m.summary) + '</p><div class="diff-model-meta"><span>' + fmtSize(size) + '</span><span>' + esc((m.diffusion && m.diffusion.packageNote) || '按模型包声明过滤后端') + '</span></div>' +
      (j && !j.done ? progress(j.p) : '') + '</article>';
  }
  action('diff-pick', () => goStep(0, true));
  action('diff-pick-dl', ds => {
    const m = modelOf(ds.arg);
    if (!m) return;
    const existing = mock.job('diff-mdl-' + m.id);
    if (existing && !existing.done) { toast('模型正在下载'); return; }
    mock.startJob('diff-mdl-' + m.id, '下载 ' + m.name, 3400, ['源 1', '源 2', '校验']);
    const t = setInterval(() => {
      const job = mock.job('diff-mdl-' + m.id);
      if (!job) { clearInterval(t); return; }
      if (job.done) {
        clearInterval(t);
        const d = D();
        d.modelId = m.id; d.curId = null; d.compute = null; d.computeError = null;
        render();
        const cur = nav.current();
        if (cur && cur.page === 'diffusion' && d.step === 0) afterRenderGo(1);
      }
    }, 300);
    render();
  });
  action('diff-pick-use', ds => {
    const m = modelOf(ds.arg);
    if (!m || !modelReady(m)) { toast('请先下载模型'); return; }
    const d = D();
    d.modelId = m.id; d.curId = null; d.compute = null; d.computeError = null; d.lastError = null;
    render(); afterRenderGo(1);
  });
  action('diff-mode', ds => {
    const d = D();
    if (d.mode === ds.arg) return;
    d.mode = ds.arg;
    d.mask = null;
    render();
    if (d.modelId) afterRenderGo(1);
  });

  // ---------- 2：SoC 识别 + 模型真实后端过滤 ----------
  function computeStep(d) {
    const m = modelOf(d.modelId), soc = socOf(d.soc);
    let h = stepTitle('确认设备与计算模式', '可点选不兼容项查看原因；只有“可计算”的选择才会自动前进。');
    h += '<section class="diff-block"><div class="diff-soc-title"><span>' + icon('devices') + '</span><div><strong>已识别：' + esc(soc.vendor) + ' · ' + esc(soc.name) + '</strong>' +
      '<small>' + esc(soc.model) + ' · ' + esc(soc.abi) + ' · 原型识别演示</small></div></div>' +
      '<div class="diff-segment compact">' + SOCS.map(s => '<button class="' + (s.id === soc.id ? 'on' : '') + '" data-a="diff-soc" data-arg="' + s.id + '">' + esc(s.button) + '</button>').join('') + '</div>' +
      '<div class="diff-caption">App 对应读取 SOC_MANUFACTURER / SOC_MODEL 与后端探针；浏览器不伪造硬件探测。</div></section>';
    if (d.computeError) h += '<div class="diff-unable" role="alert">' + icon('warning') + '<span>' + esc(d.computeError) + '</span></div>';
    h += '<div class="diff-computes">' + COMPUTE.map(c => {
      const check = compatibility(m, c.id, soc.id);
      const selected = d.compute === c.id;
      return '<button class="diff-compute' + (selected ? ' on' : '') + (check.ok ? '' : ' unavailable') + '" data-a="diff-compute" data-arg="' + c.id + '" aria-label="' + esc(c.label + '，' + check.reason) + '">' +
        '<span class="diff-compute-head"><b>' + c.label + '</b><em>' + (check.ok ? '可计算' : '无法计算') + '</em></span>' +
        '<strong>' + esc(c.engine) + '</strong><p>' + esc(c.desc) + '</p><small>' + esc(check.reason) + '</small></button>';
    }).join('') + '</div>';
    return h;
  }
  action('diff-soc', ds => {
    const d = D();
    d.soc = ds.arg; d.compute = null; d.computeError = null;
    render();
  });
  action('diff-compute', ds => {
    const d = D();
    const check = compatibility(modelOf(d.modelId), ds.arg, d.soc);
    d.compute = ds.arg;
    d.computeError = check.ok ? null : check.reason;
    render();
    if (check.ok) afterRenderGo(2); else toast(check.reason);
  });

  // ---------- 3：创作输入（图类步骤上舞台、下工具栏） ----------
  function inputStep(d) {
    let h = stepTitle('描述画面，完成创作输入', '提示词草稿自动保存；反推与提示词库仍可在此直接使用。');
    h += selectionSummary(d);
    if (d.mode === 'img' || d.mode === 'inpaint') h += baseEditor(d);
    h += '<section class="diff-block diff-prompt-block"><div class="diff-field-head"><label for="diff-prompt">正向提示词</label><span class="diff-prompt-count">' + d.prompt.length + ' 字</span></div>' +
      '<textarea id="diff-prompt" class="field-input diff-prompt" data-keep="diff-prompt" placeholder="描述画面内容、主体、风格与细节；可用逗号分隔 tag">' + esc(d.prompt) + '</textarea>' +
      '<div class="diff-prompt-actions"><button class="diff-text-btn" data-a="diff-prompt-lib">' + icon('bookmark') + '提示词库</button>' +
      '<button class="diff-text-btn" data-a="diff-vocabulary">' + icon('menu_book') + '提示词词表</button>' +
      '<button class="diff-text-btn" data-a="diff-caption">' + icon('zoom_in') + '图像反推</button>' +
      '<button class="diff-text-btn" data-a="diff-prompt-check">' + icon('check_circle') + '检查提示词</button></div>' +
      '<div class="diff-caption">词表来自真实 Danbooru / WD tag 数据，可搜索并插入。语法错误与词表未收录分开提示；未收录不等于无效。</div>' +
      '<div class="tag-toolbar"><button class="tbtn" data-a="tag-dec">权重−</button><button class="tbtn" data-a="tag-inc">权重＋</button>' +
      '<button class="tbtn" data-a="tag-del">删除 tag</button><button class="icbtn" data-a="tag-undo" title="撤销">' + icon('undo') + '</button>' +
      '<button class="icbtn" data-a="tag-redo" title="重做">' + icon('redo') + '</button></div>';
    const sug = currentSuggestions();
    if (sug.length) h += '<div class="suggest-row">' + sug.map(t =>
      '<button class="chip" data-a="tag-complete" data-arg="' + esc(t.tag) + '">' + esc(t.tag) + '<span class="sug-cn">' + esc(t.cn) + '</span></button>').join('') + '</div>';
    h += '<div class="diff-neg-head"><button class="diff-icon" data-a="diff-neg-toggle" title="负向提示词">' + icon(S.x.diffNegOpen ? 'expand_less' : 'expand_more') + '</button>' +
      '<span>负向提示词' + (d.neg ? '（已设置）' : '') + '</span></div>';
    if (S.x.diffNegOpen) h += '<textarea class="field-input diff-neg" data-keep="diff-neg" placeholder="负向提示词（如 lowres, bad anatomy）">' + esc(d.neg || '') + '</textarea><div class="diff-caption">描述不想出现的内容。</div>';
    return h + '</section>';
  }
  function baseEditor(d) {
    const base = d.baseId && (S.x.assets || []).find(a => a.id === d.baseId);
    let h = '<section class="diff-block diff-media-editor"><div class="diff-workstage' + (d.mode === 'inpaint' && base ? ' diff-mask-stage' : '') + '">';
    if (base) {
      if (d.mode === 'inpaint') {
        h += '<div class="mask-wrap" id="mask-wrap"><div class="mask-base" style="background:' + hueBg(base.hue, 165) + '"></div>' +
          '<canvas class="mask-canvas" id="mask-canvas" aria-label="局部重绘遮罩画布"></canvas><span class="diff-mask-label">白色 = 重绘区域</span></div>';
      } else {
        h += '<button class="diff-stage-view" data-a="diff-open-base" data-arg="' + base.id + '" style="background:' + hueBg(base.hue, 165) + '" title="全屏查看底图"><span>' + icon('zoom_in') + esc(base.label) + '</span></button>';
      }
    } else {
      h += '<button class="diff-stage-empty" data-a="diff-base">' + icon('image') + '<strong>选择底图</strong><span>从素材库选择一张图片</span></button>';
    }
    h += '</div><div class="diff-stage-tools">';
    if (base) {
      h += '<button class="diff-btn small ghost" data-a="diff-base">更换底图</button>' +
        '<button class="diff-btn small ghost" data-a="diff-open-base" data-arg="' + base.id + '">' + icon('zoom_in') + '全屏查看</button>' +
        '<button class="diff-btn small danger" data-a="diff-base-clear">移除</button>';
    } else h += '<button class="diff-btn small" data-a="diff-base">打开素材库</button>';
    h += '</div>';
    if (d.mode === 'inpaint' && base) {
      const ms = maskState();
      h += '<div class="mask-toolbar"><button class="diff-icon' + (ms.erase ? ' on' : '') + '" data-a="diff-mask-erase" title="' + (ms.erase ? '切回画笔' : '橡皮擦') + '">' + icon('brush') + '</button>' +
        '<button class="diff-icon" data-a="diff-mask-undo" title="撤销一笔">' + icon('undo') + '</button>' +
        '<button class="diff-icon" data-a="diff-mask-clear" title="清空遮罩">' + icon('delete') + '</button>' +
        '<label class="slider-row"><span class="li-title">画笔 ' + ms.brush + 'px</span><input type="range" min="8" max="72" step="2" value="' + ms.brush + '" class="slider" data-live="diff-brush"></label>' +
        '<span class="diff-strokes">' + ms.strokes.length + ' 笔</span></div>' +
        '<div class="diff-caption">上方大画面涂抹，下方编辑工具栏调整；prompt 描述希望画成的内容。</div>';
    }
    return h + '</section>';
  }
  action('diff-base', () => {
    const imgs = (S.x.assets || []).filter(a => a.kind === 'image');
    showDialog({
      title: '选择底图（素材库）',
      body: imgs.length ? '<div class="pick-grid">' + imgs.map(a =>
        '<div class="pick-cell" data-a="diff-pick-base" data-arg="' + a.id + '" title="' + esc(a.label) + '" style="background:' + hueBg(a.hue, 165) + '"></div>').join('') + '</div>' : emptyHint('素材库暂无图片，请先到素材页导入'),
      actions: [{ label: '取消' }]
    });
  });
  action('diff-pick-base', ds => { D().baseId = ds.arg; D().mask = null; closeDialog(); render(); });
  action('diff-base-clear', () => { D().baseId = null; D().mask = null; render(); });

  // ---------- 4：生成参数（步数数字输入 + 加减；原高级能力集中保留） ----------
  function paramsStep(d) {
    return stepTitle('检查生成参数', '设置按模型独立保存；开始生成后自动横滑到结果步。') + selectionSummary(d) + diffParamsHtml(activeModel(), D());
  }
  function diffParamsHtml(m, d) {
    const cfg = diffCfgOf(m.id);
    const sw = d.sweep && d.sweep.enabled ? d.sweep : null;
    let h = '<section class="diff-block"><div class="diff-param-grid"><div><div class="diff-field-label">采样步数</div>' +
      '<div class="diff-number"><button data-a="diff-step-delta" data-arg="-1" aria-label="减少采样步数">' + icon('remove') + '</button>' +
      '<input type="number" inputmode="numeric" min="1" max="150" step="1" value="' + d.steps + '" data-live="diff-steps" aria-label="采样步数">' +
      '<button data-a="diff-step-delta" data-arg="1" aria-label="增加采样步数">' + icon('add') + '</button></div>' +
      '<div class="diff-caption">1–150 步；LCM 推荐 4–8，常规建议 20–30，耗时近似线性增加。</div></div>' +
      '<div><label class="slider-row"><span class="li-title">CFG 强度 ' + cfg.cfg.toFixed(1) + '</span>' +
      '<input type="range" min="1" max="20" step="0.5" value="' + cfg.cfg + '" class="slider" data-live="dc-set"></label>' +
      '<div class="diff-caption">越高越贴近提示词，过高易过曝。</div></div></div>';
    if (d.mode === 'img' || d.mode === 'inpaint') {
      h += '<label class="slider-row"><span class="li-title">重绘幅度 ' + d.denoise.toFixed(2) + '</span>' +
        '<input type="range" min="0.2" max="0.9" step="0.05" value="' + d.denoise + '" class="slider" data-live="diff-denoise"></label>' +
        '<div class="diff-caption">数值越大改动越大；局部重绘只重新生成遮罩内的内容。</div>';
    }
    h += '<div class="diff-field-label">采样器</div><div class="chip-row wrap compact-chips">' +
      SAMPLERS.map(s => chip(s, cfg.sampler === s, 'dc-sampler', s)).join('') + '</div>' +
      '<div class="diff-caption">LCM 适合快速出图；Karras 噪声表细节更稳；SDE 系更慢但更细腻。</div></section>';
    h += '<section class="diff-block"><div class="diff-param-grid"><div><div class="diff-field-label">输出尺寸</div><div class="chip-row wrap compact-chips">' +
      [512, 768, 1024].map(z => chip(z + '×' + z, cfg.size === z, 'dc-size', z)).join('') + '</div></div>' +
      '<div><div class="diff-field-label">种子（-1 随机）</div><div class="diff-seed-row">' +
      '<input class="field-input" type="number" value="' + cfg.seed + '" data-live="dc-seed" aria-label="随机种子">' +
      '<button class="diff-btn small ghost' + (cfg.seed >= 0 ? ' locked' : '') + '" data-a="diff-seed-lock">' + icon('lock') + (cfg.seed >= 0 ? '已锁' : '锁定') + '</button></div></div></div>';
    if (isSdxl(m)) h += '<div class="diff-field-label">宽高比（SDXL / Anima 模型能力）</div><div class="chip-row wrap compact-chips">' +
      ['1:1', '4:3', '3:4', '16:9', '9:16'].map(a => chip(a, cfg.ar === a, 'dc-ar', a)).join('') + '</div>';
    h += '<div class="diff-field-label">批量或参数扫描</div><div class="chip-row wrap compact-chips">' +
      [1, 2, 4].map(n => chip('×' + n, !sw && (d.batch || 1) === n, 'diff-batch', n)).join('') +
      chip('扫描', !!sw, 'diff-sweep-open') + (sw ? '<span class="diff-sweep-summary">' + esc(sw.desc) + ' · ' + sw.items.length + ' 张</span>' : '') + '</div></section>';
    h += '<section class="diff-block"><div class="diff-switch-row"><div><strong>高清修复</strong><small>生成 → 放大 ×2 → UltraFix 分块修复</small></div>' + switchCtl(d.hires, 'diff-hires') + '</div>' +
      '<div class="diff-switch-row"><div><strong>过程预览帧</strong><small>每 2 步更新；高清修复时自动关闭</small></div>' + switchCtl(cfg.preview, 'dc-preview') + '</div>' +
      '<div class="diff-field-label">高清修复分块（UltraFix tile）</div>' + (isSdxl(m)
        ? '<div class="diff-caption">固定 1024（SDXL 管线限定）</div>'
        : '<div class="chip-row wrap compact-chips">' + [384, 512, 768].map(z => chip(z + 'px', cfg.hiresTile === z, 'dc-tile', z)).join('') + '</div>') +
      '<div class="diff-note">生成时会演示卸载已加载 LLM 以释放内存，并显示 RAM 余量与分阶段耗时。</div>' +
      '<button class="tbtn" data-a="dc-reset">恢复此模型默认参数</button> <button class="tbtn" data-a="dc-debug-fail">调试：模拟下次 bad_alloc</button></section>';
    return h;
  }
  action('diff-step-delta', ds => { const d = D(); d.steps = clamp((d.steps || 20) + (+ds.arg), 1, 150); render(); });
  action('diff-steps', (ds, el) => {
    if (el.value === '') return;
    const n = Number(el.value);
    if (Number.isFinite(n)) D().steps = clamp(Math.round(n), 1, 150);
  });
  action('diff-denoise', (ds, el) => {
    D().denoise = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = '重绘幅度 ' + (+el.value).toFixed(2);
  });
  action('diff-batch', ds => { D().batch = +ds.arg; D().sweep = null; render(); });
  action('diff-hires', () => { D().hires = !D().hires; render(); });
  action('diff-seed-lock', () => {
    const cfg = activeCfg();
    cfg.seed = cfg.seed >= 0 ? -1 : Math.floor(Math.random() * 1000000000);
    render();
  });
  action('diff-brush', (ds, el) => {
    maskState().brush = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = '画笔 ' + el.value + 'px';
  });
  action('diff-mask-erase', () => { maskState().erase = !maskState().erase; render(); });
  action('diff-mask-undo', () => { maskState().strokes.pop(); render(); });
  action('diff-mask-clear', () => { maskState().strokes = []; render(); });
  action('diff-neg-toggle', () => { S.x.diffNegOpen = !S.x.diffNegOpen; render(); });

  // ---------- 5：生成进度 / 错误 / 当前结果（保存与分享在标题栏） ----------
  function resultStep(d) {
    const j = mock.job('diff-gen');
    if (d.lastError) {
      return stepTitle('生成失败', '错误保留在结果步，可直接重试或返回调整参数。') + '<section class="diff-block err-card">' +
        '<div class="err-title">' + icon('warning') + esc(d.lastError.phase) + '</div><div class="err-body">' + esc(d.lastError.reason) + '</div>' +
        '<div class="err-hint">' + esc(d.lastError.hint) + '</div><div class="diff-result-tools">' +
        '<button class="diff-btn small" data-a="diff-retry">重试</button><button class="diff-btn small ghost" data-a="diff-err-close">关闭错误</button></div></section>';
    }
    if (j && !j.done) {
      const pct = Math.round(j.p * 100), blur = Math.max(0, 14 * (1 - j.p));
      const cfg = activeCfg(), showPreview = cfg.preview && !d.hires;
      return stepTitle('正在生成', esc(j.label || '本地生图任务')) +
        '<div class="diff-result-stage"><div class="diff-preview"><div class="diff-img" style="filter:blur(' + blur.toFixed(1) + 'px) saturate(' + (0.7 + j.p * 0.3).toFixed(2) + ');transform:scale(' + (1.06 - j.p * 0.06).toFixed(3) + ')"></div>' +
        '<div class="diff-pct">' + pct + '%</div></div></div><section class="diff-block">' +
        (d.evictNote ? '<div class="cost-note">' + esc(d.evictNote) + '</div>' : '') +
        '<div class="dl-status">' + (showPreview ? '过程预览 · 每 2 步更新 · ' : (d.hires ? '分块修复中，无过程预览 · ' : '')) + esc(j.phase || '') + '</div>' + progress(j.p) +
        '<div class="diff-result-tools"><button class="diff-btn small danger" data-a="diff-cancel">取消</button>' +
        (d.sweep && d.sweep.enabled ? '<button class="diff-btn small ghost" data-a="diff-stop-after">跑完本张后停止</button>' : '') + '</div></section>';
    }
    const r = currentResult();
    if (!r) return '<div class="diff-empty">' + icon('image') + '<strong>还没有生成结果</strong><span>返回参数步开始生成，或从标题栏打开生成历史。</span>' +
      '<button class="diff-btn small" data-a="diff-go" data-arg="3">检查生成参数</button></div>';
    return stepTitle('生成结果', '点击图片全屏放大；保存到素材 / 相册与分享位于标题栏右侧。') +
      '<div class="diff-result-stage"><div class="diff-art-frame">' + imageArt(r, 'diff-result-art', 'diff-open-result', r.id) +
      '<button class="diff-icon diff-fav" data-a="diff-fav" data-arg="' + r.id + '" title="收藏">' + icon(r.fav ? 'favorite' : 'favorite_border') + '</button></div></div>' +
      '<section class="diff-block"><div class="diff-result-info">' + esc(r.info) + '</div><div class="diff-result-prompt">' + esc(r.prompt) + '</div>' +
      (r.neg ? '<div class="diff-result-neg">负向：' + esc(r.neg) + '</div>' : '') + '<div class="timing-line">' + esc(r.timing || '') + '</div>' +
      '<div class="diff-result-tools">' + (r.mode === 'txt' ? '<button class="diff-btn small ghost" data-a="diff-use-base" data-arg="' + r.id + '">作为底图</button>' : '') +
      '<button class="diff-btn small ghost" data-a="diff-as-template" data-arg="' + r.id + '">以此为模板</button>' +
      '<button class="diff-btn small ghost" data-a="diff-rerun" data-arg="' + r.id + '">原样重跑</button></div></section>';
  }

  // ---------- 生成历史（扫描组 / 收藏 / 搜索 / 撤销；缩略图点击全屏） ----------
  function diffHistHtml() {
    const d = D();
    const kw = ((S.x.keep && S.x.keep['diff-hist-q']) || '').trim().toLowerCase();
    const list = kw ? d.history.filter(r => (r.prompt || '').toLowerCase().indexOf(kw) >= 0) : d.history;
    S.x.diffGroupOpen = S.x.diffGroupOpen || {};
    let items = '', i = 0;
    while (i < list.length) {
      const r = list[i];
      if (r.batchId && r.batchTotal > 1) {
        const gid = r.batchId;
        const group = list.filter(x => x.batchId === gid);
        const open = !!S.x.diffGroupOpen[gid];
        items += '<div class="d-sess d-group' + (open ? ' on' : '') + '" data-a="diff-group" data-arg="' + gid + '">' +
          '<button class="d-thumb diff-thumb-button" data-a="diff-open-result" data-arg="' + r.id + '" style="background:' + hueBg(r.hue) + '" title="全屏查看"></button>' +
          '<div class="d-body"><div class="d-title">扫描 · ' + group.length + ' 张' + (r.batchDesc ? '（' + esc(r.batchDesc) + '）' : '') + '</div><div class="d-sub">点击' + (open ? '收起' : '展开') + '</div></div>' + icon(open ? 'expand_less' : 'expand_more') + '</div>';
        if (open) group.forEach(g => { items += histRow(g, d); });
        i += group.length;
      } else { items += histRow(r, d); i++; }
    }
    return '<div class="d-head"><span>生成历史</span><span class="muted small">' + d.history.length + ' 张</span></div>' +
      '<div class="diff-hist-search"><div class="search-box">' + icon('search') + '<input class="field-input" data-keep="diff-hist-q" placeholder="搜索提示词…" value="' + esc((S.x.keep && S.x.keep['diff-hist-q']) || '') + '"></div></div>' +
      '<div class="diff-hist-new">' + btn('＋ 新建生成', 'diff-new', null, 'small block ghost') + '</div>' +
      '<div class="d-list">' + (items || '<div class="muted small center" style="padding:24px 0">' + (kw ? '没有匹配的记录' : '暂无生成记录') + '</div>') + '</div>' +
      '<div class="d-foot" data-a="diff-settings">' + icon('settings') + '<span>生成设置（独立子页）</span></div>';
  }
  function histRow(r, d) {
    return '<div class="d-sess' + (d.curId === r.id ? ' on' : '') + '" data-a="diff-hist" data-arg="' + r.id + '">' +
      '<button class="d-thumb diff-thumb-button" data-a="diff-open-result" data-arg="' + r.id + '" style="background:' + hueBg(r.hue) + '" title="全屏查看" aria-label="全屏查看历史图片"></button>' +
      '<div class="d-body"><div class="d-title">' + esc(r.prompt || '（无提示词）') + '</div><div class="d-sub">' + esc(r.info) + '</div></div>' +
      (r.fav ? '<span class="fav-mark">' + icon('favorite') + '</span>' : '') +
      '<button class="d-del" data-a="diff-hist-del" data-arg="' + r.id + '" title="删除">' + icon('close') + '</button></div>';
  }
  function diffDrawerHtml() { return '<div class="drawer-mask" data-a="diff-drawer-close"><div class="drawer" data-a="drawer-body">' + diffHistHtml() + '</div></div>'; }
  action('diff-menu', () => { S.x.diffDrawer = true; render(); });
  action('diff-drawer-close', (ds, el) => { if (el.classList.contains('drawer-mask')) { S.x.diffDrawer = false; render(); } });
  action('drawer-body', () => { /* 阻止遮罩关闭语义只落在 mask 本身 */ });
  action('diff-new', () => {
    const d = D(); d.curId = null; d.lastError = null; S.x.diffDrawer = false;
    render(); afterRenderGo(d.modelId && d.compute ? 2 : 0);
  });
  action('diff-hist', ds => { D().curId = ds.arg; S.x.diffDrawer = false; render(); afterRenderGo(4); });
  action('diff-group', ds => { S.x.diffGroupOpen = S.x.diffGroupOpen || {}; S.x.diffGroupOpen[ds.arg] = !S.x.diffGroupOpen[ds.arg]; render(); });
  action('diff-fav', ds => { const r = D().history.find(x => x.id === ds.arg); if (r) { r.fav = !r.fav; render(); } });
  action('diff-hist-del', ds => {
    const d = D(), r = d.history.find(x => x.id === ds.arg);
    if (!r) return;
    if (r.fav) {
      confirmDialog('删除收藏记录', '该记录已收藏，确定删除吗？', '删除', () => {
        d.history = d.history.filter(x => x.id !== ds.arg);
        if (d.curId === ds.arg) d.curId = null;
        render();
      }, true);
      return;
    }
    const idx = d.history.indexOf(r);
    d.history.splice(idx, 1);
    if (d.curId === ds.arg) d.curId = null;
    toast('已删除生成记录', { act: 'diff-hist-undo', arg: JSON.stringify({ r, idx }), label: '撤销' });
    render();
  });
  action('diff-hist-undo', ds => { const v = JSON.parse(ds.arg); D().history.splice(Math.min(v.idx, D().history.length), 0, v.r); render(); });
  action('diff-settings', () => { S.x.diffDrawer = false; S.x.dcId = D().modelId || DIFF_MODELS[0].id; nav.push('diff-config', S.x.dcId); });

  // ---------- 全屏图片查看：上方大画面、下方查看工具栏 ----------
  function diffImagePage(arg) {
    const d = D();
    const isBase = String(arg || '').indexOf('base:') === 0;
    let r = null;
    if (isBase) {
      const id = String(arg).slice(5), a = (S.x.assets || []).find(x => x.id === id);
      if (a) r = { id: arg, hue: a.hue, prompt: a.label, info: '创作输入底图 · 素材库', params: { size: 512, ar: '1:1' }, base: true };
    } else r = d.history.find(x => x.id === arg) || currentResult();
    if (!r) return '<div class="diff-viewer"><header class="diff-viewer-head"><button class="diff-icon" data-a="back">' + icon('arrow_back') + '</button><strong>图片不可用</strong></header><div class="diff-empty">记录已被删除</div></div>';
    const zoom = S.x.diffImageZoom ? ' zoomed' : '';
    let h = '<div class="diff-viewer"><header class="diff-viewer-head"><button class="diff-icon" data-a="back" title="返回">' + icon('arrow_back') + '</button>' +
      '<div><strong>' + (r.base ? '底图查看' : '生成结果') + '</strong><span>点击工具栏可放大查看</span></div>' +
      '<button class="diff-icon" data-a="diff-view-zoom" title="切换放大">' + icon('zoom_in') + '</button></header>' +
      '<div class="diff-viewer-stage' + zoom + '">' + imageArt(r, 'diff-viewer-art', null) + '</div>' +
      '<footer class="diff-viewer-tools"><div class="diff-viewer-copy"><strong>' + esc(r.prompt || '（无提示词）') + '</strong><span>' + esc(r.info || '') + '</span></div><div class="diff-viewer-actions">';
    if (r.base) h += '<button class="diff-btn small" data-a="back">返回继续编辑</button>';
    else {
      h += '<button class="diff-btn small ghost" data-a="diff-save-asset" data-arg="' + r.id + '">' + icon('save') + '存素材</button>' +
        '<button class="diff-btn small ghost" data-a="diff-save-album" data-arg="' + r.id + '">' + icon('download') + '存相册</button>' +
        '<button class="diff-btn small ghost" data-a="diff-share" data-arg="' + r.id + '">' + icon('share') + '分享</button>' +
        '<button class="diff-icon" data-a="diff-fav" data-arg="' + r.id + '" title="收藏">' + icon(r.fav ? 'favorite' : 'favorite_border') + '</button>';
    }
    return h + '</div></footer></div>';
  }
  action('diff-open-result', ds => { D().curId = ds.arg; S.x.diffDrawer = false; S.x.diffImageZoom = false; nav.push('diff-image', ds.arg); });
  action('diff-open-base', ds => { S.x.diffImageZoom = false; nav.push('diff-image', 'base:' + ds.arg); });
  action('diff-view-zoom', () => { S.x.diffImageZoom = !S.x.diffImageZoom; render(); });

  // ---------- 生成（简单批量 / 扫描共用一条驱动） ----------
  action('diff-gen', startGen);
  function startGen() {
    const d = D(), m = modelOf(d.modelId);
    if (!m) { toast('请先选择并下载生图模型'); goStep(0, true); return; }
    if (!modelReady(m)) { toast('模型尚未下载完成'); goStep(0, true); return; }
    const check = compatibility(m, d.compute, d.soc);
    if (!check.ok) { d.computeError = check.reason; toast(check.reason); render(); afterRenderGo(1); return; }
    if ((d.mode === 'img' || d.mode === 'inpaint') && !d.baseId) { toast('请先从素材库选择底图'); goStep(2, true); return; }
    if (d.mode === 'inpaint' && !maskState().strokes.length) { toast('请在底图上涂抹需要重绘的区域'); goStep(2, true); return; }
    d.steps = clamp(Math.round(d.steps || 20), 1, 150);
    d.lastError = null; d.curId = null;
    d.prompt = (S.x.keep && S.x.keep['diff-prompt']) || d.prompt;
    d.neg = (S.x.keep && S.x.keep['diff-neg']) || d.neg || '';
    const cfg = diffCfgOf(d.modelId), plan = buildPlan(d, cfg);
    if (!plan) return;
    const llmLoaded = ((S.x.ai && S.x.ai.llm && S.x.ai.llm.sessions) || []).filter(s => s.loaded);
    if (llmLoaded.length) {
      llmLoaded.forEach(s => { s.loaded = false; });
      d.evictNote = '已卸载 LLM 释放内存（约 1.8 GB） · RAM 4.9/11.7 GB 空闲';
    } else d.evictNote = 'RAM 4.9/11.7 GB 空闲 · ' + check.reason;
    const label = plan.sweep ? '参数扫描（' + plan.total + ' 张）' : (d.mode === 'img' ? '图生图' : d.mode === 'inpaint' ? '局部重绘' : '文生图');
    const phases = d.hires ? ['编码提示词', '去噪 ' + d.steps + ' 步', '解码', '放大 ×2', 'UltraFix 分块修复'] :
      (d.mode === 'txt' ? ['编码提示词', '去噪 ' + d.steps + ' 步', '解码'] : ['编码提示词', 'VAE 编码底图', '去噪 ' + d.steps + ' 步', '解码']);
    mock.startJob('diff-gen', label + ' · ' + computeOf(d.compute).label, plan.total * (d.hires ? 1900 : 1100), plan.sweep ? null : phases);
    d.sweep && (d.sweep.produced = 0);
    let k = 0;
    const t = setInterval(() => {
      const job = mock.job('diff-gen');
      if (!job) { clearInterval(t); return; }
      if (d.debugFail && job.p > 0.55) {
        d.debugFail = false;
        mock.resetJob('diff-gen');
        d.lastError = { phase: '生成失败 · 去噪', reason: 'bad_alloc：计算后端内存不足（bad_alloc）', hint: '建议：开启低内存模式、改用 CPU 计算，或降低输出尺寸。' };
        clearInterval(t); render(); return;
      }
      while (k < plan.total && job.p >= (k + 1) / plan.total) {
        produce(d, plan, k); k++;
        if (d.sweep && d.sweep.enabled) d.sweep.produced = k;
      }
      if (plan.sweep) job.phase = '扫描 ' + Math.min(k + 1, plan.total) + '/' + plan.total + ' · 去噪 ' + d.steps + ' 步';
      const stopAfter = d.sweep && d.sweep.enabled ? d.sweep.stopAfter : null;
      if (stopAfter != null && k >= stopAfter) { S.x.jobs['diff-gen'].done = true; clearInterval(t); render(); return; }
      if (job.done || k >= plan.total) { S.x.jobs['diff-gen'].done = true; clearInterval(t); render(); }
      else render();
    }, 300);
    render(); afterRenderGo(4);
  }
  action('diff-cancel', () => { mock.resetJob('diff-gen'); render(); });
  action('diff-retry', () => { D().lastError = null; startGen(); });
  action('diff-err-close', () => { D().lastError = null; render(); });
  action('diff-stop-after', () => {
    const d = D();
    if (d.sweep && d.sweep.enabled && d.sweep.stopAfter == null) {
      d.sweep.stopAfter = d.sweep.produced == null ? 1 : d.sweep.produced + 1;
      toast('将在本张完成后停止（保留 ' + d.sweep.stopAfter + ' 张）'); render();
    }
  });
  function buildPlan(d, cfg) {
    if (d.sweep && d.sweep.enabled) {
      if (!d.sweep.items || !d.sweep.items.length) { toast('扫描没有有效参数组合'); return null; }
      d.sweep.stopAfter = null; d.sweep.produced = 0;
      return { sweep: true, items: d.sweep.items, total: d.sweep.items.length, batchId: 'b' + Date.now(), batchDesc: d.sweep.desc };
    }
    const n = d.batch || 1, items = [];
    for (let k = 0; k < n; k++) items.push({ seed: cfg.seed < 0 ? -1 : cfg.seed + k, steps: d.steps, cfg: cfg.cfg, denoise: d.denoise, sampler: cfg.sampler, size: cfg.size, ar: cfg.ar });
    return { sweep: false, items, total: n, batchId: n > 1 ? 'b' + Date.now() : null, batchDesc: '批量 ×' + n };
  }
  function produce(d, plan, k) {
    const it = plan.items[k], dims = dimsOf(it.size, it.ar), model = modelOf(d.modelId);
    const r = {
      id: 'g' + Date.now() + '_' + k + '_' + Math.floor(Math.random() * 999),
      hue: DIFF_HUES[d.history.length % DIFF_HUES.length], mode: d.mode, prompt: d.prompt, neg: d.neg,
      info: (model ? familyOf(model) + ' · ' : '') + (d.mode === 'img' ? '图生图 · 重绘 ' + it.denoise.toFixed(2) + ' · ' : d.mode === 'inpaint' ? '局部重绘 · ' + it.denoise.toFixed(2) + ' · ' : '') +
        dims.w + '×' + dims.h + (it.ar && it.ar !== '1:1' ? '（' + it.ar + '）' : '') + ' · ' + computeOf(d.compute).engine +
        ' · ' + it.sampler + ' · CFG ' + it.cfg + ' · ' + it.steps + ' 步' + (it.seed < 0 ? ' · 随机' : ' · 种子 ' + it.seed) + (d.hires ? ' · 高清修复' : ''),
      timing: d.hires ? '准备 0.4s · 编码 0.6s · 去噪 3.2s · 解码 0.3s · 放大 0.8s · 修复 2.6s' : '准备 0.4s · 编码 0.6s · 去噪 3.2s · 解码 0.3s · 合计 4.5s',
      fav: false,
      params: { modelId: d.modelId, mode: d.mode, compute: d.compute, soc: d.soc, prompt: d.prompt, neg: d.neg, steps: it.steps, denoise: it.denoise, sampler: it.sampler, cfg: it.cfg, seed: it.seed, size: it.size, ar: it.ar, hires: d.hires, baseId: d.baseId },
      batchId: plan.batchId, batchTotal: plan.total, batchDesc: plan.batchDesc
    };
    d.history.unshift(r); d.curId = r.id;
  }

  // ---------- 结果即流程：保存 / 分享 / 底图 / 模板 / 原样重跑 ----------
  action('diff-save-asset', ds => {
    const d = D(), r = d.history.find(x => x.id === (ds.arg || d.curId));
    if (!r) return;
    S.x.assets.unshift({ id: 'as' + Date.now(), kind: 'image', hue: r.hue, label: '生图·' + (r.mode === 'img' ? '图生图' : r.mode === 'inpaint' ? '局部重绘' : '文生图'), date: '2026-11-16', from: 'ai', prompt: r.prompt });
    toast('已存入素材库，可在素材页查看');
  });
  action('diff-save-album', () => toast('已保存到相册（Pictures/MoeApk）'));
  action('diff-share', () => toast('已调起系统分享（原型模拟）'));
  action('diff-use-base', ds => {
    const d = D(), r = d.history.find(x => x.id === ds.arg);
    if (!r) return;
    const a = { id: 'as' + Date.now(), kind: 'image', hue: r.hue, label: '生图·底图', date: '2026-11-16', from: 'ai', prompt: r.prompt };
    S.x.assets.unshift(a); d.mode = 'img'; d.baseId = a.id; d.curId = null; d.mask = null;
    toast('已存为素材并设为底图，调整提示词后可重新生成');
    const cur = nav.current(); if (cur && cur.page === 'diff-image') nav.pop();
    render(); afterRenderGo(2);
  });
  function loadParams(r) {
    const d = D(), p = r.params;
    d.modelId = p.modelId; d.mode = p.mode; d.compute = p.compute || null; d.soc = p.soc || d.soc;
    d.prompt = p.prompt; d.neg = p.neg; d.steps = p.steps; d.denoise = p.denoise; d.baseId = p.baseId; d.hires = !!p.hires;
    d.curId = null; d.lastError = null; d.computeError = null;
    keepSet('diff-prompt', p.prompt); keepSet('diff-neg', p.neg);
    const cfg = diffCfgOf(p.modelId);
    cfg.sampler = p.sampler; cfg.cfg = p.cfg; cfg.seed = p.seed; cfg.size = p.size; cfg.ar = p.ar;
  }
  action('diff-as-template', ds => {
    const r = D().history.find(x => x.id === ds.arg);
    if (!r || !r.params) return;
    loadParams(r); toast('已载入完整参数（未生成，可继续修改）'); render(); afterRenderGo(2);
  });
  action('diff-rerun', ds => { const r = D().history.find(x => x.id === ds.arg); if (!r || !r.params) return; loadParams(r); startGen(); });

  // ---------- 提示词库 / tag 工具栏 / 补全 / 图片反推 ----------
  function promptEntries() {
    const d = D();
    if (!d.promptLibrary) d.promptLibrary = DB.PROMPTS.map(p => Object.assign({}, p));
    return d.promptLibrary;
  }
  function useLibraryPrompt(text, append) {
    const old = currentPromptText();
    const next = append && old.trim() ? old.replace(/[,，\s]+$/, '') + ', ' + text : text;
    keepSet('diff-prompt', next); D().prompt = next; closeDialog(); toast(append ? '已追加到提示词' : '已替换提示词'); render();
  }
  function libraryItem(p, action, arg, deletable) {
    return '<div class="prompt-lib-item"><div class="prompt-lib-copy"><strong>' + esc(p.title || '未命名') + '</strong><span>' + esc(p.text) + '</span></div>' +
      '<div class="prompt-lib-tools"><button class="tbtn" data-a="' + action + '" data-arg="' + esc(arg) + '">替换</button>' +
      '<button class="tbtn" data-a="' + action + '-append" data-arg="' + esc(arg) + '">追加</button>' +
      (deletable ? '<button class="tbtn danger" data-a="plib-delete" data-arg="' + esc(arg) + '">删除</button>' : '') + '</div></div>';
  }
  function openPromptLibrary() {
    const saved = promptEntries();
    showDialog({
      title: '提示词库',
      body: '<div class="prompt-lib-current"><strong>当前草稿</strong><span>' + esc(currentPromptText() || '（空）') + '</span>' +
        '<button class="diff-btn small" data-a="plib-save-current" ' + (currentPromptText().trim() ? '' : 'disabled') + '>一键收藏当前提示词</button></div>' +
        '<h3 class="prompt-lib-heading">我的收藏</h3>' +
        (saved.length ? saved.map(p => libraryItem(p, 'plib-use', p.id, true)).join('') : emptyHint('还没有收藏，点击上方“一键收藏当前提示词”即可添加，无需离开创作页')),
      actions: [{ label: '关闭' }]
    });
  }
  action('diff-prompt-lib', openPromptLibrary);
  action('plib-save-current', () => {
    const text = currentPromptText().trim(); if (!text) return;
    const clean = text.replace(/\s+/g, ' ');
    promptEntries().unshift({ id: 'custom-' + Date.now(), title: clean.slice(0, 24) + (clean.length > 24 ? '…' : ''), text, cat: '收藏', fav: true });
    toast('已收藏到提示词库'); closeDialog(); openPromptLibrary();
  });
  action('plib-use', ds => { const p = promptEntries().find(x => x.id === ds.arg); if (p) useLibraryPrompt(p.text, false); });
  action('plib-use-append', ds => { const p = promptEntries().find(x => x.id === ds.arg); if (p) useLibraryPrompt(p.text, true); });
  action('plib-delete', ds => {
    const d = D(); d.promptLibrary = promptEntries().filter(x => x.id !== ds.arg);
    toast('已删除收藏'); closeDialog(); openPromptLibrary();
  });
  function vocabularyResults() {
    const q = (S.x.vocabQuery || '').trim().toLowerCase();
    const list = DB.TAGS_DEMO.filter(t => !q || t.tag.toLowerCase().includes(q) || (t.cn || '').includes(q));
    if (!list.length) return emptyHint('词表中没有匹配项；可换关键词，未收录不代表词语无效');
    return list.map(t => '<div class="vocab-item"><div><strong>' + esc(t.tag) + '</strong><span>' + esc(t.cn || '暂无中文译名') + '</span></div>' +
      '<button class="tbtn" data-a="vocab-use" data-arg="' + esc(t.tag) + '">追加</button></div>').join('');
  }
  function vocabularyBody() {
    return '<div class="diff-caption">Danbooru / WD tag 演示词表 · 共 ' + DB.TAGS_DEMO.length + ' 条；App 可从 selected_tags.csv 加载完整词表。</div>' +
      '<input class="field-input vocab-search" data-live="vocab-query" placeholder="搜索英文 tag 或中文含义" value="' + esc(S.x.vocabQuery || '') + '">' +
      '<div id="vocab-results">' + vocabularyResults() + '</div>';
  }
  action('diff-vocabulary', () => {
    S.x.vocabQuery = '';
    showDialog({ title: '提示词词表', body: vocabularyBody(), actions: [{ label: '关闭' }] });
  });
  action('vocab-query', (ds, el) => {
    S.x.vocabQuery = el.value;
    const results = document.getElementById('vocab-results');
    if (results) results.innerHTML = vocabularyResults();
  });
  action('vocab-use', ds => useLibraryPrompt(ds.arg, true));
  function promptTerms(text) {
    return text.split(/[,，\n]/).map(part => {
      let t = part.trim();
      if (!t) return '';
      if ((t.startsWith('(') && t.endsWith(')')) || (t.startsWith('[') && t.endsWith(']'))) t = t.slice(1, -1).trim();
      t = t.replace(/:\s*-?(?:\d+(?:\.\d+)?|\.\d+)\s*$/, '').trim();
      return t.replace(/\\([()[\]{}])/g, '$1');
    }).filter(Boolean);
  }
  function unknownPromptTerms(text) {
    const known = new Set(DB.TAGS_DEMO.map(t => t.tag.toLowerCase().replace(/_/g, ' ')));
    const seen = new Set();
    return promptTerms(text).filter(t => {
      const key = t.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
      if (known.has(key) || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function validatePromptSyntax(text) {
    const issues = [];
    if (!text.trim()) issues.push('提示词为空');
    const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.exec(text);
    if (control) issues.push('位置 ' + (control.index + 1) + ' 含有不可见控制字符');
    const stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '\\') { i++; continue; }
      if (c === '(' || c === '[' || c === '{') stack.push({ c, i });
      else if (pairs[c]) {
        const open = stack.pop();
        if (!open || open.c !== pairs[c]) issues.push('位置 ' + (i + 1) + ' 的 ' + c + ' 没有匹配的起始符号');
      }
    }
    stack.forEach(x => issues.push('位置 ' + (x.i + 1) + ' 的 ' + x.c + ' 未闭合'));
    const weight = /\(\s*[^()]*?:\s*([^()]*?)(?:\)|$)/g;
    let m;
    while ((m = weight.exec(text))) {
      const raw = m[1].trim();
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) issues.push('权重“' + raw + '”不是有效数字');
      else if (+raw <= 0 || +raw > 10) issues.push('权重 ' + raw + ' 超出建议范围 0.1–10');
    }
    if (/(?:^|[,，])\s*[,，]/.test(text)) issues.push('存在连续逗号形成的空 tag');
    const trailingSlashes = (text.match(/\\+$/) || [''])[0].length;
    if (trailingSlashes % 2 === 1) issues.push('末尾转义符 \\ 后缺少字符');
    return issues;
  }
  action('diff-prompt-check', () => {
    const text = currentPromptText(), issues = validatePromptSyntax(text), model = modelOf(D().modelId);
    const family = ((model && model.diffusion && (model.diffusion.architecture + ' ' + model.diffusion.family)) || '');
    const naturalLanguage = /DiT|Flux|Qwen|Krea|Z-Image|Klein/i.test(family);
    const unknown = naturalLanguage || issues.length ? [] : unknownPromptTerms(text);
    showDialog({
      title: issues.length ? '发现 ' + issues.length + ' 处语法问题' : (unknown.length ? '检查完成：' + unknown.length + ' 个词未收录' : '提示词检查通过'),
      body: (issues.length ? '<ul class="prompt-check-list">' + issues.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' :
        '<div class="prompt-check-ok">' + icon('check_circle') + '<span>未发现括号、权重或控制字符问题。</span></div>') +
        (unknown.length ? '<h3 class="prompt-lib-heading">词表未收录（需人工确认）</h3><div class="vocab-unknown">' + unknown.map(esc).join('、') + '</div>' : '') +
        '<div class="diff-caption">' + (naturalLanguage ? '当前是自然语言模型，不用 Danbooru 词表硬判完整句子。' : '词表未收录不等于无效，只表示无法确认；命中也不保证模型一定按预期理解。') + '</div>',
      actions: [{ label: '知道了' }]
    });
  });
  function promptEl() { return document.querySelector('[data-keep="diff-prompt"]'); }
  function tagRangeAt(text, pos) {
    let start = pos, end = pos;
    const isSep = c => c === ',' || c === '，' || c === '\n';
    while (start > 0 && !isSep(text[start - 1])) start--;
    while (end < text.length && !isSep(text[end])) end++;
    return { start, end, text: text.slice(start, end) };
  }
  function adjustWeight(text, range, delta) {
    let seg = range.text;
    const lead = seg.match(/^\s*/)[0], core = seg.trim();
    let m = core.match(/^\(\s*(.*?)\s*:?\s*([\d.]+)?\s*\)$/);
    if (m && m[2] != null) {
      const w = Math.max(0.1, Math.round((parseFloat(m[2]) + delta) * 100) / 100);
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    if (m) {
      const w = Math.max(0.1, Math.round((1 + delta) * 100) / 100);
      if (w === 1) return { text: text.slice(0, range.start) + lead + '(' + m[1] + ')' + text.slice(range.end), pos: range.end };
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    m = core.match(/^\[\s*(.*?)\s*\]$/);
    if (m) {
      const w = Math.max(0.1, Math.round((0.9 + delta) * 100) / 100);
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    const w = Math.max(0.1, Math.round((1 + delta) * 100) / 100);
    const body = w === 1 ? core : '(' + core + ':' + w.toFixed(1) + ')';
    return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
  }
  function pushUndo(text) { const d = D(); d.tagUndo = d.tagUndo || []; d.tagUndo.push(text); if (d.tagUndo.length > 100) d.tagUndo.shift(); d.tagRedo = []; }
  function currentPromptText() { const el = promptEl(); return el ? el.value : ((S.x.keep && S.x.keep['diff-prompt']) || D().prompt || ''); }
  function applyPromptText(text, pos) {
    keepSet('diff-prompt', text); D().prompt = text; render();
    setTimeout(() => { const el = promptEl(); if (el && pos != null) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } } }, 0);
  }
  function tagEdit(delta) {
    const text = currentPromptText(), el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    if (!range.text.trim()) { toast('光标处没有可调整的 tag'); return; }
    pushUndo(text); const out = adjustWeight(text, range, delta); applyPromptText(out.text, out.pos);
  }
  action('tag-dec', () => tagEdit(-0.1));
  action('tag-inc', () => tagEdit(0.1));
  action('tag-del', () => {
    const text = currentPromptText(), el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    if (!range.text.trim()) { toast('光标处没有可删除的 tag'); return; }
    pushUndo(text);
    let start = range.start, end = range.end;
    if (text[end] === ',' || text[end] === '，') end++;
    else if (start > 0 && (text[start - 1] === ',' || text[start - 1] === '，')) start--;
    const next = (text.slice(0, start) + text.slice(end)).replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/,\s*$/, '');
    applyPromptText(next, Math.min(start, next.length));
  });
  action('tag-undo', () => {
    const d = D();
    if (!d.tagUndo || !d.tagUndo.length) { toast('没有可撤销的编辑'); return; }
    const cur = currentPromptText(); d.tagRedo = d.tagRedo || []; d.tagRedo.push(cur); applyPromptText(d.tagUndo.pop(), null);
  });
  action('tag-redo', () => {
    const d = D();
    if (!d.tagRedo || !d.tagRedo.length) { toast('没有可重做的编辑'); return; }
    d.tagUndo = d.tagUndo || []; d.tagUndo.push(currentPromptText()); applyPromptText(d.tagRedo.pop(), null);
  });
  let lastSuggestKey = '';
  function currentSuggestions() {
    const text = currentPromptText(), el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    const raw = range.text.trim().replace(/^[(\[]+/, '').replace(/[\])]+$/, ''), frag = raw.toLowerCase();
    if (frag.length < 2) return [];
    const prefix = [], contains = [], alias = [];
    for (const t of DB.TAGS_DEMO) {
      const tag = t.tag.toLowerCase();
      if (tag.indexOf(frag) === 0) prefix.push(t);
      else if (tag.indexOf(frag) > 0) contains.push(t);
      if (t.cn && raw.length >= 1 && t.cn.indexOf(raw) >= 0 && tag.indexOf(frag) !== 0) alias.push(t);
    }
    const byCount = (a, b) => b.count - a.count;
    prefix.sort(byCount); contains.sort(byCount); alias.sort(byCount);
    const seen = new Set();
    return prefix.concat(contains, alias).filter(t => { if (seen.has(t.tag)) return false; seen.add(t.tag); return true; }).slice(0, 12);
  }
  document.addEventListener('input', e => {
    if (!e.target.dataset) return;
    if (e.target.dataset.keep === 'diff-prompt') {
      D().prompt = e.target.value;
      const key = e.target.value + '|' + e.target.selectionStart;
      if (key !== lastSuggestKey) { lastSuggestKey = key; render(); }
    } else if (e.target.dataset.keep === 'diff-neg') D().neg = e.target.value;
  });
  action('tag-complete', ds => {
    const text = currentPromptText(), el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos); pushUndo(text);
    const tag = ds.arg, next = text.slice(0, range.start) + tag + ', ' + text.slice(range.end);
    applyPromptText(next, range.start + tag.length + 2);
  });
  action('diff-caption', () => {
    const imgs = (S.x.assets || []).filter(a => a.kind === 'image');
    showDialog({
      title: '从图片反推提示词',
      body: '<div class="muted small" style="padding-bottom:6px">图片仅在本机分析，不会上传。选择反推方式：</div>' +
        (imgs.length ? '<div class="pick-grid">' + imgs.map(a => '<div class="pick-cell" data-a="diff-caption-img" data-arg="' + a.id + '" title="' + esc(a.label) + '" style="background:' + hueBg(a.hue, 165) + '"></div>').join('') + '</div>' : emptyHint('素材库暂无图片，请先到素材页导入')),
      actions: [{ label: '取消' }]
    });
  });
  action('diff-caption-img', ds => {
    closeDialog();
    const a = (S.x.assets || []).find(x => x.id === ds.arg);
    mock.startJob('diff-caption', '图片反推（本地模型）', 2600, ['加载反推模型', '视觉编码', '生成标签']);
    const t = setInterval(() => {
      if (mock.isJobDone('diff-caption')) {
        clearInterval(t);
        const mode = S.x.captionMode || 'tags';
        showDialog({
          title: '反推结果（' + esc(a ? a.label : '') + '）',
          body: captionBody(mode),
          actions: [{ label: '关闭' }, { label: '填入提示词', style: 'filled', run: () => { keepSet('diff-prompt', DB.CAPTION_DEMO[mode]); D().prompt = DB.CAPTION_DEMO[mode]; toast('已填入反推结果'); render(); } }]
        });
      }
    }, 300);
    render();
  });
  function captionBody(mode) {
    return '<div class="chip-row" style="padding-top:0">' + [['tags', '标签'], ['short', '短句'], ['detailed', '详细']].map(x => chip(x[1], mode === x[0], 'caption-mode', x[0])).join('') + '</div><div class="caption-result">' + esc(DB.CAPTION_DEMO[mode]) + '</div>';
  }
  action('caption-mode', ds => { S.x.captionMode = ds.arg; const d = S.dialog; if (d) { d.body = captionBody(S.x.captionMode); render(); } });

  // ---------- 参数扫描（轴 + 值语法 + 第二轴 + 预计张数） ----------
  const SWEEP_PARAMS = [['seed', '种子'], ['steps', '步数'], ['cfg', 'CFG'], ['denoise', '重绘幅度'], ['sampler', '采样器']];
  action('diff-sweep-open', () => {
    const d = D();
    d.sweep = d.sweep || { a1: 'seed', a2: 'none', enabled: false, samplers1: [], samplers2: [] };
    showDialog({ title: '参数扫描（sweep）', body: sweepBody(d.sweep), actions: [{ label: '简单批量（不扫描）', run: () => { D().sweep = null; render(); } }, { label: '开始扫描', style: 'filled', keep: true, run: startSweep }] });
  });
  function sweepBody(sw) {
    const axisRow = (key, val, act, allowNone) => '<div class="muted small" style="margin-top:8px">' + key + '</div><div class="chip-row" style="padding-top:4px">' +
      (allowNone ? [['none', '无']] : []).concat(SWEEP_PARAMS).map(p => chip(p[1], val === p[0], act, p[0])).join('') + '</div>';
    const valInput = (id, a) => a === 'sampler'
      ? '<div class="chip-row" style="padding-top:4px">' + SAMPLERS.map(s => chip(s, (sw['samplers' + id.slice(-1)] || []).includes(s), 'sw-sampler', id + ':' + s)).join('') + '</div>'
      : '<input class="field-input" data-keep="' + id + '" placeholder="' + sweepHint(a) + '" value="' + esc((S.x.keep && S.x.keep[id]) || '') + '">';
    return '<div class="muted small">每张图改变一个（或两个）参数，逐张生成；结果在历史里聚合为一组。</div>' + axisRow('轴 1', sw.a1, 'sw-a1', false) + valInput('sw-v1', sw.a1) +
      axisRow('轴 2（可选）', sw.a2, 'sw-a2', true) + (sw.a2 !== 'none' ? valInput('sw-v2', sw.a2) : '') + '<div class="dl-status" style="margin-top:8px">' + sweepEstimate(sw) + '</div>';
  }
  function sweepHint(a) {
    if (a === 'seed') return '如 1..8 或 100,200,300';
    if (a === 'steps') return '如 20,25,30 或 16..24 by 4';
    if (a === 'cfg') return '如 5,6.5,8 或 4..8 by 2';
    if (a === 'denoise') return '如 0.4..0.8 by 0.2';
    return '';
  }
  function axisOf(sw, n) {
    const a = sw['a' + n];
    if (!a || a === 'none') return null;
    if (a === 'sampler') { const arr = sw['samplers' + n] || []; return arr.length ? { param: a, values: arr } : { param: a, values: null }; }
    return { param: a, values: parseValues((S.x.keep && S.x.keep['sw-v' + n]) || '') };
  }
  function sweepEstimate(sw) {
    const a1 = axisOf(sw, 1), a2 = axisOf(sw, 2);
    if (!a1 || !a1.values) return '请先为轴 1 输入有效的值列表';
    const n = a1.values.length * (a2 && a2.values ? a2.values.length : 1);
    if (a2 && !a2.values) return '轴 2 的值列表无效';
    if (a2 && a1.param === a2.param) return '两个轴不能是同一个参数';
    if (n > 100) return '组合数 ' + n + ' 超过上限 100，请减少取值';
    return '预计 ' + n + ' 张 · 约 ' + Math.max(1, Math.round(n * 1.2)) + ' 秒（演示）';
  }
  function parseValues(text) {
    const t = (text || '').trim();
    if (!t) return null;
    const m = t.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)(?:\s+by\s+(\d+(?:\.\d+)?))?$/);
    if (m) {
      const a = +m[1], b = +m[2], step = m[3] ? +m[3] : 1;
      if (step <= 0) return null;
      const out = [];
      if (a <= b) { for (let v = a; v <= b + 1e-9; v += step) out.push(+v.toFixed(4)); }
      else { for (let v = a; v >= b - 1e-9; v -= step) out.push(+v.toFixed(4)); }
      return out.length ? out : null;
    }
    const parts = t.split(/[,，\s]+/).filter(x => x);
    if (!parts.length || parts.some(x => isNaN(+x))) return null;
    return parts.map(Number);
  }
  function startSweep() {
    const d = D(), sw = d.sweep, a1 = axisOf(sw, 1), a2 = axisOf(sw, 2), est = sweepEstimate(sw);
    if (est.indexOf('预计') !== 0) { toast(est); return; }
    const cfg = activeCfg(), base = { seed: cfg.seed, steps: d.steps, cfg: cfg.cfg, denoise: d.denoise, sampler: cfg.sampler, size: cfg.size, ar: cfg.ar }, items = [];
    for (const v1 of a1.values) for (const v2 of (a2 && a2.values ? a2.values : [null])) {
      const it = Object.assign({}, base); it[a1.param] = v1;
      if (a2 && a2.param) it[a2.param] = v2;
      if (a1.param === 'seed' && base.seed < 0) it.seed = v1;
      items.push(it);
    }
    d.sweep.enabled = true; d.sweep.items = items;
    d.sweep.desc = a1.param + '=' + a1.values.join('/') + (a2 && a2.param ? ' × ' + a2.param + '=' + a2.values.join('/') : '');
    closeDialog(); toast('扫描已设定：' + items.length + ' 张，点生成开始'); render();
  }
  action('sw-a1', ds => { D().sweep.a1 = ds.arg; closeDialog(); ACTIONS['diff-sweep-open'](); });
  action('sw-a2', ds => { D().sweep.a2 = ds.arg; closeDialog(); ACTIONS['diff-sweep-open'](); });
  action('sw-sampler', ds => {
    const [which, val] = ds.arg.split(':'), d = D(), key = 'samplers' + which.slice(-1), arr = d.sweep[key] = d.sweep[key] || [], i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
    closeDialog(); ACTIONS['diff-sweep-open']();
  });
  document.addEventListener('input', e => {
    if (!e.target.dataset || (e.target.dataset.keep !== 'sw-v1' && e.target.dataset.keep !== 'sw-v2')) return;
    const d = S.dialog;
    if (d && d.title && d.title.indexOf('参数扫描') === 0) { d.body = sweepBody(D().sweep); render(); }
  });

  // ---------- 保留的生成设置独立子页（与向导第 4 步共用真实控件与模型配置） ----------
  registerScreen('diff-config', {
    title: '生成设置',
    render(arg) {
      S.x.dcId = arg || S.x.dcId;
      const m = modelOf(S.x.dcId) || DIFF_MODELS[0];
      return '<div class="dl-status" style="padding:8px 2px 0">当前模型：' + esc(m.name) + ' · 设置按模型独立保存</div>' +
        '<div class="diff-config-legacy">' + diffParamsHtml(m, D()) + '</div>' +
        '<div style="margin-top:12px;display:flex;gap:8px">' + btn('完成', 'dc-done', null, 'flex') + '</div>';
    }
  });
  action('dc-sampler', ds => { activeCfg().sampler = ds.arg; render(); });
  action('dc-set', (ds, el) => {
    activeCfg().cfg = +el.value;
    const lb = el.parentElement.querySelector('.li-title'); if (lb) lb.textContent = 'CFG 强度 ' + (+el.value).toFixed(1);
  });
  action('dc-seed', (ds, el) => { if (el.value !== '' && Number.isFinite(+el.value)) activeCfg().seed = +el.value; });
  action('dc-size', ds => { activeCfg().size = +ds.arg; render(); });
  action('dc-ar', ds => { activeCfg().ar = ds.arg; render(); });
  action('dc-preview', () => { activeCfg().preview = !activeCfg().preview; render(); });
  action('dc-tile', ds => { activeCfg().hiresTile = +ds.arg; render(); });
  action('dc-debug-fail', () => {
    D().debugFail = true; toast('下次生成将在去噪阶段失败（演示错误卡）');
    const cur = nav.current(); if (cur && cur.page === 'diff-config') nav.pop();
  });
  action('dc-reset', () => { S.x.diffCfg[activeModel().id] = Object.assign({}, DIFF_DEF); render(); });
  action('dc-done', () => nav.pop());

  // ---------- 遮罩 canvas：pointer 直接绘制，页面重绘后按归一化笔迹恢复 ----------
  function initMaskCanvas(c) {
    c.__init = true;
    const wrap = document.getElementById('mask-wrap');
    function redraw() {
      if (!c.isConnected || !wrap) return;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      const ms = maskState();
      for (const s of ms.strokes) {
        if (!s.pts.length) continue;
        ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(s.pts[0][0] * w, s.pts[0][1] * h);
        for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] * w, s.pts[i][1] * h);
        if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.01, s.pts[0][1] * h);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    c.__redraw = redraw;
    function pt(e) { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    let drawing = false, cur = null;
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (err) { }
      drawing = true; const ms = maskState(); cur = { pts: [pt(e)], size: ms.brush, erase: ms.erase }; ms.strokes.push(cur); redraw();
    });
    c.addEventListener('pointermove', e => { if (!drawing) return; cur.pts.push(pt(e)); redraw(); });
    const up = () => {
      drawing = false;
      const editor = wrap && wrap.closest('.diff-media-editor');
      const count = editor && editor.querySelector('.diff-strokes');
      if (count) count.textContent = maskState().strokes.length + ' 笔';
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    redraw();
  }
  setInterval(() => {
    const c = document.getElementById('mask-canvas');
    if (!c) return;
    if (!c.__init) initMaskCanvas(c);
    if (c.__redraw && (c.width !== c.clientWidth || c.height !== c.clientHeight)) c.__redraw();
  }, 400);
})();
