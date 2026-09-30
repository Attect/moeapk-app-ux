// 素材 Tab：素材网格 + 相册式查看器（按素材类型呈现不同舞台与工具栏）
// 素材类型：image / video / audio / pointcloud（3D 点云是图片的处理产物，作为素材存在）。
// 点云素材查看：姿态感应（倾斜演示 + 自动摇摆）与查看/渲染性能面板，默认收起。
(function () {
  const assets = () => S.x.assets;
  const cur = () => assets().find(a => a.id === S.x.viewId) || assets()[0];

  const KIND_LABEL = { image: '图片', video: '视频', audio: '音频', pointcloud: '3D 点云' };

  // ---------- 素材网格（F5 排序/视图切换；F6 长按或"多选"进入批量，可批量删除/导入） ----------
  const SORTS = { time: '按时间', name: '按名称' };
  function sortedAssets() {
    const list = assets().slice();
    if (S.x.asSort === 'name') list.sort((x, y) => x.label.localeCompare(y.label, 'zh'));
    else list.sort((x, y) => (y.date || '').localeCompare(x.date || '')); // time 默认
    return list;
  }
  // 第四轮：网格不叠任何文字（名称/类型遮挡图片、互相看不清）。
  // 类型只用左上角小角标图标区分；视频时长保留角标（信息必要且小）。
  // 点云素材显示生成时保存的预览图（原图 1/4 缩放）；无预览图 → 中性占位符。
  function gridCell(a, sel, batch) {
    let inner = '', bg = 'linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))';
    const corner = (ic) => '<span style="position:absolute;left:6px;top:6px;width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;color:#fff">' + icon(ic) + '</span>';
    if (a.kind === 'video') inner =
      corner('play_arrow') +
      '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff">' + icon('play_arrow') + '</span></span>' +
      '<span style="position:absolute;right:6px;bottom:4px;font-size:10px;color:#fff;background:rgba(0,0,0,.4);border-radius:4px;padding:1px 5px">' + esc(a.meta || '0:12') + '</span>';
    else if (a.kind === 'audio') inner = corner('music_note') +
      '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9)">' + icon('play_arrow') + '</span>';
    else if (a.kind === 'pointcloud') {
      if (a.preview) {
        // 有预览图：显示预览图（模拟为源图色调底 + 淡化点云标记）；App 侧为原图 1/4 缩放的真实缩略图
        inner = corner('apps') +
          '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55)">' + icon('apps') + '</span>';
      } else {
        // 无预览图：中性占位符
        bg = 'var(--surface-variant)';
        inner = '<span style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--outline)">' + icon('apps') + '</span>';
      }
    }
    const check = batch && sel[a.id] ? '<span class="as-check">' + icon('check_circle') + '</span>' : '';
    return '<div class="as-cell' + (batch && sel[a.id] ? ' selected' : '') + '" data-a="av-open" data-arg="' + a.id + '" style="background:' + bg + '">' + inner + check + '</div>';
  }
  function listRow(a, sel, batch) {
    const check = batch && sel[a.id] ? '<span class="as-check">' + icon('check_circle') + '</span>' : '';
    const kindChip = '<span class="achip" style="font-size:10px">' + KIND_LABEL[a.kind] + '</span>';
    return '<div class="as-row' + (batch && sel[a.id] ? ' selected' : '') + '" data-a="av-open" data-arg="' + a.id + '">' +
      '<div class="as-thumb" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))">' + check + '</div>' +
      '<div class="li-body"><div class="li-title" style="font-weight:400">' + esc(a.label) + '</div>' +
      '<div class="li-sub">' + esc(a.date || '') + ' · ' + KIND_LABEL[a.kind] + '</div></div>' + kindChip + '</div>';
  }
  registerScreen('tab:assets', {
    title: '素材',
    render() {
      const sel = S.x.asSel = S.x.asSel || {};
      const batch = S.x.asBatch;
      const view = S.x.asView || 'grid';
      const list = sortedAssets();
      const n = Object.keys(sel).filter(k => sel[k]).length;

      // F5：工具行（视图切换 + 排序 + 进入多选）
      let tools = '<div class="as-tools">' +
        '<div class="chip-row">' +
        chip('时间', (S.x.asSort || 'time') === 'time', 'as-sort', 'time') +
        chip('名称', S.x.asSort === 'name', 'as-sort', 'name') + '</div>' +
        '<button class="icbtn" data-a="as-view" title="切换视图" style="width:40px;height:40px">' + icon(view === 'grid' ? 'view_list' : 'view_module') + '</button>' +
        (!batch ? '<button class="icbtn" data-a="as-batch-on" title="多选" style="width:40px;height:40px">' + icon('playlist_add') + '</button>' : '') +
        '</div>';

      let body = '';
      if (view === 'grid') {
        body = '<div class="as-grid">' +
          '<div class="as-cell as-add" data-a="' + (batch ? 'as-batch-off' : 'as-import') + '">' + icon(batch ? 'close' : 'add') + '<span>' + (batch ? '退出多选' : '导入素材') + '</span></div>' +
          list.map(a => gridCell(a, sel, batch)).join('') + '</div>';
      } else {
        body = '<div class="as-list">' + list.map(a => listRow(a, sel, batch)).join('') + '</div>';
        if (!batch) body = '<div style="margin-top:10px">' + btn('＋ 导入素材', 'as-import', null, 'small ghost block') + '</div>' + body;
      }

      let bar = '';
      if (batch) {
        bar = '<div class="batch-bar">' +
          '<span class="li-sub" style="flex:1">已选 ' + n + ' 项</span>' +
          btn('全选', 'as-sel-all', null, 'small ghost') +
          btn('删除', 'as-del-batch', null, 'small danger' + (n ? '' : ' disabled')) +
          btn('导入 ' + n + ' 项', 'as-import-batch', null, 'small' + (n ? '' : ' disabled')) +
          btn('取消', 'as-batch-off', null, 'small ghost') + '</div>';
      }
      return tools + body + bar +
        '<div class="muted small center" style="padding:14px">图片、视频、音频与 3D 点云统一管理；长按可进入多选。</div>';
    }
  });
  action('as-view', () => { S.x.asView = S.x.asView === 'grid' ? 'list' : 'grid'; render(); });
  action('as-sort', ds => { S.x.asSort = ds.arg; render(); });

  // 模拟系统文件选择器导入（单发）
  let impSeq = 1;
  function makeImport(i) {
    const isVideo = i % 3 === 0;
    const hues = [150, 340, 45, 210, 268, 120, 300, 30, 174];
    return {
      id: 'as' + Date.now() + '_' + i, kind: isVideo ? 'video' : 'image',
      hue: hues[i % hues.length],
      label: (isVideo ? '视频' : '图片') + '-导入' + i,
      date: '2026-09-18',
      meta: isVideo ? '0:0' + (5 + i % 50) : ''
    };
  }
  action('as-import', () => {
    const a = makeImport(impSeq++);
    S.x.assets.unshift(a);
    toast('已导入：' + a.label + '（模拟系统文件选择器）');
    render();
  });
  // 批量导入（多选模拟）
  action('as-batch-on', () => { S.x.asBatch = true; S.x.asSel = {}; render(); });
  action('as-batch-off', () => { S.x.asBatch = false; S.x.asSel = {}; render(); });
  action('as-batch-on-viewer', () => { S.x.asBatch = true; S.x.asSel = {}; nav.pop(); });
  action('as-sel-all', () => {
    const sel = S.x.asSel = {};
    assets().forEach(a => { sel[a.id] = true; });
    render();
  });
  action('as-import-batch', () => {
    const sel = S.x.asSel || {};
    const ids = Object.keys(sel).filter(k => sel[k]);
    if (!ids.length) { toast('请先选择素材'); return; }
    ids.forEach((id, i) => S.x.assets.unshift(makeImport(impSeq++)));
    toast('已批量导入 ' + ids.length + ' 项（模拟系统文件选择器）');
    S.x.asBatch = false; S.x.asSel = {};
    render();
  });
  // F6：批量删除（轻删 → toast 撤销，I2 分级）
  action('as-del-batch', () => {
    const sel = S.x.asSel || {};
    const ids = Object.keys(sel).filter(k => sel[k]);
    if (!ids.length) { toast('请先选择素材'); return; }
    const removed = S.x.assets.filter(a => ids.indexOf(a.id) >= 0);
    S.x.assets = S.x.assets.filter(a => ids.indexOf(a.id) < 0);
    S.x.asBatch = false; S.x.asSel = {};
    toast('已删除 ' + removed.length + ' 项', { act: 'as-undo-del', arg: JSON.stringify(removed), label: '撤销' });
    render();
  });
  action('as-undo-del', ds => {
    const restored = JSON.parse(ds.arg);
    restored.forEach(a => { if (!assets().some(x => x.id === a.id)) S.x.assets.unshift(a); });
    render();
  });
  action('av-open', ds => {
    if (lpFired) { lpFired = false; return; } // 长按后的松手 click：吞掉（见长按定时器注释）
    if (S.x.asBatch) {
      S.x.asSel = S.x.asSel || {};
      S.x.asSel[ds.arg] = !S.x.asSel[ds.arg];
      render();
      return;
    }
    S.x.viewId = ds.arg;
    const t = assets().find(x => x.id === ds.arg);
    if (t && t.kind === 'pointcloud') startCloudLoading(t.id); // 点云进入加载态（pcache 解析耗时）
    nav.push('asset', ds.arg);
  });
  // F6：长按进入多选（ pointer 按住 500ms；Compose 侧对应 combinedClickable onLongClick ）
  // 第十一轮：长按触发后抑制紧随其后的松手 click——否则 click 命中重建后的同一素材格，
  // 把长按刚选中的项又取消（真机行为：长按选中 → 松手即取消，多选入口形同虚设）。
  // lpFired 在每次 pointerdown 复位，长按定时器触发时置位，av-open 消费一次。
  let lpTimer = null, lpTarget = null, lpFired = false;
  document.addEventListener('pointerdown', e => {
    lpFired = false;
    const cell = e.target.closest('.as-cell[data-arg],.as-row[data-arg]');
    if (!cell || S.x.asBatch) { lpTarget = null; return; }
    lpTarget = cell.dataset.arg;
    lpTimer = setTimeout(() => {
      lpFired = true;
      S.x.asBatch = true; S.x.asSel = {}; S.x.asSel[lpTarget] = true;
      render();
    }, 500);
  });
  ['pointerup', 'pointermove', 'pointercancel'].forEach(ev =>
    document.addEventListener(ev, () => { clearTimeout(lpTimer); }, true));

  // ---------- 点云舞台（粒子 + 姿态感应） ----------
  // 参数默认集：查看器齿轮面板与壁纸设置页（pcwall）共用，「重置所有参数」即恢复到这里。
  const CLOUD_DEFAULTS = { power: 1.0, quality: 100, zoom: 1.0, panX: 0, panY: 0, tiltX: 0, tiltY: 0, sway: false, flat: false, mesh: true };
  const CL_LABELS = {
    power: '强度', quality: '渲染精度', zoom: '缩放',
    panX: '视野左右', panY: '视野上下',
    tiltX: '姿态·俯仰（姿态感应演示）', tiltY: '姿态·左右',
  };
  function cloudCfgOf(holder) { // holder：素材对象 / 壁纸槽位 / 设置页草稿（S.x.pcw）
    holder.cloudCfg = holder.cloudCfg || {};
    Object.keys(CLOUD_DEFAULTS).forEach(k => { if (holder.cloudCfg[k] === undefined) holder.cloudCfg[k] = CLOUD_DEFAULTS[k]; });
    return holder.cloudCfg;
  }
  // 渲染精度 >100% 时追加离屏像素说明。原型为「标签在上、滑杆在下」的块布局，
  // 文案变长不会改动滑杆长度——App 侧曾把说明塞进行内尾值 Text，超过 100% 时
  // 尾值变宽 → weight(1f) 滑杆被压短 → 手指下的值回跳，永远调不到目标精度
  //（App 修复：尾值固定宽，说明挪到滑杆下方常驻注释行）。
  function cloudValText(k, v) {
    if (k === 'quality') return Math.round(v) + '%' + (v > 100 ? '（离屏 ' + Math.round(v * v / 100) + '% 像素）' : '');
    if (k === 'zoom') return v.toFixed(1) + 'x';
    if (k === 'tiltX' || k === 'tiltY') return v + '°';
    if (k === 'panX' || k === 'panY') return v.toFixed(2);
    return v.toFixed(1);
  }
  function cloudSlider(cfg, k, min, max, step, live) {
    return '<label class="slider-row"><span class="li-title">' + CL_LABELS[k] + ' ' + cloudValText(k, cfg[k]) + '</span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + cfg[k] + '" class="slider" data-live="' + live + '" data-k="' + k + '"></label>';
  }
  function ensurePcDots() {
    if (S.x.pcDots) return;
    S.x.pcDots = [];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // 180 颗：渲染精度 100% 用 90 颗（原样），200% 超采样用满 180 颗
    for (let i = 0; i < 180; i++) S.x.pcDots.push({ x: 8 + rnd() * 84, y: 20 + rnd() * 60, s: 1.5 + rnd() * 4, d: 0.4 + rnd() * 0.6 });
  }
  // pan = 位移；tilt = 旋转（原型里代替真机拖拽/陀螺仪）；平面平移模式把旋转换成位移演示
  function cloudTransform(cfg) {
    let tf = 'translate(' + cfg.panX * 40 + 'px,' + -cfg.panY * 40 + 'px)';
    if (cfg.flat) tf += ' translate(' + cfg.tiltY * 24 + 'px,' + -cfg.tiltX * 24 + 'px)';
    else tf += ' rotateX(' + cfg.tiltX + 'deg) rotateY(' + cfg.tiltY + 'deg)';
    return tf;
  }
  // 舞台点云层（查看器与壁纸设置页共用）；网格渲染 = 点更实（演示 mesh+原图纹理的锐利感）
  function cloudStageHtml(holder) {
    const cfg = cloudCfgOf(holder);
    ensurePcDots();
    const n = Math.min(S.x.pcDots.length, Math.round(90 * cfg.quality / 100));
    const dots = S.x.pcDots.slice(0, n).map(d =>
      '<div class="av-cloud-dot' + (cfg.mesh ? ' crisp' : '') + '" style="left:' + d.x + '%;top:' + d.y + '%;width:' + (d.s * cfg.zoom) + 'px;height:' + (d.s * cfg.zoom) + 'px;opacity:' + (0.35 + d.d * 0.6) + '"></div>').join('');
    const swayCls = cfg.sway ? (cfg.flat ? ' sway-flat' : ' sway') : '';
    return '<div class="av-cloud-inner' + swayCls + '" style="transform:' + cloudTransform(cfg) + '">' + dots + '</div>';
  }
  // 加载态（第十四轮）：缓存预览图压暗模糊打底（原型用源图色调渐变占位，App 侧为素材 thumb）
  // + 粒子聚合浮动 + 环形指示；加载完成后整台 0.45s 淡入（.av-cloud.reveal）
  function loadDots() {
    let seed = 41;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let h = '';
    for (let i = 0; i < 16; i++) {
      h += '<i class="av-load-dot" style="left:' + (18 + rnd() * 64).toFixed(1) + '%;top:' + (24 + rnd() * 48).toFixed(1) +
        '%;width:' + (2.5 + rnd() * 4).toFixed(1) + 'px;height:' + (2.5 + rnd() * 4).toFixed(1) +
        'px;animation-delay:' + (rnd() * 0.9).toFixed(2) + 's"></i>';
    }
    return h;
  }
  function cloudLoadingHtml(hue) {
    return '<div class="av-load-bg" style="background:linear-gradient(165deg,hsl(' + hue + ',62%,64%),hsl(' + ((hue + 60) % 360) + ',48%,30%))"></div>' +
      '<div class="av-load">' + loadDots() + '<div class="spinner"></div><div class="av-load-text">正在加载点云…</div></div>';
  }
  // 进入点云视图（查看器/设置页）统一走 loading：key 查看器 = 素材 id，设置页 = 'wall:'+arg
  function startCloudLoading(key, ms) {
    S.x.pcLoading = key;
    setTimeout(() => {
      if (S.x.pcLoading !== key) return; // 已切走/又触发新加载
      S.x.pcLoading = null;
      S.x.pcJustLoaded = { id: key, t: Date.now() };
      render();
      setTimeout(() => { if (S.x.pcJustLoaded && S.x.pcJustLoaded.id === key) S.x.pcJustLoaded = null; }, 700);
    }, ms || 1400);
  }
  function cloudJustLoaded(key) {
    return S.x.pcJustLoaded && S.x.pcJustLoaded.id === key && Date.now() - S.x.pcJustLoaded.t < 700;
  }
  // 「我的 → 当前壁纸」进入管理模式时也走加载态（mine.js 调用）
  window.startCloudLoading = startCloudLoading;
  function cloudStage(a) {
    const cfg = cloudCfgOf(a);
    if (S.x.pcLoading === a.id) return '<div class="av-cloud">' + cloudLoadingHtml(a.hue) + '</div>';
    let panel = '';
    if (cfg.panel) {
      panel = '<div class="cloud-panel">' +
        '<div class="pc-stats" style="position:static;max-width:none;margin-bottom:6px">' +
        '点数 1,179,432 · pcache v2 · 图源 1080×1920<br>' +
        'fPx 1527 · covScale 1.19e-07<br>' +
        'z ∈ [0.4, 1.8] · z p50 0.47 · 等效 σ ∈ [0.0001, 0.0097]<br>' +
        '渲染 36 ms/帧（含 swap） · 实测间隔 41 ms ≈ 24 fps · 已绘 1,203 帧</div>' +
        cloudSlider(cfg, 'power', 0.2, 2, 0.1, 'cl-set') +
        cloudSlider(cfg, 'quality', 30, 200, 1, 'cl-set') +
        cloudSlider(cfg, 'zoom', 0.6, 2.5, 0.1, 'cl-set') +
        cloudSlider(cfg, 'panX', -1, 1, 0.05, 'cl-set') +
        cloudSlider(cfg, 'panY', -1, 1, 0.05, 'cl-set') +
        cloudSlider(cfg, 'tiltX', -45, 45, 1, 'cl-set') +
        cloudSlider(cfg, 'tiltY', -45, 45, 1, 'cl-set') +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;color:#cfd2e0">自动摇摆</div></div>' + switchCtl(cfg.sway, 'cl-sway') + '</div>' +
        '<div style="padding:0 16px 8px;font-size:11px;color:#8b8fa3">' + (cfg.sway ? '自动摇摆中（忽略设备姿态）' : '跟随设备姿态改变视角') + '</div>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;color:#cfd2e0">平面平移</div></div>' + switchCtl(cfg.flat, 'cl-flat') + '</div>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;color:#cfd2e0">网格渲染</div></div>' + switchCtl(cfg.mesh, 'cl-mesh') + '</div>' +
        // 面板只做预览调整；「设为壁纸」唯一入口在底部工具栏（→ pcwall 设置页），
        // 不再在此放「应用为壁纸」——两套操作逻辑并存是混乱根源
        '<div style="padding:4px 0 2px;display:flex;justify-content:flex-end">' + btn('重置所有参数', 'cl-reset', null, 'small ghost') + '</div></div>';
    }
    return '<div class="av-cloud' + (cloudJustLoaded(a.id) ? ' reveal' : '') + '">' + cloudStageHtml(a) +
      '<button class="cloud-toggle" data-a="cl-panel">' + icon('settings') + '</button>' + panel + '</div>';
  }
  action('cl-panel', () => { const a = cur(); cloudCfgOf(a).panel = !a.cloudCfg.panel; render(); });
  action('cl-sway', () => { const cfg = cloudCfgOf(cur()); cfg.sway = !cfg.sway; render(); });
  action('cl-flat', () => { const cfg = cloudCfgOf(cur()); cfg.flat = !cfg.flat; render(); });
  action('cl-mesh', () => { const cfg = cloudCfgOf(cur()); cfg.mesh = !cfg.mesh; render(); });
  action('cl-reset', () => {
    const a = cur();
    const panel = a.cloudCfg && a.cloudCfg.panel;
    a.cloudCfg = Object.assign({ panel: !!panel }, CLOUD_DEFAULTS);
    render();
  });
  action('cl-set', (ds, el) => {
    const cfg = cloudCfgOf(cur()); const k = ds.k;
    cfg[k] = +el.value;
    // 手动拖姿态滑杆 → 自动关摇摆（对应 App 侧 onDragStart 关 sway；
    // 否则 sway 的 CSS 动画覆盖 inline transform，拖滑杆看似无效）
    const tilted = (k === 'tiltX' || k === 'tiltY');
    if (tilted && cfg.sway) { cfg.sway = false; render(); return; }
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = CL_LABELS[k] + ' ' + cloudValText(k, cfg[k]);
    if (k === 'zoom' || k === 'quality') render(); // 点数/尺寸即时变化
    else { // 姿态/平移滑杆即时倾斜（整页 render 会重建 input 打断拖拽，故直改 transform）
      const inner = document.querySelector('.av-cloud-inner');
      if (inner) inner.style.transform = cloudTransform(cfg);
    }
  });

  // ---------- 音频舞台 ----------
  function audioStage(a) {
    const s = a.audioState = a.audioState || { playing: false };
    let bars = '';
    for (let i = 0; i < 24; i++) {
      const h = 12 + Math.round(44 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
      bars += '<i style="height:' + (s.playing ? h : h * 0.45) + 'px"></i>';
    }
    return '<div class="av-audio">' +
      '<button class="bigplay" data-a="au-play">' + icon(s.playing ? 'pause' : 'play_arrow') + '</button>' +
      '<div class="wave">' + bars + '</div>' +
      '<div style="color:rgba(255,255,255,.7);font-size:12px">' + esc(a.label) + ' · 00:0' + (a.meta || '5') + '</div></div>';
  }
  action('au-play', () => {
    const a = cur();
    a.audioState.playing = !a.audioState.playing;
    render();
    if (a.audioState.playing) setTimeout(() => { if (cur() === a) { a.audioState.playing = false; render(); } }, 5000);
  });

  // ---------- 查看器 ----------
  registerScreen('asset', {
    title: '素材',
    full: true, // 沉浸式全屏：无顶栏（顶栏由悬浮返回键 + 工具栏承担），Compose 侧对应全屏 Dialog/immersive viewer
    render() {
      const list = assets();
      const a = cur();
      if (!a) return emptyHint('素材不存在');
      const idx = list.indexOf(a);
      // 处理进度条（工具栏上方）
      let proc = '';
      if (S.x.proc) {
        const j = mock.job(S.x.proc.key);
        if (!j) { S.x.proc = null; }
        else {
          proc = '<div class="proc-bar">' +
            '<div style="flex:1"><div class="li-title" style="font-weight:400;color:var(--on-surface)">' + esc(S.x.proc.title) + '</div>' +
            '<div class="dl-status">' + esc(j.phase || '处理中') + ' · ' + Math.round(j.p * 100) + '%</div>' +
            progress(j.p) + '</div>' +
            textBtn('取消', 'av-cancel', null, 'danger') + '</div>';
        }
      }
      // 舞台按类型
      let stage = '';
      if (a.kind === 'pointcloud') stage = cloudStage(a);
      else if (a.kind === 'audio') stage = audioStage(a);
      else stage = '<div class="av-media" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))">' +
        (a.kind === 'video' ? '<span style="width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff">' + icon('play_arrow') + '</span>' : '') + '</div>';
      const navBtns = (a.kind === 'image' || a.kind === 'video') ?
        ((idx > 0 ? '<button class="av-nav left" data-a="av-prev">' + icon('keyboard_arrow_right') + '</button>' : '') +
         (idx < list.length - 1 ? '<button class="av-nav right" data-a="av-next">' + icon('keyboard_arrow_right') + '</button>' : '')) : '';
      // 工具栏按类型
      // 按钮文案恒为「3D 点云」：任何备注（「旗舰芯」等）都会造成按钮尺寸不一致/错位，
      // 用户明确要求不带（第十四轮定案）
      const tool = (ic, label, act, arg) =>
        '<button class="tool" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' +
        '<span class="tool-ic">' + icon(ic) + '</span><span class="tool-label">' + esc(label) + '</span></button>';
      let tools = '';
      if (a.kind === 'image') tools =
        tool('wallpaper', '设为壁纸', 'av-wallpaper') + tool('send', '分享', 'av-share') +
        tool('zoom_in', 'AI 放大', 'av-upscale') + tool('crop', 'AI 扩图', 'av-outpaint') +
        tool('apps', '3D 点云', 'av-3d') + tool('info', '详情', 'av-info');
      else if (a.kind === 'video') tools =
        tool('wallpaper', '设为壁纸', 'av-wallpaper') + tool('send', '分享', 'av-share') +
        tool('delete', '删除', 'av-delete', a.id) + tool('info', '详情', 'av-info');
      else if (a.kind === 'audio') tools =
        tool('send', '分享', 'av-share') + tool('delete', '删除', 'av-delete', a.id) +
        tool('info', '详情', 'av-info');
      else if (a.kind === 'pointcloud') tools =
        // 设为壁纸 → 独立全屏设置页（pcwall）：调整面板只在那里出现一次，
        // 避免「齿轮面板里的应用为壁纸」与「工具栏设为壁纸」两套操作逻辑并存
        tool('wallpaper', '设为壁纸', 'av-pcwall', a.id) + tool('send', '分享', 'av-share') +
        tool('settings', '控制面板', 'cl-panel') + tool('delete', '删除', 'av-delete', a.id) +
        tool('info', '详情', 'av-info');
      // 多选入口（图片/视频）：进入批量选择模式
      if (a.kind === 'image' || a.kind === 'video') tools += tool('playlist_add', '多选', 'as-batch-on-viewer');
      return '<div class="av-stage">' +
        '<button class="av-back" data-a="av-back">' + icon('arrow_back') + '</button>' +
        '<div class="av-counter">' + (idx + 1) + ' / ' + list.length + (KIND_LABEL[a.kind] ? ' · ' + KIND_LABEL[a.kind] : '') + '</div>' +
        stage + navBtns + proc +
        '<div class="av-toolbar">' + tools + '</div></div>';
    }
  });
  action('av-back', () => nav.pop());
  // 左右切到点云素材同样进入加载态（App 侧每次切换都会重新解析 pcache）
  function viewStep(d) {
    const l = assets(); const i = l.indexOf(cur());
    const nx = l[i + d];
    if (!nx) return;
    S.x.viewId = nx.id;
    if (nx.kind === 'pointcloud') startCloudLoading(nx.id);
    render();
  }
  action('av-prev', () => viewStep(-1));
  action('av-next', () => viewStep(1));
  action('av-cancel', () => { if (S.x.proc) mock.resetJob(S.x.proc.key); S.x.proc = null; toast('已取消'); render(); });
  // I2 轻删：素材删除走 toast 撤销（可重建内容），不再是弹窗
  action('av-delete', ds => {
    const a = assets().find(x => x.id === ds.arg);
    if (!a) return;
    const idx = assets().indexOf(a);
    S.x.assets = S.x.assets.filter(x => x.id !== ds.arg);
    if (S.x.viewId === ds.arg) S.x.viewId = (assets()[Math.min(idx, assets().length - 1)] || {}).id;
    if (!S.x.viewId) { nav.pop(); return; }
    // 壁纸槽位是独立副本：删掉源素材不影响当前壁纸（第十四轮定案，App 侧对应
    // filesDir/livewallpaper/pointcloud/ 槽位，壁纸服务只读槽位）
    const slotKeep = S.x.pcSlot && S.x.pcSlot.assetId === ds.arg;
    toast('已删除 ' + a.label + (slotKeep ? '（当前壁纸为独立副本，不受影响）' : ''),
      { act: 'as-undo-del', arg: JSON.stringify([a]), label: '撤销' });
    render();
  });
  // F7 素材详情面板：尺寸/大小/路径/来源等元信息
  action('av-info', () => {
    const a = cur();
    if (!a) return;
    const mockBytes = 800000 + (a.hue * 13753) % 4200000;
    showDialog({
      title: '素材详情',
      body: '<div class="card tight" style="margin-top:0;padding:0">' +
        [['文件名', a.label], ['类型', KIND_LABEL[a.kind]],
        ['日期', a.date || '—'],
        ['大小', fmtSize(a.bytes || mockBytes)],
        ['分辨率', a.kind === 'image' ? (2400 + a.hue * 8) + '×' + (1800 + a.hue * 5) : (a.kind === 'video' ? '1920×1080 · ' + (a.meta || '0:12') : '—')],
        ['路径', '/storage/emulated/0/Pictures/MoeApk/' + a.label + (a.kind === 'video' ? '.mp4' : a.kind === 'audio' ? '.m4a' : a.kind === 'pointcloud' ? '.pcache' : '.png')],
        ['来源', a.from === 'ai' ? 'AI 生成' : a.src ? 'AI 处理产物' : '导入']
        ].map(r => '<div class="li" style="cursor:default;min-height:44px"><div class="li-body"><div class="li-sub">' + r[0] + '</div><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(r[1]) + '</div></div></div>').join('') + '</div>',
      actions: [{ label: '关闭' }]
    });
  });

  action('av-wallpaper', () => {
    const a = cur();
    if (a.kind === 'video') openVideoDialog(a); else openSetDialog(a);
  });
  action('av-share', () => toast('已调起系统分享（模拟）'));

  // I6 手势：查看器左右滑动切换（touch swipe；Compose 侧对应 pager + drag）
  let swX = null, swY = null;
  document.addEventListener('touchstart', e => {
    if (!nav.current() || nav.current().page !== 'asset') return;
    swX = e.touches[0].clientX; swY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (swX == null) return;
    const dx = e.changedTouches[0].clientX - swX;
    const dy = e.changedTouches[0].clientY - swY;
    swX = swY = null;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return; // 横向明显滑动才算
    if (dx < 0) viewStep(1); else viewStep(-1);
  }, { passive: true });

  function runProc(title, phases, ms, onDone) {
    if (S.x.proc) { toast('已有处理任务进行中'); return; }
    S.x.proc = { key: 'av-proc', title };
    mock.startJob('av-proc', title, ms, phases);
    const t = setInterval(() => {
      if (mock.isJobDone('av-proc')) {
        clearInterval(t); S.x.proc = null;
        onDone && onDone();
        render();
      }
    }, 250);
    render();
  }
  action('av-upscale', () => runProc('AI 放大', ['下载放大模型', '切块推理', '融合输出'], 3400,
    () => toast('放大完成，已保存到相册（模拟）')));
  action('av-outpaint', () => runProc('AI 扩图', ['分析构图', '生成外延内容', '融合边缘'], 4600, () => {
    const a = cur();
    S.x.assets.splice(assets().indexOf(a) + 1, 0, {
      id: 'as' + Date.now(), kind: 'image', hue: (a.hue + 30) % 360,
      label: a.label + '·扩图', date: '2026-09-18'
    });
    toast('扩图完成，已存为新素材');
  }));
  // 3D 点云档位选择（第十四轮定案）：两行选项即全部内容——原对话框带长段技术说明
  //（密度×2/耗时×2/移位超采样…），丑且啰嗦；细节见文档，对话框只给选择。
  action('av-3d', () => {
    showDialog({
      title: '3D 点云',
      body: '<div class="card tight" style="margin:0;padding:0">' +
        '<div class="li" data-a="av-3d-go" data-arg="std"><div class="li-body"><div class="li-title" style="font-weight:400">正常模式</div></div></div>' +
        '<div class="hr"></div>' +
        '<div class="li" data-a="av-3d-go" data-arg="hi"><div class="li-body"><div class="li-title" style="font-weight:400">高精度模式（帧率低）</div></div></div>' +
        '</div>',
      actions: [], // 点选项即执行；空白处/返回键关闭（dlg-actions 空时不再占高度）
    });
  });
  // 3D 点云处理：结果作为 pointcloud 素材保存（生成时同步保存预览图：原图 1/4 缩放），直接切到结果查看
  action('av-3d-go', ds => {
    closeDialog();
    const hi = ds.arg === 'hi';
    runProc(hi ? '3D 点云处理（高精度）' : '3D 点云处理', ['下载深度模型', '重建点云', '生成 pcache', '生成预览图'], hi ? 9200 : 5200, () => {
      const src = cur();
      const cloud = {
        id: 'as' + Date.now(), kind: 'pointcloud', hue: src.hue,
        label: src.label + '·点云', date: '2026-09-18', src: src.id,
        preview: true // 预览图已生成（原图 1/4 缩放）；App 侧 AssetStore 存 thumb，列表优先用它
      };
      S.x.assets.splice(assets().indexOf(src) + 1, 0, cloud);
      S.x.viewId = cloud.id;
      startCloudLoading(cloud.id, 900); // 刚生成完数据是热的，加载演示缩短
      toast('点云已生成' + (hi ? '（高精度）' : '') + '，保存为素材（含预览图）');
    });
  });

  // ---------- 点云壁纸设置页（pcwall 全屏子页，第十四轮） ----------
  // 定案：
  // 1. 「设为壁纸」从查看器工具栏进入**独立全屏页**，调整面板只出现在这里——
  //    不再与查看器齿轮面板里的「应用为壁纸」双逻辑并存；
  // 2. App 只向系统提供**一份**点云壁纸服务，确认时把点云（pcache + 原图纹理 + 预览图）
  //    复制为**壁纸专用副本**（槽位）并随参数一起落盘——删除源素材壁纸不消失，
  //    再次设置 = 覆盖槽位（S.x.pcSlot 演示槽位状态）；
  // 3. 「我的 → 当前壁纸」直接进入本页管理模式（arg='@slot'），调整即调当前壁纸，
  //    不必回素材库翻找源素材。
  registerScreen('pcwall', {
    title: '点云壁纸',
    full: true, // 沉浸式（同素材查看器）：悬浮返回 + 底部调整面板
    render(arg) {
      const manage = arg === '@slot';
      const slot = S.x.pcSlot;
      const a = manage ? null : assets().find(x => x.id === arg);
      const backBtn = '<button class="av-back" data-a="pcw-back">' + icon('arrow_back') + '</button>';
      if (manage && !slot) return '<div class="av-stage">' + backBtn + emptyHint('尚未设置点云壁纸') + '</div>';
      if (!manage && !a) return '<div class="av-stage">' + backBtn + emptyHint('素材不存在') + '</div>';
      const label = manage ? slot.label : a.label;
      const hue = manage ? slot.hue : a.hue;
      // 进入时初始化一次参数草稿：管理模式读槽位副本；素材模式沿用槽位（同源素材重设）否则默认集
      if (S.x.pcwKey !== arg) {
        S.x.pcwKey = arg;
        const base = slot && (manage || slot.assetId === arg) ? slot.cloudCfg : null;
        S.x.pcw = { cloudCfg: Object.assign({}, CLOUD_DEFAULTS, base || {}) };
      }
      const wkey = 'wall:' + arg;
      if (S.x.pcLoading === wkey) {
        return '<div class="av-stage">' + backBtn +
          '<div class="av-cloud">' + cloudLoadingHtml(hue) + '</div></div>';
      }
      const cfg = cloudCfgOf(S.x.pcw);
      const sw = (k, label) =>
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;color:#cfd2e0">' + label + '</div></div>' + switchCtl(cfg[k], 'pcw-sw', k) + '</div>';
      // 面板可整块折叠（2026-09-30 真机反馈：面板大面积遮挡壁纸画面，难以判断调整是否最佳）。
      // App 侧：面板标题行右侧收起柄 / 隐藏后底部「调整参数」小药丸（docs §18）
      if (S.x.pcw.panelOpen === false) {
        return '<div class="av-stage">' + backBtn +
          '<div class="av-counter">' + (manage ? '当前壁纸' : '设为点云壁纸') + ' · ' + esc(label) + '</div>' +
          '<div class="av-cloud' + (cloudJustLoaded(wkey) ? ' reveal' : '') + '">' + cloudStageHtml(S.x.pcw) + '</div>' +
          '<button class="pcw-panel-toggle" data-a="pcw-panel-open">' + icon('expand_less') + '调整参数</button></div>';
      }
      return '<div class="av-stage">' + backBtn +
        '<div class="av-counter">' + (manage ? '当前壁纸' : '设为点云壁纸') + ' · ' + esc(label) + '</div>' +
        '<div class="av-cloud' + (cloudJustLoaded(wkey) ? ' reveal' : '') + '">' + cloudStageHtml(S.x.pcw) + '</div>' +
        '<div class="pcw-panel">' +
        '<div class="pcw-panel-head"><span>' + (manage ? '当前壁纸参数' : '壁纸参数') + '</span>' +
        '<button class="pcw-panel-hide" data-a="pcw-panel-open" title="隐藏面板">' + icon('expand_more') + '</button></div>' +
        cloudSlider(cfg, 'power', 0.2, 2, 0.1, 'pcw-set') +
        cloudSlider(cfg, 'quality', 30, 200, 1, 'pcw-set') +
        cloudSlider(cfg, 'zoom', 0.6, 2.5, 0.1, 'pcw-set') +
        cloudSlider(cfg, 'panX', -1, 1, 0.05, 'pcw-set') +
        cloudSlider(cfg, 'panY', -1, 1, 0.05, 'pcw-set') +
        cloudSlider(cfg, 'tiltX', -45, 45, 1, 'pcw-set') +
        cloudSlider(cfg, 'tiltY', -45, 45, 1, 'pcw-set') +
        sw('sway', '自动摇摆') + sw('flat', '平面平移') + sw('mesh', '网格渲染') +
        '<div style="padding:0 4px 6px;font-size:11px;color:#8b8fa3">' + (cfg.sway ? '自动摇摆中（忽略设备姿态）' : '跟随设备姿态改变视角') + '</div>' +
        '<div class="li-sub" style="padding:4px 4px 2px">点云与参数将保存为壁纸专用副本；删除原素材不影响壁纸，再次设置自动覆盖。</div>' +
        (manage && S.x.pcSlot && S.x.pcSlot.systemActive === false ?
          '<div style="padding:4px;font-size:11px;color:#ffb4c8">系统当前壁纸已不是点云壁纸（重启或系统省电可能重置第三方动态壁纸）。' +
          '调整参数后点「重新设为壁纸」一步恢复。</div>' : '') +
        '<div style="display:flex;gap:8px;padding:6px 0 2px">' +
        btn('重置所有参数', 'pcw-reset', null, 'small ghost') +
        '<span style="flex:1"></span>' +
        btn(manage ? (S.x.pcSlot && S.x.pcSlot.systemActive === false ? '重新设为壁纸' : '保存并应用') : '设为壁纸', 'pcw-apply', null, 'small') +
        '</div></div></div>';
    },
  });
  action('av-pcwall', ds => { startCloudLoading('wall:' + ds.arg, 900); nav.push('pcwall', ds.arg); });
  action('pcw-back', () => nav.pop());
  action('pcw-panel-open', () => {
    if (S.x.pcw) S.x.pcw.panelOpen = S.x.pcw.panelOpen === false;
    render();
  });
  action('pcw-sw', ds => { const cfg = cloudCfgOf(S.x.pcw); cfg[ds.arg] = !cfg[ds.arg]; render(); });
  action('pcw-set', (ds, el) => {
    const cfg = cloudCfgOf(S.x.pcw); const k = ds.k;
    cfg[k] = +el.value;
    const tilted = (k === 'tiltX' || k === 'tiltY');
    if (tilted && cfg.sway) { cfg.sway = false; render(); return; }
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = CL_LABELS[k] + ' ' + cloudValText(k, cfg[k]);
    if (k === 'zoom' || k === 'quality') render();
    else {
      const inner = document.querySelector('.av-cloud-inner');
      if (inner) inner.style.transform = cloudTransform(cfg);
    }
  });
  action('pcw-reset', () => { S.x.pcw.cloudCfg = Object.assign({}, CLOUD_DEFAULTS); render(); });
  action('pcw-apply', () => {
    const manage = S.x.pcwKey === '@slot';
    if (manage) {
      // 管理模式：只更新槽位参数副本（壁纸服务每帧读配置，即时生效）
      S.x.pcSlot.cloudCfg = Object.assign({}, S.x.pcw.cloudCfg);
      toast('当前壁纸参数已更新（模拟）');
    } else {
      const a = assets().find(x => x.id === S.x.pcwKey);
      if (!a) { nav.pop(); return; }
      // 覆盖式写入槽位：素材引用 + 展示信息 + 参数副本（App 侧同时复制 pcache/原图/预览图文件）
      // systemActive：App 侧实时读 WallpaperManager（重启/系统省电可能重置第三方动态壁纸）；
      // 原型无系统壁纸概念，恒 true（管理模式的「重新设为壁纸」态在真机复现，见 design-notes 第十六轮）
      S.x.pcSlot = { assetId: a.id, label: a.label, hue: a.hue, cloudCfg: Object.assign({}, S.x.pcw.cloudCfg), systemActive: true };
      toast('已保存壁纸专用副本，调起系统选择器（模拟）');
    }
    nav.pop();
  });
})();
