// APK Tab：首页 / 应用 / 游戏 / 开源 + 应用详情 + 开源详情
// 对应：ui/apk/ApkScreen.kt、ApkHomeScreen.kt、CatalogScreens.kt、OpenScreens.kt
(function () {
  const catalogAll = () => DB.CATALOG.filter(i => DB.DEMO_ITEMS || !i.demo);
  const byCat = c => catalogAll().filter(i => i.category === c);

  function catalogCard(it) {
    return entryCard({
      title: it.title, version: 'v' + it.version, tags: it.tags, summary: it.summary,
      meta: (it.category === 'app' ? '应用' : '游戏') + ' · ' + it.channel + ' · ' + fmtSize(it.parts.reduce((s, p) => s + p.size, 0)) + ' · ' + it.parts.length + ' 个分卷 · ' + it.published_at,
      noIcon: true, action: 'open-catalog-detail', arg: it.id
    });
  }
  function openCard(it) {
    return entryCard({
      title: it.title, version: it.latest ? it.latest.tag : '未发布', tags: it.tags, summary: it.summary,
      meta: it.license + (it.language ? ' · ' + it.language : '') + (it.latest ? ' · 更新于 ' + it.latest.published_at : ' · 等待首个发行版'),
      avatarTitle: it.title, action: 'open-open-detail', arg: it.id
    });
  }

  // ---------- Tab 容器 ----------
  registerScreen('tab:apk', {
    title: 'APK',
    render() {
      const subs = [['home', '首页'], ['apps', '应用'], ['games', '游戏'], ['open', '开源']];
      let body = '';
      if (S.apkSub === 'home') body = renderHome();
      else if (S.apkSub === 'open') body = renderOpenList();
      else body = renderCatalogList(S.apkSub);
      return '<div class="chip-row" style="margin:0 -16px;padding:6px 16px 2px">' +
        subs.map(s => chip(s[1], S.apkSub === s[0], 'apk-sub', s[0])).join('') + '</div>' + body;
    }
  });
  action('apk-sub', ds => nav.setApkSub(ds.arg));

  // ---------- 首页 ----------
  function renderHome() {
    let h = '';
    if (DB.UPDATES.length && !S.x.updateCardDismissed) {
      const names = DB.UPDATES.map(u => { const c = DB.CATALOG.find(i => i.id === u.id); return c ? c.title : u.id; });
      h += card('<div class="dl-row" data-a="go-update" style="cursor:pointer"><div style="flex:1;min-width:0"><div class="li-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        (DB.UPDATES.length === 1
          ? '发现新版本：' + esc(names[0])
          : '发现 ' + DB.UPDATES.length + ' 个应用可更新：' + esc(names.slice(0, 2).join('、')) + (DB.UPDATES.length > 2 ? ' 等' : '')) +
        '</div><div class="li-sub">' + esc(DB.UPDATES[0].version) + ' 版本可用 · 点击查看全部</div></div>' +
        textBtn('查看', 'go-update') + textBtn('忽略', 'dismiss-update') + '</div>', 'update-card');
    }
    const loading = S.x.apkLoading;
    const apps = byCat('app').filter(i => i.id !== 'moeapk-service');
    const games = byCat('game');
    const opens = DB.OPEN;
    h += sectionColumn('应用',
      apps.slice(0, 3).map(catalogCard).join(''),
      apps.length > 3 ? { act: 'apk-sub', arg: 'apps' } : null, loading,
      apps.length ? '' : '这里还没有内容');
    h += sectionColumn('游戏',
      games.slice(0, 3).map(catalogCard).join(''),
      games.length > 3 ? { act: 'apk-sub', arg: 'games' } : null, loading,
      games.length ? '' : '这里还没有内容');
    h += sectionColumn('开源',
      opens.slice(0, 3).map(openCard).join(''),
      opens.length > 3 ? { act: 'apk-sub', arg: 'open' } : null, loading,
      opens.length ? '' : '这里还没有内容');
    return h;
  }
  action('dismiss-update', () => { S.x.updateCardDismissed = true; render(); });
  action('go-update', () => nav.push('update'));
  action('apk-refresh', () => {
    S.x.apkLoading = true; render();
    setTimeout(() => { S.x.apkLoading = false; render(); }, 900);
  });

  // ---------- 应用 / 游戏列表（F1：搜索 + 标签筛选） ----------
  const TAG_LABELS = { zh: '汉化', re: '重配音' };
  function renderCatalogList(cat) {
    const kw = ((S.x.keep && S.x.keep['apk-q']) || '').trim().toLowerCase();
    const tag = S.x.apkTag || '';
    let items = byCat(cat);
    if (tag) items = items.filter(i => (i.tags || []).includes(TAG_LABELS[tag] || tag));
    if (kw) items = items.filter(i => (i.title + ' ' + i.summary + ' ' + (i.tags || []).join(' ')).toLowerCase().indexOf(kw) >= 0);
    // 收藏置顶（F4）
    const favs = S.favs || [];
    items = items.slice().sort((a, b) => (favs.indexOf(b.id) >= 0) - (favs.indexOf(a.id) >= 0));

    let h = '<div class="ptr-hint"><span data-a="apk-refresh" style="color:var(--primary)">点击模拟下拉刷新</span></div>';
    // 搜索框
    h += '<div class="search-row"><div class="search-box">' + icon('search') +
      '<input class="field-input" data-keep="apk-q" placeholder="搜索名称 / 简介 / 标签…" value="' + esc((S.x.keep && S.x.keep['apk-q']) || '') + '"></div></div>';
    // 标签筛选（该分类下出现过的标签）
    const allTags = [...new Set(byCat(cat).flatMap(i => i.tags || []))];
    if (allTags.length) {
      h += '<div class="chip-row" style="padding-top:8px">' +
        chip('全部', !tag, 'apk-tag', '') +
        allTags.map(t => chip(t, tag === t, 'apk-tag', t)).join('') + '</div>';
    }
    if (S.x.apkLoading) return h + spinner();
    if (!items.length) return h + emptyHint(kw || tag ? '没有匹配的条目' : '这里还没有内容');
    // 横屏/平板（≥920px）：条目两列排布（css .two-col）
    return h + '<div class="two-col">' + items.map(catalogCard).join('') + '</div>';
  }
  action('apk-tag', ds => { S.x.apkTag = ds.arg; render(); });

  // ---------- 开源列表（含搜索） ----------
  function renderOpenList() {
    const kw = ((S.x.keep && S.x.keep['apk-open-q']) || '').trim().toLowerCase();
    let items = DB.OPEN;
    if (kw) items = items.filter(i => (i.title + ' ' + i.summary + ' ' + (i.tags || []).join(' ') + ' ' + i.license).toLowerCase().indexOf(kw) >= 0);
    let h = '<div class="ptr-hint"><span data-a="apk-refresh" style="color:var(--primary)">点击模拟下拉刷新</span></div>';
    h += '<div class="search-row"><div class="search-box">' + icon('search') +
      '<input class="field-input" data-keep="apk-open-q" placeholder="搜索开源项目…" value="' + esc((S.x.keep && S.x.keep['apk-open-q']) || '') + '"></div></div>';
    if (S.x.apkLoading) return h + spinner();
    h += items.length ? '<div class="two-col">' + items.map(openCard).join('') + '</div>' : emptyHint('没有匹配的开源项目');
    h += '<div class="muted small center" style="padding:18px 24px">内容在开源平台由原作者维护，本站只同步最新版本。<br>下载直达开源平台，遇到问题请向原作者反馈。</div>';
    return h;
  }

  // ---------- 收藏（F4）：详情页收藏，「我的 → 我的收藏」集中查看 ----------
  S.favs = S.favs || [];
  function favBtn(id) {
    const on = S.favs.indexOf(id) >= 0;
    return '<button class="icbtn" data-a="fav-toggle" data-arg="' + id + '" title="收藏" style="color:' + (on ? 'var(--primary)' : 'var(--on-surface-variant)') + '">' + icon(on ? 'favorite' : 'favorite_border') + '</button>';
  }
  action('fav-toggle', ds => {
    const i = S.favs.indexOf(ds.arg);
    if (i >= 0) { S.favs.splice(i, 1); toast('已取消收藏', { act: 'fav-undo', arg: ds.arg, label: '撤销' }); }
    else { S.favs.push(ds.arg); toast('已加入收藏'); }
    render();
  });
  action('fav-undo', ds => { if (S.favs.indexOf(ds.arg) < 0) S.favs.push(ds.arg); render(); });

  // ---------- 我的收藏 ----------
  registerScreen('favorites', {
    title: '我的收藏',
    render() {
      const items = S.favs.map(id => DB.CATALOG.find(i => i.id === id)).filter(Boolean);
      const opens = S.favs.map(id => DB.OPEN.find(i => i.id === id)).filter(Boolean);
      if (!items.length && !opens.length) {
        return '<div class="empty-illust">' + icon('favorite_border') +
          '<div class="empty-title">还没有收藏</div>' +
          '<div class="empty-sub">在应用/开源详情页点右上角 ♡ 收藏，方便稍后安装</div>' +
          '<div class="empty-cta">' + btn('去逛逛应用', 'fav-go-apps', null, 'small') + '</div></div>';
      }
      let h = '';
      if (items.length) h += sectionTitle('应用 / 游戏') + items.map(catalogCard).join('');
      if (opens.length) h += sectionTitle('开源') + opens.map(openCard).join('');
      return h;
    }
  });
  action('fav-go-apps', () => { nav.goTab('apk'); nav.setApkSub('apps'); });

  // ---------- 应用详情 ----------
  registerScreen('catalog-detail', {
    title: '应用详情',
    render(arg) {
      const it = DB.CATALOG.find(i => i.id === arg);
      if (!it) return emptyHint('条目不存在');
      // 右上角图标随收藏态切换（render 时动态改 topRight）
      this.topRight = { icon: S.favs.indexOf(arg) >= 0 ? 'favorite' : 'favorite_border', act: 'fav-toggle', arg };
      const total = it.parts.reduce((s, p) => s + p.size, 0);
      let h = entryCard({
        title: it.title, version: 'v' + it.version + '（' + it.version_code + '）', tags: it.tags,
        summary: it.summary, noIcon: true
      });
      if (it.install && it.install.notes) {
        h += sectionTitle('安装说明');
        h += card('<div class="muted" style="font-size:14px;line-height:20px">' + esc(it.install.notes) + '</div>');
      } else if (it.parts.some(p => p.kind === 'obb')) {
        // F3：含 OBB 数据包的游戏给出处理说明
        h += sectionTitle('安装说明');
        h += card('<div class="muted" style="font-size:14px;line-height:20px">游戏含 OBB 数据包。请先安装 APK，MoeApk 会自动将数据包放到 Android/obb 对应目录；目录权限不足时请按系统提示授权。</div>');
      }
      h += sectionTitle('更新日志');
      it.changelog.forEach(c => {
        h += card('<div class="li-title">v' + c.version + '（' + c.version_code + '）</div><ul class="changes muted" style="font-size:13px">' +
          c.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>');
      });
      h += sectionTitle('分卷');
      h += card('<div class="card tight" style="margin-top:0;padding:0">' +
        it.parts.map(p => '<div class="li" style="cursor:default"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(p.name) + '</div>' +
          '<div class="li-sub">' + esc(p.kind) + ' · ' + fmtSize(p.size) + '</div></div></div>' +
          (p !== it.parts[it.parts.length - 1] ? '<div class="hr"></div>' : '')).join('') + '</div>');
      h += '<div style="margin-top:14px">' + btn('下载（' + it.parts.length + ' 个分卷）', 'catalog-download', it.id, 'block') + '</div>';
      return h;
    }
  });
  action('open-catalog-detail', ds => nav.push('catalog-detail', ds.arg));
  action('catalog-download', ds => {
    const it = DB.CATALOG.find(i => i.id === ds.arg);
    if (it) mock.enqueueParts(it.parts, it.title);
  });

  // ---------- 开源详情 ----------
  registerScreen('open-detail', {
    title: '开源详情',
    render(arg) {
      const it = DB.OPEN.find(i => i.id === arg);
      if (!it) return emptyHint('条目不存在');
      this.topRight = { icon: S.favs.indexOf(arg) >= 0 ? 'favorite' : 'favorite_border', act: 'fav-toggle', arg };
      let h = entryCard({
        title: it.title, version: it.latest ? it.latest.tag : '', tags: it.tags,
        summary: it.summary, avatarTitle: it.title
      });
      if (it.latest) {
        h += sectionTitle('最新版本 ' + it.latest.tag + '（' + it.latest.published_at + '）');
        h += card('<ul class="changes muted" style="font-size:13px">' +
          it.latest.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' +
          '<div class="hr"></div>' +
          it.latest.assets.map(a =>
            '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(a.name) + '</div>' +
            '<div class="li-sub">' + fmtSize(a.size) + '</div></div>' +
            textBtn('下载', 'open-asset-download', JSON.stringify({ id: it.id, name: a.name, size: a.size })) + '</div>').join(''));
      } else {
        h += card('<div class="muted center">等待首个发行版，敬请期待。</div>');
      }
      h += sectionTitle('信息');
      h += card('<div class="card tight" style="margin-top:0;padding:0">' +
        '<div class="li" style="cursor:default"><div class="li-body"><div class="li-sub">仓库</div><div class="li-title" style="font-weight:400">' + esc(it.repo) + '（' + esc(it.platform) + '）</div></div></div><div class="hr"></div>' +
        '<div class="li" style="cursor:default"><div class="li-body"><div class="li-sub">作者</div><div class="li-title" style="font-weight:400">' + esc(it.author) + '</div></div></div><div class="hr"></div>' +
        '<div class="li"><div class="li-body"><div class="li-sub">许可证 · ' + esc(it.license) + '</div><div class="li-title">发行版页面</div></div><span class="li-arrow">' + icon('language') + '</span></div>' +
        '</div>');
      h += '<div class="muted small center" style="padding:16px 24px">内容在开源平台由原作者维护，本站只同步最新版本。</div>';
      return h;
    }
  });
  action('open-open-detail', ds => nav.push('open-detail', ds.arg));
  action('open-asset-download', ds => {
    const a = JSON.parse(ds.arg);
    mock.enqueue(a.name, a.size, { kind: 'open:' + a.id });
  });
})();
