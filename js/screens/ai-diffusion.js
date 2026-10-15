// 图片生成子页 + 生成设置子页。对应 ui/ai/DiffusionScreen.kt、DiffConfigScreen.kt
// 2026-10 AI 功能改进（第十八轮）：
//   D1 局部重绘（遮罩涂抹）/ D2 高清修复一键管线（生成→放大×2→UltraFix）/ D3 宽高比 /
//   D4 过程预览帧 / D5 采样器扩展 / D6 参数扫描（sweep）/ D7 结果即流程（模板/重跑/收藏）/
//   D8 提示词库·tag 工具栏·补全·图片反推 / D9 seed 锁·换载成本提示·分阶段耗时·错误就地显示
(function () {
  const { A, assetThumb } = window._aiShared;

  registerScreen('diffusion', { title: '图片生成', topRight: { icon: 'menu', act: 'diff-menu' }, render: diffPage });

  // ---------- 图片生成（独立子页：生成历史抽屉 + 底部输入区） ----------
  const D = () => A().diff = A().diff || {
    mode: 'txt', modelId: null,
    prompt: (S.x.keep && S.x.keep['diff-prompt']) || '1girl, anime style, masterpiece, best quality',
    neg: (S.x.keep && S.x.keep['diff-neg']) || 'lowres, bad anatomy, blurry',
    steps: 20, denoise: 0.6, baseId: null, curId: null, batch: 1, history: [],
    hires: false, mask: null, sweep: null, debugFail: false
  };
  const DIFF_MODELS = DB.AI.filter(m => m.kind === 'diffusion');
  const DIFF_DEF = { sampler: 'DPM++ 2M', cfg: 7, seed: -1, size: 512, ar: '1:1', preview: true, hiresTile: 512 };
  const SAMPLERS = ['DPM++ 2M', 'DPM++ 2M Karras', 'DPM++ 2M SDE', 'DPM++ 2M SDE Karras', 'Euler', 'Euler Karras', 'Euler A', 'Euler A Karras', 'LCM'];
  function diffCfgOf(id) {
    S.x.diffCfg = S.x.diffCfg || {};
    if (!S.x.diffCfg[id]) S.x.diffCfg[id] = Object.assign({}, DIFF_DEF);
    return S.x.diffCfg[id];
  }
  const DIFF_HUES = [340, 26, 200, 268, 150, 45];
  const isSdxl = m => m && /sdxl|anima/i.test(m.id + ' ' + m.name);
  function dimsOf(size, ar) {
    if (!ar || ar === '1:1') return { w: size, h: size };
    const seg = ar.split(':').map(Number);
    const ratio = seg[0] / seg[1];
    return ratio > 1 ? { w: size, h: Math.round(size / ratio) } : { w: Math.round(size * ratio), h: size };
  }
  function maskState() {
    const d = D();
    if (!d.mask) d.mask = { strokes: [], brush: 28, erase: false };
    return d.mask;
  }

  function diffPage() {
    const d = D();
    const cfg = diffCfgOf(d.modelId || DIFF_MODELS[0].id);
    const model = DIFF_MODELS.find(m => m.id === d.modelId);
    const wide = isWide();
    let h = wide ? '<div class="chat-page two-pane"><div class="pane-side">' + diffHistHtml() + '</div><div class="pane-main">'
      : '<div class="chat-page">';
    // 主区域：错误卡 / 生成进度（含过程预览帧与换载提示）/ 当前结果 / 空态
    const j = mock.job('diff-gen');
    if (d.lastError) {
      h += '<div style="padding-top:8px">' + card(
        '<div class="err-title">' + icon('warning') + '生成失败 · ' + esc(d.lastError.phase) + '</div>' +
        '<div class="err-body">' + esc(d.lastError.reason) + '</div>' +
        '<div class="err-hint">' + esc(d.lastError.hint) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px">' + btn('重试', 'diff-retry', null, 'small') + textBtn('关闭', 'diff-err-close', null, 'ghost') + '</div>', 'err-card') + '</div>';
    } else if (j && !j.done) {
      const pct = Math.round(j.p * 100);
      const blur = Math.max(0, 14 * (1 - j.p));
      const showPreview = cfg.preview && !d.hires;
      h += '<div style="padding-top:8px">' + card(
        (d.evictNote ? '<div class="cost-note">' + esc(d.evictNote) + '</div>' : '') +
        '<div class="diff-preview"><div class="diff-img" style="filter:blur(' + blur.toFixed(1) + 'px) saturate(' + (0.7 + j.p * 0.3).toFixed(2) + ');transform:scale(' + (1.06 - j.p * 0.06).toFixed(3) + ')"></div>' +
        '<div class="diff-pct">' + pct + '%</div></div>' +
        '<div class="dl-status" style="margin-top:8px">' + (showPreview ? '过程预览 · 每 2 步更新 · ' : (d.hires ? '分块修复中，无过程预览 · ' : '')) + esc(j.phase || '') + '</div>' +
        '<div style="margin-top:6px">' + progress(j.p) + '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px">' + textBtn('取消', 'diff-cancel', null, 'danger') +
        (d.sweep && d.sweep.enabled ? textBtn('跑完本张后停止', 'diff-stop-after', null, 'ghost') : '') + '</div>') + '</div>';
    } else if (d.curId) {
      const r = d.history.find(x => x.id === d.curId);
      if (r) {
        const dims = dimsOf(r.params ? r.params.size : 512, r.params ? r.params.ar : '1:1');
        h += '<div style="padding-top:8px">' + card(
          '<div style="position:relative"><div style="aspect-ratio:' + (dims.w / dims.h).toFixed(3) + ';border-radius:10px;background:linear-gradient(135deg,hsl(' + r.hue + ',62%,64%),hsl(' + ((r.hue + 60) % 360) + ',48%,30%));display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:12px">模拟出图（原型占位）</div>' +
          '<button class="icbtn fav-corner" data-a="diff-fav" data-arg="' + r.id + '" title="收藏">' + icon(r.fav ? 'favorite' : 'favorite_border') + '</button></div>' +
          '<div class="li-sub" style="margin-top:8px">' + esc(r.info) + '</div>' +
          '<div class="muted" style="font-size:12px;margin-top:4px;word-break:break-all">' + esc(r.prompt) + '</div>' +
          (r.neg ? '<div class="muted" style="font-size:11px;margin-top:2px;word-break:break-all">负向：' + esc(r.neg) + '</div>' : '') +
          '<div class="timing-line">' + esc(r.timing || '') + '</div>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          btn('保存到素材', 'diff-save-asset', null, 'small') + btn('保存到相册', 'diff-save-album', null, 'small ghost') +
          (r.mode === 'txt' ? btn('作为底图', 'diff-use-base', r.id, 'small ghost') : '') +
          btn('以此为模板', 'diff-as-template', r.id, 'small ghost') + btn('原样重跑', 'diff-rerun', r.id, 'small ghost') + '</div>') + '</div>';
      }
    } else {
      h += '<div class="chat-empty">' + icon('image') +
        '<div style="font-size:16px;color:var(--on-surface)">描述画面，开始生成</div>' +
        '<div class="muted small">底部输入提示词；历史生成记录在右上角菜单。</div></div>';
    }
    // 底部输入区：模式 + 模型选择 / 底图 + 遮罩 / 步数 / 提示词 + 生成
    h += '<div class="composer">';
    h += '<div class="composer-top">' +
      '<div class="chip-row" style="padding:0;flex:none">' +
      chip('文生图', d.mode === 'txt', 'diff-mode', 'txt') +
      chip('图生图', d.mode === 'img', 'diff-mode', 'img') +
      chip('局部重绘', d.mode === 'inpaint', 'diff-mode', 'inpaint') + '</div>' +
      '<button class="chip model-chip" data-a="diff-pick">' + icon('image') + '<span>' + esc(model ? model.name : '选择模型') + '</span>' + icon('expand_more') + '</button></div>';
    if (d.mode === 'img' || d.mode === 'inpaint') {
      const base = d.baseId && (S.x.assets || []).find(a => a.id === d.baseId);
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0 2px">' +
        (base ?
          assetThumb(base, 'd-thumb') + '<div class="li-sub" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(base.label) + '</div>' +
          textBtn('更换', 'diff-base') + textBtn('移除', 'diff-base-clear', null, 'danger') :
          '<div>' + btn('选择底图（素材库）', 'diff-base', null, 'small ghost') + '</div>') + '</div>';
      if (d.mode === 'inpaint' && base) {
        // D1：遮罩涂抹（canvas 覆盖在底图上，白=重绘区）
        const ms = maskState();
        h += '<div class="mask-wrap" id="mask-wrap"><div class="mask-base" style="background:linear-gradient(135deg,hsl(' + base.hue + ',62%,64%),hsl(' + ((base.hue + 60) % 360) + ',48%,30%))"></div>' +
          '<canvas class="mask-canvas" id="mask-canvas"></canvas></div>' +
          '<div class="mask-toolbar">' +
          '<button class="icbtn" data-a="diff-mask-erase" title="' + (ms.erase ? '切回画笔' : '橡皮擦') + '" style="color:' + (ms.erase ? 'var(--primary)' : 'var(--on-surface-variant)') + '">' + icon('brush') + '</button>' +
          '<button class="icbtn" data-a="diff-mask-undo" title="撤销一笔">' + icon('undo') + '</button>' +
          '<button class="icbtn" data-a="diff-mask-clear" title="清空遮罩">' + icon('delete') + '</button>' +
          '<label class="slider-row" style="flex:1"><span class="li-title">画笔 ' + ms.brush + 'px</span>' +
          '<input type="range" min="8" max="72" step="2" value="' + ms.brush + '" class="slider" data-live="diff-brush"></label>' +
          '<span class="muted" style="font-size:11px;flex:none">' + ms.strokes.length + ' 笔</span></div>' +
          '<div class="field-cap">涂抹要重绘的区域（白色部分）；prompt 描述希望画成的内容。</div>';
      }
      h += '<label class="slider-row"><span class="li-title">重绘幅度 ' + d.denoise.toFixed(2) + '</span>' +
        '<input type="range" min="0.2" max="0.9" step="0.05" value="' + d.denoise + '" class="slider" data-live="diff-denoise"></label>' +
        '<div class="field-cap">数值越大改动越大；局部重绘只重新生成遮罩内的内容。</div>';
    }
    h += '<label class="slider-row"><span class="li-title">采样步数 ' + d.steps + '</span>' +
      '<input type="range" min="10" max="40" step="1" value="' + d.steps + '" class="slider" data-live="diff-steps"></label>' +
      '<div class="field-cap">步数越多细节越充分，耗时线性增加。</div>';
    h += '<div class="msg-row">' +
      '<input class="field-input" style="flex:1" data-keep="diff-prompt" placeholder="提示词（英文，逗号分隔）" value="' + esc(d.prompt) + '">' +
      '<button class="icbtn" data-a="diff-caption" title="从图片反推提示词">' + icon('zoom_in') + '</button>' +
      '<button class="icbtn" data-a="diff-prompt-lib" title="从提示词库选取">' + icon('bookmark') + '</button>' +
      '<button class="btn" style="min-height:48px;padding:0 18px" data-a="diff-gen">' + icon('auto_awesome') + '</button></div>' +
      '<div class="field-cap">描述想画的内容（英文，逗号分隔）；光标处的 tag 可用下方工具栏调整。</div>';
    // D8：tag 工具栏（光标处 tag 权重 / 删除 / 撤销重做）
    h += '<div class="tag-toolbar">' +
      '<button class="tbtn" data-a="tag-dec" title="权重 -0.1">权重−</button>' +
      '<button class="tbtn" data-a="tag-inc" title="权重 +0.1">权重＋</button>' +
      '<button class="tbtn" data-a="tag-del" title="删除光标处 tag">删除 tag</button>' +
      '<button class="icbtn" data-a="tag-undo" title="撤销">' + icon('undo') + '</button>' +
      '<button class="icbtn" data-a="tag-redo" title="重做">' + icon('redo') + '</button></div>';
    // D8：补全 chip 行（前缀 > 别名 > 包含，按使用次数排序，≤12 个）
    const sug = currentSuggestions();
    if (sug.length) {
      h += '<div class="suggest-row">' + sug.map(t =>
        '<button class="chip" data-a="tag-complete" data-arg="' + esc(t.tag) + '">' + esc(t.tag) + '<span class="sug-cn">' + esc(t.cn) + '</span></button>').join('') + '</div>';
    }
    // F9：负向提示词（可折叠）+ 批量/扫描（批量 chip 独立成行，避免拥挤被裁切）
    h += '<div class="msg-row" style="align-items:center">' +
      '<button class="icbtn" data-a="diff-neg-toggle" title="负向提示词" style="width:36px;height:36px;color:' + (S.x.diffNegOpen ? 'var(--primary)' : 'var(--on-surface-variant)') + '">' + icon('remove') + '</button>' +
      '<span class="muted" style="font-size:11px;flex:1">负向提示词' + (d.neg ? '（已设置）' : '') + '</span></div>' +
      '<div class="chip-row wrap" style="padding-top:0">' + [1, 2, 4].map(n => chip('×' + n, !(d.sweep && d.sweep.enabled) && (d.batch || 1) === n, 'diff-batch', n)).join('') +
      chip('扫描', !!(d.sweep && d.sweep.enabled), 'diff-sweep-open') + '</div>';
    if (S.x.diffNegOpen) {
      h += '<div class="msg-row"><input class="field-input" style="flex:1" data-keep="diff-neg" placeholder="负向提示词（如 lowres, bad anatomy）" value="' + esc(d.neg || '') + '"></div>' +
        '<div class="field-cap">描述不想出现的内容。</div>';
    }
    // D9 seed 锁 chip + D2 高清修复一键管线
    const seed = cfg.seed;
    h += '<div class="msg-row" style="align-items:center">' +
      '<button class="chip seed-chip' + (seed >= 0 ? ' on' : '') + '" data-a="diff-seed-lock" title="锁定种子后只改提示词，对比单变量效果">' +
      (seed >= 0 ? 'seed: ' + seed + ' 🔒' : 'seed: random 🔓') + '</button>' +
      '<span style="flex:1"></span>' +
      '<span class="muted" style="font-size:11px">高清修复（生成→放大×2→修复）</span>' + switchCtl(d.hires, 'diff-hires') + '</div>';
    h += '</div>';
    if (!wide && S.x.diffDrawer) h += diffDrawerHtml();
    return h + (wide ? '</div></div>' : '</div>');
  }

  // ---------- 生成历史（D6 扫描组卡 / D7 收藏独立） ----------
  function diffHistHtml() {
    const d = D();
    const kw = ((S.x.keep && S.x.keep['diff-hist-q']) || '').trim().toLowerCase();
    const list = kw ? d.history.filter(r => (r.prompt || '').toLowerCase().indexOf(kw) >= 0) : d.history;
    S.x.diffGroupOpen = S.x.diffGroupOpen || {};
    let items = '';
    let i = 0;
    while (i < list.length) {
      const r = list[i];
      // 同一次扫描（batchId 且 batchTotal>1）聚合为组卡
      if (r.batchId && r.batchTotal > 1) {
        const gid = r.batchId;
        const group = list.filter(x => x.batchId === gid);
        const open = !!S.x.diffGroupOpen[gid];
        items += '<div class="d-sess d-group' + (open ? ' on' : '') + '" data-a="diff-group" data-arg="' + gid + '">' +
          '<div class="d-thumb" style="background:linear-gradient(135deg,hsl(' + r.hue + ',62%,64%),hsl(' + ((r.hue + 60) % 360) + ',48%,30%))"></div>' +
          '<div class="d-body"><div class="d-title">扫描 · ' + group.length + ' 张' + (r.batchDesc ? '（' + esc(r.batchDesc) + '）' : '') + '</div>' +
          '<div class="d-sub">点击' + (open ? '收起' : '展开') + '</div></div>' + icon(open ? 'expand_less' : 'expand_more') + '</div>';
        if (open) {
          group.forEach(g => { items += histRow(g, d, true); });
        }
        i += group.length;
      } else {
        items += histRow(r, d, false);
        i++;
      }
    }
    return '<div class="d-head"><span>生成历史</span><span class="muted small">' + d.history.length + ' 张</span></div>' +
      '<div style="padding:0 12px 10px"><div class="search-box">' + icon('search') +
      '<input class="field-input" data-keep="diff-hist-q" placeholder="搜索提示词…" value="' + esc((S.x.keep && S.x.keep['diff-hist-q']) || '') + '"></div></div>' +
      '<div style="padding:0 12px 10px">' + btn('＋ 新建生成', 'diff-new', null, 'small block ghost') + '</div>' +
      '<div class="d-list">' + (items || '<div class="muted small center" style="padding:24px 0">' + (kw ? '没有匹配的记录' : '暂无生成记录') + '</div>') + '</div>' +
      '<div class="d-foot" data-a="diff-settings">' + icon('settings') + '<span>生成设置</span></div>';
  }
  function histRow(r, d, inGroup) {
    return '<div class="d-sess' + (d.curId === r.id ? ' on' : '') + '" data-a="diff-hist" data-arg="' + r.id + '">' +
      '<div class="d-thumb" style="background:linear-gradient(135deg,hsl(' + r.hue + ',62%,64%),hsl(' + ((r.hue + 60) % 360) + ',48%,30%))"></div>' +
      '<div class="d-body"><div class="d-title">' + esc(r.prompt || '（无提示词）') + '</div>' +
      '<div class="d-sub">' + esc(r.info) + '</div></div>' +
      (r.fav ? '<span class="fav-mark">' + icon('favorite') + '</span>' : '') +
      '<button class="d-del" data-a="diff-hist-del" data-arg="' + r.id + '" title="删除">' + icon('close') + '</button></div>';
  }
  // 侧边抽屉（窄屏）：mask 包裹历史主体
  function diffDrawerHtml() {
    return '<div class="drawer-mask" data-a="diff-drawer-close"><div class="drawer" data-a="drawer-body">' +
      diffHistHtml() + '</div></div>';
  }
  action('diff-menu', () => { S.x.diffDrawer = true; render(); });
  action('diff-drawer-close', () => { S.x.diffDrawer = false; render(); });
  action('diff-new', () => { D().curId = null; S.x.diffDrawer = false; render(); });
  action('diff-hist', ds => { D().curId = ds.arg; S.x.diffDrawer = false; render(); });
  action('diff-group', ds => {
    S.x.diffGroupOpen = S.x.diffGroupOpen || {};
    S.x.diffGroupOpen[ds.arg] = !S.x.diffGroupOpen[ds.arg];
    render();
  });
  action('diff-fav', ds => {
    const r = D().history.find(x => x.id === ds.arg);
    if (r) { r.fav = !r.fav; render(); }
  });
  // I2 轻删走 toast 撤销；收藏的生成记录为重删（防误删）需二次确认
  action('diff-hist-del', ds => {
    const d = D();
    const r = d.history.find(x => x.id === ds.arg);
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
  action('diff-hist-undo', ds => {
    const dct = JSON.parse(ds.arg);
    D().history.splice(Math.min(dct.idx, D().history.length), 0, dct.r);
    render();
  });
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
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) +
          (isSdxl(m) ? ' <span class="achip cap">宽高比</span>' : '') + '</div>' +
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

  // Swap flow 语义：换模式保留提示词/参数/底图，不保留遮罩（nightmare 同款）
  action('diff-mode', ds => {
    const d = D();
    if (d.mode === ds.arg) return;
    d.mode = ds.arg;
    d.mask = null; // 遮罩不随模式迁移
    render();
  });
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
  action('diff-pick-base', ds => { D().baseId = ds.arg; D().mask = null; closeDialog(); render(); });
  action('diff-base-clear', () => { D().baseId = null; D().mask = null; render(); });
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
  action('diff-neg-toggle', () => { S.x.diffNegOpen = !S.x.diffNegOpen; render(); });
  action('diff-batch', ds => { D().batch = +ds.arg; D().sweep = null; render(); });
  action('diff-hires', () => { D().hires = !D().hires; render(); });
  action('diff-seed-lock', () => {
    const cfg = diffCfgOf(D().modelId || DIFF_MODELS[0].id);
    // 锁定：写入一个确定种子（-1 随机时取一个新的随机数）；再点回到随机
    cfg.seed = cfg.seed >= 0 ? -1 : Math.floor(Math.random() * 1000000000);
    render();
  });
  action('diff-brush', (ds, el) => {
    maskState().brush = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = '画笔 ' + el.value + 'px';
  });
  action('diff-mask-erase', () => { maskState().erase = !maskState().erase; render(); });
  action('diff-mask-undo', () => { const ms = maskState(); ms.strokes.pop(); render(); });
  action('diff-mask-clear', () => { maskState().strokes = []; render(); });
  action('diff-retry', () => { D().lastError = null; startGen(); });
  action('diff-err-close', () => { D().lastError = null; render(); });
  action('diff-stop-after', () => {
    const d = D();
    if (d.sweep && d.sweep.enabled && d.sweep.stopAfter == null) {
      d.sweep.stopAfter = d.sweep.produced == null ? 1 : d.sweep.produced + 1;
      toast('将在本张完成后停止（保留 ' + d.sweep.stopAfter + ' 张）');
      render();
    }
  });

  // ---------- 生成（简单批量 / 扫描共用一条驱动） ----------
  action('diff-gen', startGen);
  function startGen() {
    const d = D();
    if (!d.modelId) { toast('请先选择并下载生图模型'); return; }
    if ((d.mode === 'img' || d.mode === 'inpaint') && !d.baseId) { toast('请先从素材库选择底图'); return; }
    if (d.mode === 'inpaint' && !maskState().strokes.length) { toast('请在底图上涂抹需要重绘的区域'); return; }
    d.lastError = null; d.curId = null;
    d.prompt = (S.x.keep && S.x.keep['diff-prompt']) || d.prompt;
    d.neg = (S.x.keep && S.x.keep['diff-neg']) || d.neg || '';
    const cfg = diffCfgOf(d.modelId);
    const plan = buildPlan(d, cfg);
    if (!plan) return;
    // 换载成本提示（LLM 与扩散内存互斥，生成前卸载 LLM 的演示）
    const llmLoaded = ((S.x.ai && S.x.ai.llm && S.x.ai.llm.sessions) || []).filter(s => s.loaded);
    if (llmLoaded.length) {
      llmLoaded.forEach(s => { s.loaded = false; });
      d.evictNote = '已卸载 LLM 释放内存（约 1.8 GB） · RAM 4.9/11.7 GB 空闲';
    } else {
      d.evictNote = 'RAM 4.9/11.7 GB 空闲';
    }
    const label = plan.sweep ? '参数扫描（' + plan.total + ' 张）' :
      (d.mode === 'img' ? '图生图' : d.mode === 'inpaint' ? '局部重绘' : '文生图');
    const phases = d.hires ? ['编码提示词', '去噪 ' + d.steps + ' 步', '解码', '放大 ×2', 'UltraFix 分块修复'] :
      (d.mode === 'txt' ? ['编码提示词', '去噪 ' + d.steps + ' 步', '解码'] : ['编码提示词', 'VAE 编码底图', '去噪 ' + d.steps + ' 步', '解码']);
    mock.startJob('diff-gen', label, plan.total * (d.hires ? 1900 : 1100), plan.sweep ? null : phases);
    d.sweep && (d.sweep.produced = 0);
    let k = 0;
    const t = setInterval(() => {
      const job = mock.job('diff-gen');
      if (!job) { clearInterval(t); return; } // 被取消
      if (d.debugFail && job.p > 0.55) {
        d.debugFail = false;
        mock.resetJob('diff-gen');
        d.lastError = { phase: '去噪', reason: 'bad_alloc：OpenCL 内存不足（bad_alloc）', hint: '建议：开启低内存模式、换 CPU 引擎，或降低输出尺寸。' };
        clearInterval(t); render(); return;
      }
      // 逐张产出（按时间进度推进到第 k 张）
      while (k < plan.total && job.p >= (k + 1) / plan.total) {
        produce(d, plan, k); k++;
        if (d.sweep && d.sweep.enabled) d.sweep.produced = k;
      }
      if (plan.sweep) job.phase = '扫描 ' + Math.min(k + 1, plan.total) + '/' + plan.total + ' · 去噪 ' + d.steps + ' 步';
      const stopAfter = d.sweep && d.sweep.enabled ? d.sweep.stopAfter : null;
      if (stopAfter != null && k >= stopAfter) {
        S.x.jobs['diff-gen'].done = true; // 提前结束：保留已产出的张数
        clearInterval(t); render(); return;
      }
      if (job.done || k >= plan.total) {
        S.x.jobs['diff-gen'].done = true;
        clearInterval(t); render();
      } else {
        render();
      }
    }, 300);
    render();
  }
  action('diff-cancel', () => { mock.resetJob('diff-gen'); render(); });

  function buildPlan(d, cfg) {
    // 扫描：d.sweep.items 已由扫描弹层解析好；简单批量：同一参数 × n（种子递增）
    if (d.sweep && d.sweep.enabled) {
      if (!d.sweep.items || !d.sweep.items.length) { toast('扫描没有有效参数组合'); return null; }
      d.sweep.stopAfter = null; d.sweep.produced = 0;
      return { sweep: true, items: d.sweep.items, total: d.sweep.items.length, batchId: 'b' + Date.now(), batchDesc: d.sweep.desc };
    }
    const n = d.batch || 1;
    const items = [];
    for (let k = 0; k < n; k++) {
      items.push({ seed: cfg.seed < 0 ? -1 : cfg.seed + k, steps: d.steps, cfg: cfg.cfg, denoise: d.denoise, sampler: cfg.sampler, size: cfg.size, ar: cfg.ar });
    }
    return { sweep: false, items, total: n, batchId: n > 1 ? 'b' + Date.now() : null, batchDesc: '批量 ×' + n };
  }

  function produce(d, plan, k) {
    const it = plan.items[k];
    const dims = dimsOf(it.size, it.ar);
    const r = {
      id: 'g' + Date.now() + '_' + k + '_' + Math.floor(Math.random() * 999),
      hue: DIFF_HUES[d.history.length % DIFF_HUES.length],
      mode: d.mode, prompt: d.prompt, neg: d.neg,
      info: (d.mode === 'img' ? '图生图 · 重绘 ' + it.denoise.toFixed(2) + ' · ' :
        d.mode === 'inpaint' ? '局部重绘 · ' + it.denoise.toFixed(2) + ' · ' : '') +
        dims.w + '×' + dims.h + (it.ar && it.ar !== '1:1' ? '（' + it.ar + '）' : '') +
        ' · ' + it.sampler + ' · CFG ' + it.cfg + ' · ' + it.steps + ' 步' +
        (it.seed < 0 ? ' · 随机' : ' · 种子 ' + it.seed) +
        (d.hires ? ' · 高清修复' : ''),
      timing: d.hires ? '准备 0.4s · 编码 0.6s · 去噪 3.2s · 解码 0.3s · 放大 0.8s · 修复 2.6s'
        : '准备 0.4s · 编码 0.6s · 去噪 3.2s · 解码 0.3s · 合计 4.5s',
      fav: false,
      params: { modelId: d.modelId, mode: d.mode, prompt: d.prompt, neg: d.neg, steps: it.steps, denoise: it.denoise, sampler: it.sampler, cfg: it.cfg, seed: it.seed, size: it.size, ar: it.ar, hires: d.hires, baseId: d.baseId },
      batchId: plan.batchId, batchTotal: plan.total, batchDesc: plan.batchDesc
    };
    d.history.unshift(r);
    d.curId = r.id;
  }

  action('diff-save-asset', () => {
    const d = D();
    const r = d.history.find(x => x.id === d.curId);
    if (!r) return;
    // F10：AI 生成的素材带 from 标记，素材详情可追溯来源
    S.x.assets.unshift({ id: 'as' + Date.now(), kind: 'image', hue: r.hue, label: '生图·' + (r.mode === 'img' ? '图生图' : r.mode === 'inpaint' ? '局部重绘' : '文生图'), date: '2026-09-18', from: 'ai', prompt: r.prompt });
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
  // D7：结果即流程——参数完整回填（模板）/ 原样重跑
  function loadParams(r) {
    const d = D();
    const p = r.params;
    d.modelId = p.modelId; d.mode = p.mode; d.prompt = p.prompt; d.neg = p.neg;
    d.steps = p.steps; d.denoise = p.denoise; d.baseId = p.baseId; d.hires = !!p.hires;
    d.curId = null; d.lastError = null;
    keepSet('diff-prompt', p.prompt);
    keepSet('diff-neg', p.neg);
    const cfg = diffCfgOf(p.modelId);
    cfg.sampler = p.sampler; cfg.cfg = p.cfg; cfg.seed = p.seed; cfg.size = p.size; cfg.ar = p.ar;
  }
  action('diff-as-template', ds => {
    const r = D().history.find(x => x.id === ds.arg);
    if (!r || !r.params) return;
    loadParams(r);
    toast('已载入完整参数（未生成，可继续修改）');
    render();
  });
  action('diff-rerun', ds => {
    const r = D().history.find(x => x.id === ds.arg);
    if (!r || !r.params) return;
    loadParams(r);
    startGen();
  });

  // ---------- D8 提示词库选取 / tag 工具栏 / 补全 / 图片反推 ----------
  action('diff-prompt-lib', () => {
    const cats = ['全部', '人物', '场景', '风格', '负面', '收藏'];
    const cur = S.x.plibCat || '全部';
    const list = DB.PROMPTS.filter(p => cur === '全部' || (cur === '收藏' ? p.fav : p.cat === cur));
    showDialog({
      title: '从提示词库选取',
      body: '<div class="chip-row" style="padding-top:0">' + cats.map(c => chip(c, cur === c, 'plib-cat', c)).join('') + '</div>' +
        list.map(p => '<div class="li" data-a="plib-use" data-arg="' + p.id + '"><div class="li-body">' +
          '<div class="li-title" style="font-weight:400">' + esc(p.title) + (p.fav ? ' ★' : '') + '</div>' +
          '<div class="li-sub" style="white-space:normal">' + esc(p.text) + '</div></div>' +
          '<span class="achip">' + esc(p.cat) + '</span></div>').join('') +
        (list.length ? '' : emptyHint('该分类暂无条目')),
      actions: [{ label: '取消' }]
    });
  });
  action('plib-cat', ds => { S.x.plibCat = ds.arg; closeDialog(); ACTIONS['diff-prompt-lib'](); });
  action('plib-use', ds => {
    const p = DB.PROMPTS.find(x => x.id === ds.arg);
    if (!p) return;
    keepSet('diff-prompt', p.text);
    D().prompt = p.text;
    closeDialog();
    toast('已填入提示词');
    render();
  });

  // tag 工具栏：定位光标处 tag（逗号/换行/括号分隔），权重壳支持 (tag:w)、((tag))、[tag]
  function promptEl() { return document.querySelector('[data-keep="diff-prompt"]'); }
  function tagRangeAt(text, pos) {
    // 找 pos 所在的逗号分段（光标在空槽位时作用于前一个刚打完的 tag）
    let start = pos, end = pos;
    const isSep = c => c === ',' || c === '，' || c === '\n';
    while (start > 0 && !isSep(text[start - 1])) start--;
    while (end < text.length && !isSep(text[end])) end++;
    return { start, end, text: text.slice(start, end) };
  }
  function adjustWeight(text, range, delta) {
    let seg = range.text;
    const lead = seg.match(/^\s*/)[0];
    const core = seg.trim();
    // 解析权重壳：(tag:w) / ((tag)) / [tag]
    let m = core.match(/^\(\s*(.*?)\s*:?\s*([\d.]+)?\s*\)$/);
    if (m && m[2] != null) {
      const w = Math.max(0.1, Math.round((parseFloat(m[2]) + delta) * 100) / 100);
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    if (m) { // (tag) 无显式权重，视为 1.0；先转为 :w 形式
      const w = Math.max(0.1, Math.round((1 + delta) * 100) / 100);
      if (w === 1) return { text: text.slice(0, range.start) + lead + '(' + m[1] + ')' + text.slice(range.end), pos: range.end };
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    m = core.match(/^\[\s*(.*?)\s*\]$/);
    if (m) { // [tag] = 0.9
      const w = Math.max(0.1, Math.round((0.9 + delta) * 100) / 100);
      const body = '(' + m[1] + ':' + w.toFixed(1) + ')';
      return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
    }
    // 裸 tag：权重 1.0，加减后包壳；回到 1.0 时脱壳
    const w = Math.max(0.1, Math.round((1 + delta) * 100) / 100);
    const body = w === 1 ? core : '(' + core + ':' + w.toFixed(1) + ')';
    return { text: text.slice(0, range.start) + lead + body + text.slice(range.end), pos: range.start + lead.length + body.length };
  }
  function pushUndo(text) {
    const d = D();
    d.tagUndo = d.tagUndo || [];
    d.tagUndo.push(text);
    if (d.tagUndo.length > 100) d.tagUndo.shift();
    d.tagRedo = [];
  }
  function currentPromptText() {
    const el = promptEl();
    return el ? el.value : ((S.x.keep && S.x.keep['diff-prompt']) || D().prompt || '');
  }
  function applyPromptText(text, pos) {
    keepSet('diff-prompt', text);
    D().prompt = text;
    render();
    setTimeout(() => {
      const el = promptEl();
      if (el && pos != null) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } }
    }, 0);
  }
  function tagEdit(delta) {
    const text = currentPromptText();
    const el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    if (!range.text.trim()) { toast('光标处没有可调整的 tag'); return; }
    pushUndo(text);
    const out = adjustWeight(text, range, delta);
    applyPromptText(out.text, out.pos);
  }
  action('tag-dec', () => tagEdit(-0.1));
  action('tag-inc', () => tagEdit(0.1));
  action('tag-del', () => {
    const text = currentPromptText();
    const el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    if (!range.text.trim()) { toast('光标处没有可删除的 tag'); return; }
    pushUndo(text);
    // 连一个相邻逗号一起删除，并清理多余分隔
    let start = range.start, end = range.end;
    if (text[end] === ',' || text[end] === '，') end++;
    else if (start > 0 && (text[start - 1] === ',' || text[start - 1] === '，')) start--;
    const next = (text.slice(0, start) + text.slice(end)).replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').replace(/,\s*$/, '');
    applyPromptText(next, Math.min(start, next.length));
  });
  action('tag-undo', () => {
    const d = D();
    if (!d.tagUndo || !d.tagUndo.length) { toast('没有可撤销的编辑'); return; }
    const cur = currentPromptText();
    d.tagRedo = d.tagRedo || [];
    d.tagRedo.push(cur);
    applyPromptText(d.tagUndo.pop(), null);
  });
  action('tag-redo', () => {
    const d = D();
    if (!d.tagRedo || !d.tagRedo.length) { toast('没有可重做的编辑'); return; }
    d.tagUndo = d.tagUndo || [];
    d.tagUndo.push(currentPromptText());
    applyPromptText(d.tagRedo.pop(), null);
  });

  // 输入即补全：光标处片段 ≥2 字符时给候选（前缀 > 包含 > 翻译，按使用次数降序，≤12 个）
  let lastSuggestKey = '';
  function currentSuggestions() {
    const text = currentPromptText();
    const el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    const raw = range.text.trim().replace(/^[(\[]+/, '').replace(/[\])]+$/, '');
    const frag = raw.toLowerCase();
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
    return prefix.concat(contains, alias).filter(t => {
      if (seen.has(t.tag)) return false;
      seen.add(t.tag); return true;
    }).slice(0, 12);
  }
  document.addEventListener('input', e => {
    if (!e.target.dataset) return;
    // 草稿写穿：输入与程序化重渲染共用同一状态，避免提示词被模板值回滚
    if (e.target.dataset.keep === 'diff-prompt') {
      D().prompt = e.target.value;
      const key = e.target.value + '|' + e.target.selectionStart;
      if (key !== lastSuggestKey) { lastSuggestKey = key; render(); }
    } else if (e.target.dataset.keep === 'diff-neg') {
      D().neg = e.target.value;
    }
  });
  action('tag-complete', ds => {
    const text = currentPromptText();
    const el = promptEl();
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const range = tagRangeAt(text, pos);
    pushUndo(text);
    const tag = ds.arg;
    const next = text.slice(0, range.start) + tag + ', ' + text.slice(range.end);
    applyPromptText(next, range.start + tag.length + 2);
  });

  // 图片反推：选择素材图 → 模拟反推任务（入队）→ 三档结果 + 一键填入
  action('diff-caption', () => {
    const imgs = (S.x.assets || []).filter(a => a.kind === 'image');
    showDialog({
      title: '从图片反推提示词',
      body: '<div class="muted small" style="padding-bottom:6px">图片仅在本机分析，不会上传。选择反推方式：</div>' +
        (imgs.length ? '<div class="pick-grid">' + imgs.map(a =>
          '<div class="pick-cell" data-a="diff-caption-img" data-arg="' + a.id + '" title="' + esc(a.label) + '" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))"></div>').join('') + '</div>'
          : emptyHint('素材库暂无图片，请先到素材页导入')),
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
          body: '<div class="chip-row" style="padding-top:0">' +
            [['tags', '标签'], ['short', '短句'], ['detailed', '详细']].map(x => chip(x[1], mode === x[0], 'caption-mode', x[0])).join('') + '</div>' +
            '<div class="caption-result">' + esc(DB.CAPTION_DEMO[mode]) + '</div>',
          actions: [
            { label: '关闭' },
            {
              label: '填入提示词', style: 'filled', run: () => {
                keepSet('diff-prompt', DB.CAPTION_DEMO[mode]);
                D().prompt = DB.CAPTION_DEMO[mode];
                toast('已填入反推结果');
                render();
              }
            }
          ]
        });
      }
    }, 300);
    render();
  });
  action('caption-mode', ds => {
    S.x.captionMode = ds.arg;
    // 对话框保持打开，原位切换三档结果（不重跑反推任务）
    const d = S.dialog;
    if (d) {
      d.body = '<div class="chip-row" style="padding-top:0">' +
        [['tags', '标签'], ['short', '短句'], ['detailed', '详细']].map(x => chip(x[1], S.x.captionMode === x[0], 'caption-mode', x[0])).join('') + '</div>' +
        '<div class="caption-result">' + esc(DB.CAPTION_DEMO[S.x.captionMode]) + '</div>';
      render();
    }
  });

  // ---------- D6 参数扫描弹层（轴 + 值语法 + 第二轴 + 预计张数） ----------
  const SWEEP_PARAMS = [['seed', '种子'], ['steps', '步数'], ['cfg', 'CFG'], ['denoise', '重绘幅度'], ['sampler', '采样器']];
  action('diff-sweep-open', () => {
    const d = D();
    d.sweep = d.sweep || { a1: 'seed', a2: 'none', enabled: false, samplers1: [], samplers2: [] };
    const sw = d.sweep;
    showDialog({
      title: '参数扫描（sweep）',
      body: sweepBody(sw),
      actions: [
        { label: '简单批量（不扫描）', run: () => { D().sweep = null; render(); } },
        { label: '开始扫描', style: 'filled', keep: true, run: startSweep }
      ]
    });
  });
  function sweepBody(sw) {
    const axisRow = (key, val, act, allowNone) => '<div class="muted small" style="margin-top:8px">' + key + '</div><div class="chip-row" style="padding-top:4px">' +
      (allowNone ? [['none', '无']] : []).concat(SWEEP_PARAMS).map(p => chip(p[1], val === p[0], act, p[0])).join('') + '</div>';
    const valInput = (id, a) => a === 'sampler'
      ? '<div class="chip-row" style="padding-top:4px">' + SAMPLERS.map(s => chip(s, (sw['samplers' + id.slice(-1)] || []).includes(s), 'sw-sampler', id + ':' + s)).join('') + '</div>'
      : '<input class="field-input" data-keep="' + id + '" placeholder="' + sweepHint(a) + '" value="' + esc((S.x.keep && S.x.keep[id]) || '') + '">';
    return '<div class="muted small">每张图改变一个（或两个）参数，逐张生成；结果在历史里聚合为一组。</div>' +
      axisRow('轴 1', sw.a1, 'sw-a1', false) + valInput('sw-v1', sw.a1) +
      axisRow('轴 2（可选）', sw.a2, 'sw-a2', true) + (sw.a2 !== 'none' ? valInput('sw-v2', sw.a2) : '') +
      '<div class="dl-status" style="margin-top:8px">' + sweepEstimate(sw) + '</div>';
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
    if (a === 'sampler') {
      const arr = sw['samplers' + n] || [];
      return arr.length ? { param: a, values: arr } : { param: a, values: null };
    }
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
    const d = D();
    const sw = d.sweep;
    const a1 = axisOf(sw, 1), a2 = axisOf(sw, 2);
    const est = sweepEstimate(sw);
    if (est.indexOf('预计') !== 0) { toast(est); return; }
    const cfg = diffCfgOf(d.modelId || DIFF_MODELS[0].id);
    const base = { seed: cfg.seed, steps: d.steps, cfg: cfg.cfg, denoise: d.denoise, sampler: cfg.sampler, size: cfg.size, ar: cfg.ar };
    const items = [];
    for (const v1 of a1.values) {
      for (const v2 of (a2 && a2.values ? a2.values : [null])) {
        const it = Object.assign({}, base);
        it[a1.param] = v1;
        if (a2 && a2.param) it[a2.param] = v2;
        if (a1.param === 'seed' && base.seed < 0) it.seed = v1;
        items.push(it);
      }
    }
    const labelOf = p => (SWEEP_PARAMS.find(x => x[0] === p) || [p, p])[1];
    d.sweep.enabled = true;
    d.sweep.items = items;
    d.sweep.desc = a1.param + '=' + a1.values.join('/') + (a2 && a2.param ? ' × ' + a2.param + '=' + a2.values.join('/') : '');
    closeDialog();
    toast('扫描已设定：' + items.length + ' 张，点生成开始');
    render();
  }
  action('sw-a1', ds => { D().sweep.a1 = ds.arg; closeDialog(); ACTIONS['diff-sweep-open'](); });
  action('sw-a2', ds => { D().sweep.a2 = ds.arg; closeDialog(); ACTIONS['diff-sweep-open'](); });
  action('sw-sampler', ds => {
    const [which, val] = ds.arg.split(':');
    const d = D();
    const key = 'samplers' + which.slice(-1);
    const arr = d.sweep[key] = d.sweep[key] || [];
    const i = arr.indexOf(val);
    if (i >= 0) arr.splice(i, 1); else arr.push(val);
    closeDialog(); ACTIONS['diff-sweep-open']();
  });
  // 弹层内输入变化时刷新预计张数（保持对话框打开）
  document.addEventListener('input', e => {
    if (!e.target.dataset || (e.target.dataset.keep !== 'sw-v1' && e.target.dataset.keep !== 'sw-v2')) return;
    const d = S.dialog;
    if (d && d.title && d.title.indexOf('参数扫描') === 0) {
      d.body = sweepBody(D().sweep);
      render();
    }
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
        SAMPLERS.map(s => chip(s, cfg.sampler === s, 'dc-sampler', s)).join('') + '</div>' +
        '<div class="field-cap">LCM 适合 4-8 步快速出图；Karras 噪声表细节更稳；SDE 系更慢但更细腻。</div>' +
        '<label class="slider-row"><span class="li-title">CFG 强度 ' + cfg.cfg.toFixed(1) + '</span>' +
        '<input type="range" min="1" max="20" step="0.5" value="' + cfg.cfg + '" class="slider" data-live="dc-set"></label>' +
        '<div class="field-cap">越高越贴近提示词，过高易过曝。</div>' +
        '<label class="field"><span class="field-label">种子（-1 为随机；生图页可一键锁定上一张）</span>' +
        '<input class="field-input" type="number" value="' + cfg.seed + '" data-live="dc-seed"></label>' +
        '<div class="muted small" style="padding-top:6px">输出尺寸</div><div class="chip-row" style="padding-top:4px">' +
        [512, 768, 1024].map(z => chip(z + '×' + z, cfg.size === z, 'dc-size', z)).join('') + '</div>' +
        (isSdxl(m) ?
          '<div class="muted small" style="padding-top:6px">宽高比（SDXL / Anima 专有）</div><div class="chip-row" style="padding-top:4px">' +
          ['1:1', '4:3', '3:4', '16:9', '9:16'].map(a => chip(a, cfg.ar === a, 'dc-ar', a)).join('') + '</div>' : '') +
        // D4：过程预览帧开关（ultrafix 自动禁用，见 native 语义）
        '<div class="li" style="padding-left:0"><div class="li-body"><div class="li-title">过程预览帧</div>' +
        '<div class="li-sub">生成中每 2 步更新一次预览；高清修复时自动关闭</div></div>' + switchCtl(cfg.preview, 'dc-preview') + '</div>' +
        // D2：高清修复分块（SD1.5 可编辑；SDXL 固定 1024）
        '<div class="muted small" style="padding-top:6px">高清修复分块（UltraFix tile）</div>' +
        (isSdxl(m) ? '<div class="li-sub" style="padding-top:4px">固定 1024（SDXL 管线限定）</div>'
          : '<div class="chip-row" style="padding-top:4px">' + [384, 512, 768].map(z => chip(z + 'px', cfg.hiresTile === z, 'dc-tile', z)).join('') + '</div>'));
      h += '<div style="margin-top:12px;display:flex;gap:8px">' +
        btn('恢复默认', 'dc-reset', null, 'ghost') + btn('完成', 'dc-done', null, 'flex') + '</div>';
      h += '<div class="muted small center" style="padding:12px">生成设置按模型独立保存。</div>';
      // D9：错误态演示入口（验证「失败阶段 + 原因 + 建议」的错误卡）
      h += '<div style="margin-top:4px">' + textBtn('调试：模拟下次生成失败（bad_alloc）', 'dc-debug-fail', null, 'ghost') + '</div>';
      return h;
    }
  });
  action('dc-sampler', ds => { diffCfgOf(S.x.dcId).sampler = ds.arg; render(); });
  action('dc-set', (ds, el) => {
    diffCfgOf(S.x.dcId).cfg = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = 'CFG 强度 ' + (+el.value).toFixed(1);
  });
  action('dc-seed', ds => { diffCfgOf(S.x.dcId).seed = +el.value; });
  action('dc-size', ds => { diffCfgOf(S.x.dcId).size = +ds.arg; render(); });
  action('dc-ar', ds => { diffCfgOf(S.x.dcId).ar = ds.arg; render(); });
  action('dc-preview', () => { diffCfgOf(S.x.dcId).preview = !diffCfgOf(S.x.dcId).preview; render(); });
  action('dc-tile', ds => { diffCfgOf(S.x.dcId).hiresTile = +ds.arg; render(); });
  action('dc-debug-fail', () => { D().debugFail = true; toast('下次生成将在去噪阶段失败（演示错误卡）'); nav.pop(); });
  action('dc-reset', () => { S.x.diffCfg[S.x.dcId] = Object.assign({}, DIFF_DEF); render(); });
  action('dc-done', () => nav.pop());

  // ---------- D1：遮罩 canvas 初始化与涂抹（pointer 事件直接画，不走全量 render） ----------
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
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = s.size;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.pts[0][0] * w, s.pts[0][1] * h);
        for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] * w, s.pts[i][1] * h);
        if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.01, s.pts[0][1] * h);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    c.__redraw = redraw;
    function pt(e) {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    }
    let drawing = false, cur = null;
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件或旧设备无有效 pointerId 时忽略 */ }
      drawing = true;
      const ms = maskState();
      cur = { pts: [pt(e)], size: ms.brush, erase: ms.erase };
      ms.strokes.push(cur);
      redraw();
    });
    c.addEventListener('pointermove', e => {
      if (!drawing) return;
      cur.pts.push(pt(e));
      redraw();
    });
    const up = () => { drawing = false; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    redraw();
  }
  // 页面重渲染会销毁并重建 canvas，低频巡检负责初始化与尺寸变化重绘
  setInterval(() => {
    const c = document.getElementById('mask-canvas');
    if (!c) return;
    if (!c.__init) initMaskCanvas(c);
    if (c.__redraw && (c.width !== c.clientWidth || c.height !== c.clientHeight)) c.__redraw();
  }, 400);
})();
