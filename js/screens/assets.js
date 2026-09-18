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
    if (S.x.asBatch) {
      S.x.asSel = S.x.asSel || {};
      S.x.asSel[ds.arg] = !S.x.asSel[ds.arg];
      render();
      return;
    }
    S.x.viewId = ds.arg; nav.push('asset', ds.arg);
  });
  // F6：长按进入多选（ pointer 按住 500ms；Compose 侧对应 combinedClickable onLongClick ）
  let lpTimer = null, lpTarget = null;
  document.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.as-cell[data-arg],.as-row[data-arg]');
    if (!cell || S.x.asBatch) { lpTarget = null; return; }
    lpTarget = cell.dataset.arg;
    lpTimer = setTimeout(() => {
      S.x.asBatch = true; S.x.asSel = {}; S.x.asSel[lpTarget] = true;
      render();
    }, 500);
  });
  ['pointerup', 'pointermove', 'pointercancel'].forEach(ev =>
    document.addEventListener(ev, () => { clearTimeout(lpTimer); }, true));

  // ---------- 点云舞台（粒子 + 姿态感应） ----------
  function cloudStage(a) {
    const cfg = a.cloudCfg = a.cloudCfg || { power: 1.0, quality: 100, zoom: 1.0, tiltX: 0, tiltY: 0, sway: true, panel: false };
    if (!S.x.pcDots) {
      S.x.pcDots = [];
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) S.x.pcDots.push({ x: 8 + rnd() * 84, y: 20 + rnd() * 60, s: 1.5 + rnd() * 4, d: 0.4 + rnd() * 0.6 });
    }
    const n = Math.round(90 * cfg.quality / 100);
    const dots = S.x.pcDots.slice(0, n).map(d =>
      '<div class="av-cloud-dot" style="left:' + d.x + '%;top:' + d.y + '%;width:' + (d.s * cfg.zoom) + 'px;height:' + (d.s * cfg.zoom) + 'px;opacity:' + (0.35 + d.d * 0.6) + '"></div>').join('');
    const tilt = 'rotateX(' + cfg.tiltX + 'deg) rotateY(' + cfg.tiltY + 'deg)' + (cfg.sway ? '' : '');
    let panel = '';
    if (cfg.panel) {
      panel = '<div class="cloud-panel">' +
        '<div class="pc-stats" style="position:static;max-width:none;margin-bottom:6px">点数 1,179,432 · pcache v2 · 帧耗时 36ms（28fps）</div>' +
        '<label class="slider-row"><span class="li-title">强度 ' + cfg.power.toFixed(1) + '</span><input type="range" min="0.2" max="2" step="0.1" value="' + cfg.power + '" class="slider" data-live="cl-set" data-k="power"></label>' +
        '<label class="slider-row"><span class="li-title">点云精度（渲染性能）' + cfg.quality + '%</span><input type="range" min="30" max="100" step="1" value="' + cfg.quality + '" class="slider" data-live="cl-set" data-k="quality"></label>' +
        '<label class="slider-row"><span class="li-title">缩放 ' + cfg.zoom.toFixed(1) + 'x</span><input type="range" min="0.6" max="2.5" step="0.1" value="' + cfg.zoom + '" class="slider" data-live="cl-set" data-k="zoom"></label>' +
        '<label class="slider-row"><span class="li-title">姿态·俯仰（姿态感应演示）' + cfg.tiltX + '°</span><input type="range" min="-45" max="45" step="1" value="' + cfg.tiltX + '" class="slider" data-live="cl-set" data-k="tiltX"></label>' +
        '<label class="slider-row"><span class="li-title">姿态·左右 ' + cfg.tiltY + '°</span><input type="range" min="-45" max="45" step="1" value="' + cfg.tiltY + '" class="slider" data-live="cl-set" data-k="tiltY"></label>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;color:#cfd2e0">自动摇摆（模拟陀螺仪）</div></div>' + switchCtl(cfg.sway, 'cl-sway') + '</div>' +
        '<div style="padding:6px 0 4px">' + btn('应用为壁纸', 'cl-apply', null, 'small') + '</div></div>';
    }
    return '<div class="av-cloud"><div class="av-cloud-inner' + (cfg.sway ? ' sway' : '') + '" style="transform:' + tilt + '">' + dots + '</div>' +
      '<button class="cloud-toggle" data-a="cl-panel">' + icon('settings') + '</button>' + panel + '</div>';
  }
  action('cl-panel', () => { const a = cur(); a.cloudCfg.panel = !a.cloudCfg.panel; render(); });
  action('cl-sway', () => { const a = cur(); a.cloudCfg.sway = !a.cloudCfg.sway; render(); });
  action('cl-set', (ds, el) => {
    const cfg = cur().cloudCfg; const k = ds.k;
    cfg[k] = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) {
      const base = lb.textContent.replace(/ [\-\d.]+[°%x]?$/, '');
      lb.textContent = base + ' ' + (k === 'quality' ? cfg[k] + '%' : (k === 'zoom' ? cfg[k].toFixed(1) + 'x' : (k === 'tiltX' || k === 'tiltY' ? cfg[k] + '°' : cfg[k].toFixed(1))));
    }
    if (k === 'zoom' || k === 'quality') render(); // 点数/尺寸即时变化
    else { // 姿态滑杆即时倾斜
      const inner = document.querySelector('.av-cloud-inner');
      if (inner) inner.style.transform = 'rotateX(' + cfg.tiltX + 'deg) rotateY(' + cfg.tiltY + 'deg)';
    }
  });
  action('cl-apply', () => toast('已调起系统动态壁纸选择器（模拟）'));

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
      const tool = (ic, label, act, arg) =>
        '<button class="tool" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' +
        '<span class="tool-ic">' + icon(ic) + '</span><span>' + esc(label) + '</span></button>';
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
        tool('wallpaper', '设为壁纸', 'cl-apply') + tool('send', '分享', 'av-share') +
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
  action('av-prev', () => { const l = assets(); const i = l.indexOf(cur()); S.x.viewId = l[i - 1].id; render(); });
  action('av-next', () => { const l = assets(); const i = l.indexOf(cur()); S.x.viewId = l[i + 1].id; render(); });
  action('av-cancel', () => { if (S.x.proc) mock.resetJob(S.x.proc.key); S.x.proc = null; toast('已取消'); render(); });
  // I2 轻删：素材删除走 toast 撤销（可重建内容），不再是弹窗
  action('av-delete', ds => {
    const a = assets().find(x => x.id === ds.arg);
    if (!a) return;
    const idx = assets().indexOf(a);
    S.x.assets = S.x.assets.filter(x => x.id !== ds.arg);
    if (S.x.viewId === ds.arg) S.x.viewId = (assets()[Math.min(idx, assets().length - 1)] || {}).id;
    if (!S.x.viewId) { nav.pop(); return; }
    toast('已删除 ' + a.label, { act: 'as-undo-del', arg: JSON.stringify([a]), label: '撤销' });
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
    const l = assets(); const i = l.indexOf(cur());
    if (dx < 0 && i < l.length - 1) { S.x.viewId = l[i + 1].id; render(); }
    else if (dx > 0 && i > 0) { S.x.viewId = l[i - 1].id; render(); }
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
  // 3D 点云处理：结果作为 pointcloud 素材保存（生成时同步保存预览图：原图 1/4 缩放），直接切到结果查看
  action('av-3d', () => runProc('3D 点云处理', ['下载深度模型', '重建点云', '生成 pcache', '生成预览图'], 5200, () => {
    const src = cur();
    const cloud = {
      id: 'as' + Date.now(), kind: 'pointcloud', hue: src.hue,
      label: src.label + '·点云', date: '2026-09-18', src: src.id,
      preview: true // 预览图已生成（原图 1/4 缩放）；App 侧 AssetStore 存 thumb，列表优先用它
    };
    S.x.assets.splice(assets().indexOf(src) + 1, 0, cloud);
    S.x.viewId = cloud.id;
    toast('点云已生成，保存为素材（含预览图）');
  }));
})();
