// 全局状态 + 导航栈。对应 Compose 侧 AppRoot.kt 的 MainTab / SubPage / rememberSaveable。
// URL hash 与导航状态双向同步（'#tab' 或 '#tab/page/arg'），便于浏览器回退与直达某屏。
(function () {
  const TABS = [
    { id: 'apk', label: 'APK', icon: 'apps' },
    { id: 'assets', label: '素材', icon: 'image' },
    { id: 'ai', label: 'AI', icon: 'auto_awesome' },
    { id: 'mine', label: '我的', icon: 'person' }
  ];
  // 子页清单由 ui.js 的 registerScreen 自动收集（window.SUB_PAGES），此处不再硬编码。

  window.S = {
    tab: 'apk',
    stack: [],            // [{page, arg}]
    apkSub: 'home',       // home | apps | games | open（对应 ApkSub）
    aiTab: 'llm',         // llm | diffusion | tts | upscale
    loggedIn: false,
    user: null,
    serviceRunning: true,
    batteryWhitelisted: false,
    srcPref: 'domestic',  // domestic | stable
    serverOverride: '',
    dialog: null,
    toasts: [],
    // 各屏易失状态（登录/注册向导步、AI 测试台、壁纸等），屏幕文件内自行读写
    x: {}
  };

  window.TABS = TABS;
  // SUB_PAGES 在 ui.js 中定义（registerScreen 时自动收集），此处仅引用。

  function syncHash() {
    const top = S.stack[S.stack.length - 1];
    const h = '#' + S.tab + (top ? '/' + top.page + (top.arg ? '/' + top.arg : '') : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  // 子页滚动记忆键（render() 的 S.scrollMem 机制使用）
  function subKey(e) { return 'sub:' + e.page + '/' + (e.arg || ''); }
  // 丢弃子页滚动记忆：返回/切走后重进该子页从顶部开始（对应 App 侧弹栈即弃保存态）
  function dropSubScroll(entries) {
    if (!S.scrollMem) return;
    entries.forEach(e => { delete S.scrollMem[subKey(e)]; });
  }

  window.nav = {
    goTab(id) {
      const dropped = S.stack;
      S.tab = id; S.stack = []; S.dialog = null;
      render(); syncHash();
      dropSubScroll(dropped);
    },
    push(page, arg) {
      S.stack.push({ page, arg: arg || '' }); S.dialog = null;
      render(); syncHash();
    },
    pop() {
      if (S.stack.length) {
        const top = S.stack.pop();
        S.dialog = null; render(); syncHash();
        dropSubScroll([top]);
        return true;
      }
      return false;
    },
    current() { return S.stack[S.stack.length - 1] || null; },
    setApkSub(sub) { S.apkSub = sub; render(); },
    setAiTab(t) { S.aiTab = t; render(); },
    applyHash() {
      const parts = (location.hash || '#apk').replace(/^#/, '').split('/');
      const tab = TABS.some(t => t.id === parts[0]) ? parts[0] : 'apk';
      S.tab = tab; S.stack = [];
      if (parts[1] && SUB_PAGES.includes(parts[1])) {
        S.stack.push({ page: parts[1], arg: decodeURIComponent(parts[2] || '') });
      }
      render();
    }
  };
  window.addEventListener('hashchange', () => nav.applyHash());
})();
