// 全局状态 + 导航栈。对应 Compose 侧 AppRoot.kt 的 MainTab / SubPage / rememberSaveable。
// URL hash 与导航状态双向同步（'#tab' 或 '#tab/page/arg'），便于浏览器回退与直达某屏。
(function () {
  const TABS = [
    { id: 'apk', label: 'APK', icon: 'apps' },
    { id: 'ai', label: 'AI', icon: 'auto_awesome' },
    { id: 'download', label: '下载', icon: 'download' },
    { id: 'mine', label: '我的', icon: 'person' }
  ];
  const SUB_PAGES = ['about', 'login', 'register', 'account', 'security', 'update',
    'models', 'model-search', 'catalog-detail', 'open-detail', 'wallpaper', 'pointcloud-preview'];

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
  window.SUB_PAGES = SUB_PAGES;

  function syncHash() {
    const top = S.stack[S.stack.length - 1];
    const h = '#' + S.tab + (top ? '/' + top.page + (top.arg ? '/' + top.arg : '') : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  window.nav = {
    goTab(id) {
      S.tab = id; S.stack = []; S.dialog = null;
      render(); syncHash();
    },
    push(page, arg) {
      S.stack.push({ page, arg: arg || '' }); S.dialog = null;
      render(); syncHash();
    },
    pop() {
      if (S.stack.length) { S.stack.pop(); S.dialog = null; render(); syncHash(); return true; }
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
