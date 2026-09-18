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
    // 横屏/平板（≥920px）：节内卡片两列排布（css .two-col），窄屏保持单列
    else body = '<div class="two-col">' + itemsHtml + '</div>';
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
    app.className = cur ? '' : 'has-nav'; // Tab 页（有底栏）标记：横屏时底栏变左栏 rail
    // 模拟键盘只在对话页有效，切走自动收起
    if (S.x.kbDemo && (!cur || cur.page !== 'llm')) S.x.kbDemo = false;
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
    // 第四轮：软键盘行为定案——输入框 focus 时键盘面板从底部顶起内容区，
    // 输入区（composer）紧贴键盘上沿，两者之间**只有 composer 自身 padding，无多余空白**；
    // 对话列表同步收缩，最后一条消息不被遮挡。（App 侧对应 imePadding 正确实现，勿重复加间距。）
    const kbDemo = S.x.kbDemo ? kbdemoHtml() : '';
    // 子页可在 topRight 声明一个图标按钮（如 LLM 对话的侧边菜单）
    const def0 = cur ? SCREENS[cur.page] : null;
    const full = !!(cur && def0.full); // 沉浸式全屏子页（如素材查看器）：无顶栏，自带悬浮返回
    const rightBtn = cur && !full && def0.topRight ?
      '<button class="icbtn" data-a="' + def0.topRight.act + '"' + (def0.topRight.arg != null ? ' data-arg="' + esc(def0.topRight.arg) + '"' : '') + '>' + icon(def0.topRight.icon) + '</button>' :
      '<span class="icbtn"></span>';
    // 首次进入某 Tab 的轻引导（一次性横幅，点"知道了"或切走即消失）
    let onboard = '';
    if (!cur) {
      S.seen = S.seen || {};
      const tip = ONBOARD_TIPS[S.tab];
      if (tip && !S.seen[S.tab]) onboard = '<div class="onboard" data-a="onboard-ok">' + icon(tip.icon) + '<span>' + tip.text + '</span><b>知道了</b></div>';
    }
    const topbar = full ? '' :
      '<header class="topbar">' + (showBack ? '<button class="icbtn" data-a="back">' + icon('arrow_back') + '</button>' : '<span class="icbtn"></span>') +
      '<span class="topbar-title">' + esc(title) + '</span>' + rightBtn + '</header>';
    document.body.classList.toggle('has-full', full); // 全屏页隐藏 proto-bar 调试条（避免与查看器顶部信息重叠）
    const html =
      topbar +
      '<main class="content' + (full ? ' full' : '') + '" id="content">' + content + '</main>' + kbDemo + bottom +
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

  // ---------- 模拟软键盘（第四轮：键盘行为定案的可视化验证） ----------
  // 设计定案：输入框 focus → 键盘顶起内容区；composer 紧贴键盘（零多余间隙）；
  // 仅 LLM 对话页启用（该页输入框 data-kb="1"），切页自动收起。
  function kbdemoHtml() {
    const row = keys => '<div class="kb-row">' + keys.map(k =>
      '<button class="kb-key' + (k.length > 1 ? ' wide' : '') + '" data-a="kb-key">' + esc(k) + '</button>').join('') + '</div>';
    return '<div class="kbdemo">' +
      '<div class="kb-tag">[模拟键盘 · 验证输入区贴合]</div>' +
      row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']) +
      row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l']) +
      row(['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫']) +
      '<div class="kb-row"><button class="kb-key space" data-a="kb-key">空格</button>' +
      '<button class="kb-key wide accent" data-a="kb-close">✓ 完成</button></div></div>';
  }
  document.addEventListener('focusin', e => {
    if (e.target.dataset && e.target.dataset.kb === '1') {
      if (!S.x.kbDemo) { S.x.kbDemo = true; render(); }
    }
  });
  action('kb-key', () => { /* 模拟按键不回填文本，仅验证布局贴合 */ });
  action('kb-close', (ds, el) => {
    S.x.kbDemo = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    render();
  });

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

  // ---------- 横屏 / 平板断点判定（与 css 容器查询阈值 720/920 一致） ----------
  window.frameW = function () { const p = document.querySelector('.phone'); return p ? p.clientWidth : 0; };
  window.isRail = () => frameW() >= 720; // NavigationRail
  window.isWide = () => frameW() >= 920; // 双栏 master-detail
  // 真机旋转 / 窗口尺寸变化：按新宽度重渲染（结构分支依赖宽度，如双栏）
  let rsT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => { render(); }, 180);
  });

  // ---------- 原型框横屏开关（proto-bar 调试入口，非 App 内容） ----------
  function applyFrame() {
    const p = document.querySelector('.phone');
    if (p) p.classList.toggle('land', S.frame === 'land');
    const b = document.querySelector('[data-a="frame-toggle"]');
    if (b) b.textContent = S.frame === 'land' ? '竖屏' : '横屏';
  }
  try { S.frame = localStorage.getItem('proto-frame') || 'port'; } catch (e) { S.frame = 'port'; }
  // URL 覆盖：?frame=land / ?frame=port（与 theme.js 的 ?theme= 一致，便于直达验证）
  try {
    const fq = new URLSearchParams(location.search).get('frame');
    if (fq === 'land' || fq === 'port') S.frame = fq;
  } catch (e) { }
  applyFrame();
  action('frame-toggle', () => {
    S.frame = S.frame === 'land' ? 'port' : 'land';
    try { localStorage.setItem('proto-frame', S.frame); } catch (e) { }
    applyFrame();
    render();
  });

  // 历史回退（浏览器/安卓返回键语义）
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.dialog) { closeDialog(); return; }
    if (e.key === 'Backspace' && !e.target.closest('input,textarea')) nav.pop();
  });
})();
