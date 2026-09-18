// 图片生成子页 + 生成设置子页。对应 ui/ai/DiffusionScreen.kt、DiffConfigScreen.kt
(function () {
  const { A, assetThumb } = window._aiShared;

  registerScreen('diffusion', { title: '图片生成', topRight: { icon: 'menu', act: 'diff-menu' }, render: diffPage });

  // ---------- 图片生成（独立子页：生成历史抽屉 + 底部输入区） ----------
  const D = () => A().diff = A().diff || { mode: 'txt', modelId: null, prompt: '1girl, anime style, masterpiece, best quality', steps: 20, denoise: 0.6, baseId: null, curId: null, history: [] };
  const DIFF_MODELS = DB.AI.filter(m => m.kind === 'diffusion');
  const DIFF_DEF = { sampler: 'DPM++ 2M', cfg: 7, seed: -1, size: 512 };
  function diffCfgOf(id) {
    S.x.diffCfg = S.x.diffCfg || {};
    if (!S.x.diffCfg[id]) S.x.diffCfg[id] = Object.assign({}, DIFF_DEF);
    return S.x.diffCfg[id];
  }
  const DIFF_HUES = [340, 26, 200, 268, 150, 45];

  function diffPage() {
    const d = D();
    const cfg = diffCfgOf(d.modelId || DIFF_MODELS[0].id);
    const model = DIFF_MODELS.find(m => m.id === d.modelId);
    let h = '<div class="chat-page">';
    // 主区域：生成进度 / 当前结果 / 空态
    const j = mock.job('diff-gen');
    if (j && !j.done) {
      const pct = Math.round(j.p * 100);
      const blur = Math.max(0, 14 * (1 - j.p));
      h += '<div style="padding-top:8px">' + card(
        '<div class="diff-preview"><div class="diff-img" style="filter:blur(' + blur.toFixed(1) + 'px) saturate(' + (0.7 + j.p * 0.3).toFixed(2) + ');transform:scale(' + (1.06 - j.p * 0.06).toFixed(3) + ')"></div>' +
        '<div class="diff-pct">' + pct + '%</div></div>' +
        '<div class="dl-status" style="margin-top:8px">生成中 · ' + esc(j.phase || '') + '</div>' +
        '<div style="margin-top:6px">' + progress(j.p) + '</div>' +
        '<div style="margin-top:8px">' + textBtn('取消', 'diff-cancel', null, 'danger') + '</div>') + '</div>';
    } else if (d.curId) {
      const r = d.history.find(x => x.id === d.curId);
      if (r) {
        h += '<div style="padding-top:8px">' + card(
          '<div style="aspect-ratio:1;border-radius:10px;background:linear-gradient(135deg,hsl(' + r.hue + ',62%,64%),hsl(' + ((r.hue + 60) % 360) + ',48%,30%));display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:12px">模拟出图（原型占位）</div>' +
          '<div class="li-sub" style="margin-top:8px">' + esc(r.info) + '</div>' +
          '<div class="muted" style="font-size:12px;margin-top:4px;word-break:break-all">' + esc(r.prompt) + '</div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          btn('保存到素材', 'diff-save-asset', null, 'small') + btn('保存到相册', 'diff-save-album', null, 'small ghost') +
          (r.mode === 'txt' ? btn('作为底图', 'diff-use-base', r.id, 'small ghost') : '') + '</div>') + '</div>';
      }
    } else {
      h += '<div class="chat-empty">' + icon('image') +
        '<div style="font-size:16px;color:var(--on-surface)">描述画面，开始生成</div>' +
        '<div class="muted small">底部输入提示词；历史生成记录在右上角菜单。</div></div>';
    }
    // 底部输入区：模式 + 模型选择 / 底图 + 重绘幅度 / 步数 / 提示词 + 生成
    h += '<div class="composer">';
    h += '<div class="composer-top">' +
      '<div class="chip-row" style="padding:0;flex:none">' + chip('文生图', d.mode === 'txt', 'diff-mode', 'txt') + chip('图生图', d.mode === 'img', 'diff-mode', 'img') + '</div>' +
      '<button class="chip model-chip" data-a="diff-pick">' + icon('image') + '<span>' + esc(model ? model.name : '选择模型') + '</span>' + icon('expand_more') + '</button></div>';
    if (d.mode === 'img') {
      const base = d.baseId && (S.x.assets || []).find(a => a.id === d.baseId);
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0 2px">' +
        (base ?
          assetThumb(base, 'd-thumb') + '<div class="li-sub" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(base.label) + '</div>' +
          textBtn('更换', 'diff-base') + textBtn('移除', 'diff-base-clear', null, 'danger') :
          '<div>' + btn('选择底图（素材库）', 'diff-base', null, 'small ghost') + '</div>') + '</div>';
      h += '<label class="slider-row"><span class="li-title">重绘幅度 ' + d.denoise.toFixed(2) + '</span>' +
        '<input type="range" min="0.2" max="0.9" step="0.05" value="' + d.denoise + '" class="slider" data-live="diff-denoise"></label>';
    }
    h += '<label class="slider-row"><span class="li-title">采样步数 ' + d.steps + '</span>' +
      '<input type="range" min="10" max="40" step="1" value="' + d.steps + '" class="slider" data-live="diff-steps"></label>';
    h += '<div class="msg-row">' +
      '<input class="field-input" style="flex:1" data-keep="diff-prompt" placeholder="提示词（英文，逗号分隔）" value="' + esc(d.prompt) + '">' +
      '<button class="btn" style="min-height:48px;padding:0 18px" data-a="diff-gen">' + icon('auto_awesome') + '</button></div>';
    h += '</div>';
    if (S.x.diffDrawer) h += diffDrawerHtml();
    return h + '</div>';
  }

  // 侧边抽屉：生成历史 + 底部生成设置
  function diffDrawerHtml() {
    const d = D();
    const items = d.history.map(r =>
      '<div class="d-sess' + (d.curId === r.id ? ' on' : '') + '" data-a="diff-hist" data-arg="' + r.id + '">' +
      '<div class="d-thumb" style="background:linear-gradient(135deg,hsl(' + r.hue + ',62%,64%),hsl(' + ((r.hue + 60) % 360) + ',48%,30%))"></div>' +
      '<div class="d-body"><div class="d-title">' + esc(r.prompt || '（无提示词）') + '</div>' +
      '<div class="d-sub">' + esc(r.info) + '</div></div>' +
      '<button class="d-del" data-a="diff-hist-del" data-arg="' + r.id + '" title="删除">' + icon('close') + '</button></div>').join('');
    return '<div class="drawer-mask" data-a="diff-drawer-close"><div class="drawer" data-a="drawer-body">' +
      '<div class="d-head"><span>生成历史</span><span class="muted small">' + d.history.length + ' 张</span></div>' +
      '<div style="padding:0 12px 10px">' + btn('＋ 新建生成', 'diff-new', null, 'small block ghost') + '</div>' +
      '<div class="d-list">' + (items || '<div class="muted small center" style="padding:24px 0">暂无生成记录</div>') + '</div>' +
      '<div class="d-foot" data-a="diff-settings">' + icon('settings') + '<span>生成设置</span></div>' +
      '</div></div>';
  }
  action('diff-menu', () => { S.x.diffDrawer = true; render(); });
  action('diff-drawer-close', () => { S.x.diffDrawer = false; render(); });
  action('diff-new', () => { D().curId = null; S.x.diffDrawer = false; render(); });
  action('diff-hist', ds => { D().curId = ds.arg; S.x.diffDrawer = false; render(); });
  action('diff-hist-del', ds => confirmDialog('删除记录', '将从生成历史删除。', '删除', () => {
    const d = D();
    d.history = d.history.filter(x => x.id !== ds.arg);
    if (d.curId === ds.arg) d.curId = null;
    render();
  }, true));
  action('diff-settings', () => { S.x.diffDrawer = false; nav.push('diff-config', D().modelId || DIFF_MODELS[0].id); });

  // 模型选择对话框：列表内直接下载/换用
  action('diff-pick', () => {
    const d = D();
    showDialog({
      title: '选择生图模型',
      body: DIFF_MODELS.map(m => {
        const size = m.parts.reduce((s, p) => s + p.size, 0);
        const j = mock.job('diff-mdl-' + m.id);
        let trail;
        if (d.modelId === m.id) trail = '<span class="badge soft">当前</span>';
        else if (j && !j.done) trail = '<div style="width:84px">' + progress(j.p) + '</div>';
        else if (j && j.done) trail = textBtn('换用', 'diff-pick-use', m.id);
        else trail = textBtn('下载（' + fmtSize(size) + '）', 'diff-pick-dl', m.id);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + esc(m.summary) + ' · ' + fmtSize(size) + '</div></div>' + trail + '</div>';
      }).join(''),
      actions: [{ label: '取消' }]
    });
  });
  action('diff-pick-dl', ds => {
    const m = DIFF_MODELS.find(x => x.id === ds.arg);
    mock.startJob('diff-mdl-' + m.id, '下载 ' + m.name, 3400, ['源 1', '源 2', '校验']);
    const t = setInterval(() => {
      const job = mock.job('diff-mdl-' + m.id);
      if (!job) { clearInterval(t); return; } // 被取消
      if (job.done) {
        clearInterval(t);
        D().modelId = m.id; D().curId = null;
        render();
      }
    }, 300);
    render();
  });
  action('diff-pick-use', ds => { D().modelId = ds.arg; D().curId = null; closeDialog(); render(); });

  action('diff-mode', ds => { D().mode = ds.arg; render(); });
  action('diff-base', () => {
    const imgs = (S.x.assets || []).filter(a => a.kind === 'image');
    showDialog({
      title: '选择底图（素材库）',
      body: imgs.length ? '<div class="pick-grid">' + imgs.map(a =>
        '<div class="pick-cell" data-a="diff-pick-base" data-arg="' + a.id + '" title="' + esc(a.label) + '" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))"></div>').join('') + '</div>'
        : emptyHint('素材库暂无图片，请先到素材页导入'),
      actions: [{ label: '取消' }]
    });
  });
  action('diff-pick-base', ds => { D().baseId = ds.arg; closeDialog(); render(); });
  action('diff-base-clear', () => { D().baseId = null; render(); });
  action('diff-steps', (ds, el) => {
    D().steps = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = '采样步数 ' + el.value; // 拖动中只改标签，避免重渲染打断拖动
  });
  action('diff-denoise', (ds, el) => {
    D().denoise = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = '重绘幅度 ' + (+el.value).toFixed(2);
  });
  action('diff-gen', () => {
    const d = D();
    if (!d.modelId) { toast('请先选择并下载生图模型'); return; }
    if (d.mode === 'img' && !d.baseId) { toast('请先从素材库选择底图'); return; }
    d.prompt = (S.x.keep && S.x.keep['diff-prompt']) || d.prompt;
    const cfg = diffCfgOf(d.modelId);
    mock.startJob('diff-gen', d.mode === 'img' ? '图生图' : '文生图', 4200,
      d.mode === 'img' ? ['编码提示词', 'VAE 编码底图', '去噪 ' + d.steps + ' 步', '解码'] : ['编码提示词', '去噪 ' + d.steps + ' 步', '解码']);
    const t = setInterval(() => {
      const job = mock.job('diff-gen');
      if (!job) { clearInterval(t); return; } // 被取消
      if (job.done) {
        clearInterval(t);
        const r = {
          id: 'g' + Date.now(), hue: DIFF_HUES[d.history.length % DIFF_HUES.length],
          mode: d.mode, prompt: d.prompt,
          info: (d.mode === 'img' ? '图生图 · 重绘 ' + d.denoise.toFixed(2) + ' · ' : '') +
            cfg.size + '×' + cfg.size + ' · ' + cfg.sampler + ' · CFG ' + cfg.cfg + ' · ' + d.steps + ' 步'
        };
        d.history.unshift(r);
        d.curId = r.id;
        render();
      }
    }, 300);
    render();
  });
  action('diff-cancel', () => { mock.resetJob('diff-gen'); render(); });
  action('diff-save-asset', () => {
    const d = D();
    const r = d.history.find(x => x.id === d.curId);
    if (!r) return;
    S.x.assets.unshift({ id: 'as' + Date.now(), kind: 'image', hue: r.hue, label: '生图·' + (r.mode === 'img' ? '图生图' : '文生图'), date: '2026-09-18' });
    toast('已存入素材库，可在素材页查看');
  });
  action('diff-save-album', () => toast('已保存到相册（Pictures/MoeApk）'));
  // 文生图结果一键转图生图底图：先存为素材再设为底图
  action('diff-use-base', ds => {
    const d = D();
    const r = d.history.find(x => x.id === ds.arg);
    if (!r) return;
    const a = { id: 'as' + Date.now(), kind: 'image', hue: r.hue, label: '生图·底图', date: '2026-09-18' };
    S.x.assets.unshift(a);
    d.mode = 'img'; d.baseId = a.id; d.curId = null;
    toast('已存为素材并设为底图，调整提示词后可重新生成');
    render();
  });

  // ---------- 生成设置（子页，按模型独立保存） ----------
  registerScreen('diff-config', {
    title: '生成设置',
    render(arg) {
      S.x.dcId = arg || S.x.dcId;
      const m = DIFF_MODELS.find(x => x.id === S.x.dcId) || DIFF_MODELS[0];
      const cfg = diffCfgOf(m.id);
      let h = '<div class="dl-status" style="padding:8px 2px 0">当前模型：' + esc(m.name) + '</div>';
      h += card(
        '<div class="muted small">采样器</div><div class="chip-row" style="padding-top:4px">' +
        ['Euler', 'DPM++ 2M', 'UniPC', 'DDIM'].map(s => chip(s, cfg.sampler === s, 'dc-sampler', s)).join('') + '</div>' +
        '<label class="slider-row"><span class="li-title">CFG 强度 ' + cfg.cfg.toFixed(1) + '</span>' +
        '<input type="range" min="1" max="20" step="0.5" value="' + cfg.cfg + '" class="slider" data-live="dc-set"></label>' +
        '<label class="field"><span class="field-label">种子（-1 为随机）</span>' +
        '<input class="field-input" type="number" value="' + cfg.seed + '" data-live="dc-seed"></label>' +
        '<div class="muted small" style="padding-top:6px">输出尺寸</div><div class="chip-row" style="padding-top:4px">' +
        [512, 768, 1024].map(z => chip(z + '×' + z, cfg.size === z, 'dc-size', z)).join('') + '</div>');
      h += '<div style="margin-top:12px;display:flex;gap:8px">' +
        btn('恢复默认', 'dc-reset', null, 'ghost') + btn('完成', 'dc-done', null, 'flex') + '</div>';
      h += '<div class="muted small center" style="padding:12px">生成设置按模型独立保存。</div>';
      return h;
    }
  });
  action('dc-sampler', ds => { diffCfgOf(S.x.dcId).sampler = ds.arg; render(); });
  action('dc-set', (ds, el) => {
    diffCfgOf(S.x.dcId).cfg = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = 'CFG 强度 ' + (+el.value).toFixed(1);
  });
  action('dc-seed', (ds, el) => { diffCfgOf(S.x.dcId).seed = +el.value; });
  action('dc-size', ds => { diffCfgOf(S.x.dcId).size = +ds.arg; render(); });
  action('dc-reset', () => { S.x.diffCfg[S.x.dcId] = Object.assign({}, DIFF_DEF); render(); });
  action('dc-done', () => nav.pop());
})();
