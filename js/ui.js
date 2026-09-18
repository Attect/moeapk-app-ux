// UI 组件库 + 渲染编排。组件以 HTML 字符串函数表示，事件经全局委托分发（data-a / data-*）。
// 页面注册：registerScreen(id, {title, render})；动作注册：ACTIONS[name] = (ds, el) => {}。
(function () {
  window.SCREENS = {};
  window.ACTIONS = {};
  // 子页 id 自动收集：registerScreen 时以 'tab:' 前缀区分 Tab 与子页，
  // 替代 store.js 里手工维护的 SUB_PAGES 数组（新增子页无需再改两处）。
  window.SUB_PAGES = [];
  window.registerScreen = (id, def) => {
    SCREENS[id] = def;
    if (id.indexOf('tab:') !== 0 && SUB_PAGES.indexOf(id) < 0) SUB_PAGES.push(id);
  };
  window.action = (name, fn) => { ACTIONS[name] = fn; };

  // ---------- 基础工具 ----------
  window.esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  window.fmtSize = b => {
    if (b >= 1 << 30) return (b / (1 << 30)).toFixed(1) + ' GB';
    if (b >= 1 << 20) return (b / (1 << 20)).toFixed(1) + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' KB';
    return b + ' B';
  };
  const AVATAR_HUES = [210, 268, 120, 30, 330, 174];
  window.avatar = (title, cls) => {
    let hsh = 0; for (const c of title) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
    const hue = AVATAR_HUES[hsh % AVATAR_HUES.length];
    return '<div class="avatar ' + (cls || '') + '" style="background:hsl(' + hue + ',26%,42%)">' + esc(title.trim()[0] || '?') + '</div>';
  };

  // ---------- 组件 ----------
  window.card = (inner, cls) => '<div class="card ' + (cls || '') + '">' + inner + '</div>';
  window.sectionTitle = t => '<div class="section-title">' + esc(t) + '</div>';
  // 设置页 ListItem 模式
  window.listItem = o => {
    const lead = o.icon ? '<span class="li-icon">' + icon(o.icon) + '</span>' : (o.avatar ? avatar(o.avatar) : '');
    const trail = o.trailing || (o.arrow ? '<span class="li-arrow">' + icon('keyboard_arrow_right') + '</span>' : '');
    const click = o.action ? ' data-a="' + o.action + '"' + (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') : '';
    const danger = o.danger ? ' danger' : '';
    return '<div class="li' + danger + '"' + click + '>' + lead +
      '<div class="li-body"><div class="li-title">' + esc(o.title) + '</div>' +
      (o.sub ? '<div class="li-sub">' + o.sub + '</div>' : '') + '</div>' + trail + '</div>';
  };
  window.chip = (label, selected, act, arg) =>
    '<button class="chip' + (selected ? ' on' : '') + '" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + esc(label) + '</button>';
  window.assistChip = label => '<span class="achip">' + esc(label) + '</span>';
  window.btn = (label, act, arg, cls) =>
    '<button class="btn ' + (cls || '') + '" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + label + '</button>';
  window.textBtn = (label, act, arg, cls) =>
    '<button class="tbtn ' + (cls || '') + '" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '>' + label + '</button>';
  window.spinner = () => '<div class="spin-wrap"><div class="spinner"></div></div>';
  window.emptyHint = t => '<div class="center-hint">' + esc(t) + '</div>';
  window.progress = p => '<div class="pbar"><div class="pbar-fill" style="width:' + Math.round(p * 100) + '%"></div></div>';
  window.progressInd = () => '<div class="pbar ind"><div class="pbar-fill"></div></div>';
  window.field = (o) => // {id, label, value, hint, type, mono, keep}
    '<label class="field"><span class="field-label">' + esc(o.label) + '</span>' +
    '<input class="field-input' + (o.mono ? ' mono' : '') + '" type="' + (o.type || 'text') + '" data-keep="' + o.id + '"' +
    ' value="' + esc(o.value != null ? o.value : (S.x.keep && S.x.keep[o.id]) || '') + '"' +
    (o.keep === false ? '' : '') + ' placeholder="' + esc(o.hint || '') + '">' +
    (o.error ? '<span class="field-err">' + esc(o.error) + '</span>' : '') + '</label>';
  window.switchCtl = (on, act, arg) =>
    '<button class="switch' + (on ? ' on' : '') + '" data-a="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + '><span class="knob"></span></button>';
  window.radioRow = (label, sub, selected, act, arg) =>
    '<div class="li" data-a="' + act + '" data-arg="' + esc(arg) + '"><div class="li-body"><div class="li-title">' + esc(label) + '</div>' +
    (sub ? '<div class="li-sub">' + esc(sub) + '</div>' : '') + '</div>' +
    '<span class="radio' + (selected ? ' on' : '') + '"></span></div>';
  window.sliderRow = (label, min, max, val, step) =>
    '<label class="slider-row"><span class="li-title">' + esc(label) + '</span>' +
    '<input type="range" min="' + min + '" max="' + max + '" step="' + (step || 0.05) + '" value="' + val + '" class="slider"></label>';

  // EntryCard：目录/开源共用条目卡（对应 ApkScreen.kt EntryCard）
  window.entryCard = (o) => {
    // o: {title, version, tags[], summary, meta, avatarTitle, noIcon, action, arg}
    const chips = (o.tags || []).slice(0, 4).map(assistChip).join('');
    return '<div class="card entry" data-a="' + o.action + '" data-arg="' + esc(o.arg || '') + '">' +
      '<div class="entry-head">' + (o.noIcon ? '' : avatar(o.avatarTitle || o.title, 'entry-ic')) +
      '<div class="entry-titles"><div class="entry-title">' + esc(o.title) + '</div>' +
      (o.version ? '<div class="entry-ver">' + esc(o.version) + '</div>' : '') + '</div></div>' +
      (chips ? '<div class="entry-chips">' + chips + '</div>' : '') +
      '<div class="entry-summary">' + esc(o.summary || '') + '</div>' +
      (o.meta ? '<div class="entry-meta">' + esc(o.meta) + '</div>' : '') + '</div>';
  };

  // SectionColumn：首页分组（对应 ApkScreen.kt SectionColumn）
  window.sectionColumn = (title, itemsHtml, moreAct, loading, emptyText) => {
    let body;
    if (loading) body = spinner();
    else if (emptyText) body = '<div class="muted small center">' + esc(emptyText) + '</div>';
    else body = itemsHtml;
    return '<div class="sec">' +
      '<div class="sec-head"><span class="sec-title">' + esc(title) + '</span>' +
      (moreAct ? textBtn('查看全部', moreAct.act, moreAct.arg) : '') + '</div>' + body + '</div>';
  };

  // ---------- 对话框 ----------
  window.showDialog = d => { S.dialog = d; render(); };
  window.closeDialog = () => { S.dialog = null; render(); };
  window.confirmDialog = (title, body, okLabel, onOk, danger) => {
    showDialog({
      title, body,
      actions: [
        { label: '取消', run: closeDialog },
        { label: okLabel || '确定', style: danger ? 'danger' : 'filled', run: onOk }
      ]
    });
  };
  function dialogHtml() {
    const d = S.dialog;
    if (!d) return '';
    const acts = (d.actions || []).map((a, i) => {
      const cls = a.style === 'danger' ? ' danger' : (a.style === 'filled' ? '' : ' ghost');
      return '<button class="btn small' + cls + '" data-dlg="' + i + '">' + esc(a.label) + '</button>';
    }).join('');
    return '<div class="dlg-mask" data-a="dialog-mask">' +
      '<div class="dlg"><div class="dlg-title">' + esc(d.title) + '</div>' +
      '<div class="dlg-body">' + (d.body || '') + '</div>' +
      '<div class="dlg-actions">' + acts + '</div></div></div>';
  }

  // ---------- 渲染 ----------
  window.render = function () {
    const app = document.getElementById('app');
    if (!app) return;
    // 保留输入中的字段值与焦点
    const active = document.activeElement;
    const keepId = active && active.dataset && active.dataset.keep ? active.dataset.keep : null;
    const selPos = active && active.selectionStart != null ? active.selectionStart : null;

    const cur = nav.current();
    let title, content, showBack, bottom = '';
    if (cur) {
      const def = SCREENS[cur.page];
      title = typeof def.title === 'function' ? def.title(cur.arg) : def.title;
      content = def.render(cur.arg);
      showBack = !def.hideBack;
    } else {
      const def = SCREENS['tab:' + S.tab];
      title = typeof def.title === 'function' ? def.title() : def.title;
      content = def.render();
      showBack = false;
      bottom = '<nav class="navbar">' + TABS.map(t =>
        '<button class="nav-item' + (S.tab === t.id ? ' on' : '') + '" data-a="tab" data-arg="' + t.id + '">' +
        icon(t.icon) + '<span>' + t.label + '</span></button>').join('') + '</nav>';
    }

    const toasts = S.toasts.map(t =>
      '<div class="toast">' + esc(t.text) +
      (t.act ? '<button class="toast-act" data-a="' + t.act + '"' + (t.arg != null ? ' data-arg="' + esc(t.arg) + '"' : '') + '>' + esc(t.label) + '</button>' : '') +
      '</div>').join('');
    // 子页可在 topRight 声明一个图标按钮（如 LLM 对话的侧边菜单）
    const def0 = cur ? SCREENS[cur.page] : null;
    const rightBtn = cur && def0.topRight ?
      '<button class="icbtn" data-a="' + def0.topRight.act + '"' + (def0.topRight.arg != null ? ' data-arg="' + esc(def0.topRight.arg) + '"' : '') + '>' + icon(def0.topRight.icon) + '</button>' :
      '<span class="icbtn"></span>';
    // 首次进入某 Tab 的轻引导（一次性横幅，点"知道了"或切走即消失）
    let onboard = '';
    if (!cur) {
      S.seen = S.seen || {};
      const tip = ONBOARD_TIPS[S.tab];
      if (tip && !S.seen[S.tab]) onboard = '<div class="onboard" data-a="onboard-ok">' + icon(tip.icon) + '<span>' + tip.text + '</span><b>知道了</b></div>';
    }
    const html =
      '<header class="topbar">' + (showBack ? '<button class="icbtn" data-a="back">' + icon('arrow_back') + '</button>' : '<span class="icbtn"></span>') +
      '<span class="topbar-title">' + esc(title) + '</span>' + rightBtn + '</header>' +
      '<main class="content" id="content">' + content + '</main>' + bottom +
      '<button class="to-top' + (S.x.showTop ? ' on' : '') + '" data-a="to-top">' + icon('arrow_upward') + '</button>' +
      onboard +
      '<div class="toast-wrap">' + toasts + '</div>' + dialogHtml();

    // 闪烁修复：HTML 无变化（如仅定时器空转）时跳过 DOM 写入，
    // 避免重建节点重播入场动画（进度条/Toast 反复闪烁的根因）。
    if (app.__html === html) return;
    app.__html = html;
    app.innerHTML = html;

    if (keepId) {
      const el2 = app.querySelector('[data-keep="' + keepId + '"]');
      if (el2) {
        el2.value = (S.x.keep && S.x.keep[keepId]) || el2.value;
        el2.focus();
        try { el2.setSelectionRange(selPos, selPos); } catch (e) { /* 非文本输入 */ }
      }
    }
    const c = document.getElementById('content');
    if (c && S.x.scrollTop != null) { c.scrollTop = S.x.scrollTop; S.x.scrollTop = null; }
  };

  // ---------- 全局事件 ----------
  document.addEventListener('click', e => {
    const dlgBtn = e.target.closest('[data-dlg]');
    if (dlgBtn) {
      const d = S.dialog; const a = d && d.actions[+dlgBtn.dataset.dlg];
      if (a) { if (a.keep !== true) closeDialog(); a.run && a.run(); }
      return;
    }
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.a];
    if (fn) { if (fn(el.dataset, el) !== false && el.tagName === 'BUTTON') e.preventDefault(); }
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.keep;
    if (k) { S.x.keep = S.x.keep || {}; S.x.keep[k] = e.target.value; }
    const live = e.target.dataset && e.target.dataset.live;
    if (live && ACTIONS[live]) ACTIONS[live](e.target.dataset, e.target);
  });
  // 屏幕滚动位置保存（返回时还原由具体页面处理，这里仅记录）+ 回顶按钮显隐
  document.addEventListener('scroll', e => {
    if (e.target && e.target.id === 'content') {
      S._scroll = e.target.scrollTop;
      const show = e.target.scrollTop > 480;
      if (!!show !== !!S.x.showTop) { S.x.showTop = show; render(); }
    }
  }, true);

  // 首次引导文案（各 Tab 一次）
  const ONBOARD_TIPS = {
    apk: { icon: 'apps', text: 'APK 页浏览汉化/重配音应用与开源收录；顶部可按分类与标签筛选' },
    assets: { icon: 'image', text: '素材统一管理图片/视频/音频/3D 点云；长按进入多选，点按进查看器' },
    ai: { icon: 'auto_awesome', text: 'AI 模块全部端侧运行：对话 / 生图 / 语音 / 模型管理，任务在队列中排队' },
    mine: { icon: 'person', text: '登录 MK 通行证可多设备同步；下载任务与源偏好在「下载」中管理' }
  };
  action('onboard-ok', () => { S.seen = S.seen || {}; S.seen[S.tab] = true; render(); });
  action('to-top', () => { const c = document.getElementById('content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); });

  // 输入框聚焦时滚入视野（软键盘场景兜底，对应 Compose 侧 imePadding + 自动滚动）
  document.addEventListener('focusin', e => {
    if (e.target && e.target.dataset && e.target.dataset.keep) {
      setTimeout(() => { try { e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (err) { } }, 80);
    }
  });

  // 通用动作
  action('tab', ds => nav.goTab(ds.arg));
  action('back', () => { if (!nav.pop()) nav.goTab(S.tab); });
  action('dialog-mask', (ds, el) => { if (el.classList.contains('dlg-mask') && !(S.dialog && S.dialog.sticky)) closeDialog(); });
  action('theme-toggle', () => { theme.toggle(); });

  // 历史回退（浏览器/安卓返回键语义）
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.dialog) { closeDialog(); return; }
    if (e.key === 'Backspace' && !e.target.closest('input,textarea')) nav.pop();
  });
})();
