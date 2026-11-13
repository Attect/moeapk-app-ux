// 运行：node --test tests/goods-ip-hall-image.test.js
// 只使用 Node 内置模块，在 vm 中执行真实演示数据与页面渲染，不启动浏览器。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DEMO_URL = 'https://attect.github.io/moeapk-app-ux/assets/goods-ip-star-trail.svg';
const LOCAL_IMAGE = 'assets/goods-ip-star-trail.svg';

function loadPrototype() {
  const screens = {};
  const actions = {};
  const window = { DB: {}, addEventListener() {} };
  const context = {
    window,
    DB: window.DB,
    S: { x: {} },
    document: { addEventListener() {} },
    navigator: {},
    console,
    setTimeout() {},
    clearTimeout() {},
    requestAnimationFrame() {},
    registerScreen(id, def) { screens[id] = def; },
    action(name, fn) { actions[name] = fn; },
    showDialog(d) { context.S.dialog = d; },
    closeDialog() { context.S.dialog = null; },
    icon() { return ''; },
    esc: s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    chip(label, selected, act, arg) {
      return '<button class="chip' + (selected ? ' on' : '') + '" data-a="' + act + '" data-arg="' + (arg == null ? '' : arg) + '">' + label + '</button>';
    },
    textBtn(label, act) { return '<button data-a="' + act + '">' + label + '</button>'; },
    btn(label) { return '<button>' + label + '</button>'; },
    assistChip(label) { return '<span>' + label + '</span>'; },
    emptyHint(label) { return '<div>' + label + '</div>'; },
    nav: { current() { return null; }, push() {}, pop() {}, goTab() {} }
  };
  vm.createContext(context);
  for (const file of ['js/data/goods.js', 'js/screens/goods.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return { context, screens, actions };
}

function hallCard(html, id) {
  const marker = 'data-arg="' + id + '"';
  const at = html.indexOf(marker);
  assert.notEqual(at, -1, '应找到展厅卡 ' + id);
  const start = html.lastIndexOf('<button', at);
  const end = html.indexOf('</button>', at);
  return html.slice(start, end + '</button>'.length);
}

function mosaicHtml(html) {
  const start = html.indexOf('<div class="g-mosaic">');
  const end = html.indexOf('<div class="g-legal">', start);
  assert.notEqual(start, -1, '应找到物品形态展厅墙');
  assert.notEqual(end, -1, '展厅墙后应保留披露行');
  return html.slice(start, end);
}

test('演示契约保留绝对 HTTPS image、必需 emoji 与存在的本地封面', () => {
  const { context } = loadPrototype();
  const hall = context.DB.GOODS_IP_HALLS.find(h => h.id === 'work-1001');
  assert.equal(hall.image, DEMO_URL);
  assert.match(hall.image, /^https:\/\//);
  assert.equal(hall.emoji, '🌌');

  const file = path.join(ROOT, LOCAL_IMAGE);
  assert.equal(fs.existsSync(file), true, '本地演示封面必须真实存在');
  const svg = fs.readFileSync(file, 'utf8');
  assert.match(svg, /^<svg\b/);
  assert.doesNotMatch(svg, /<script\b|(?:href|src)=["']https?:\/\//i);
});

test('首页 IP 展厅图片优先展示，本地映射避免外部请求且保留 emoji 降级', () => {
  const { screens } = loadPrototype();
  const card = hallCard(screens['tab:goods'].render(), 'work-1001');
  assert.match(card, /class="g-ip-hall-visual g-ip-hall-cover"/);
  assert.match(card, /<span class="g-ip-hall-emoji" aria-hidden="true">🌌<\/span>/);
  assert.match(card, /<img src="assets\/goods-ip-star-trail\.svg" alt="" loading="lazy" decoding="async" onerror="this\.remove\(\)">/);
  assert.ok(card.indexOf('g-ip-hall-emoji') < card.indexOf('<img'), 'emoji 应始终作为图片底层先渲染');
  assert.doesNotMatch(card, /<img[^>]+src="https:\/\/attect\.github\.io/);
  assert.match(card, /星轨巡旅·作品厅/);
  assert.match(card, /3 件策展展品 · 5 位角色/);
});

test('普通 feed 的绝对 HTTPS image 原样交给图片元素并转义属性', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS_HOME = { hero: '测试', fresh_count: 0, mosaic: [] };
  context.DB.GOODS_IP_HALLS = [{
    id: 'remote', title: '远程封面', emoji: '🛰️',
    image: 'https://cdn.example.test/hall.webp?a=1&b=2', blurb: '测试真实 feed URL',
    item_count: 0, character_count: 0,
    subject: { id: 1001, kind: 'work', name: '星轨巡旅' }
  }];
  const card = hallCard(screens['tab:goods'].render(), 'remote');
  assert.match(card, /<img src="https:\/\/cdn\.example\.test\/hall\.webp\?a=1&amp;b=2"/);
  assert.match(card, />🛰️<\/span><img /);
});

test('旧数据缺 image 时保留完整卡片与 emoji，不生成空图片', () => {
  const { context, screens } = loadPrototype();
  const hall = context.DB.GOODS_IP_HALLS.find(h => h.id === 'character-2001');
  assert.equal(Object.hasOwn(hall, 'image'), false, '其余演示展厅继续代表旧 feed');
  const card = hallCard(screens['tab:goods'].render(), hall.id);
  assert.match(card, /class="g-ip-hall-visual g-ip-hall-cover"/);
  assert.match(card, /class="g-ip-hall-emoji"[^>]*>🐱<\/span>/);
  assert.doesNotMatch(card, /<img\b/);
  assert.match(card, /猫耳女仆·角色厅/);
  assert.match(card, /3 件策展展品 · 仅此角色/);
});

test('空值与非 HTTPS 值安全回落 emoji', () => {
  for (const image of [undefined, null, '', '   ', 'assets/not-a-feed-url.svg', 'http://example.test/hall.webp']) {
    const { context, screens } = loadPrototype();
    context.DB.GOODS_HOME = { hero: '测试', fresh_count: 0, mosaic: [] };
    context.DB.GOODS_IP_HALLS = [{
      id: 'legacy', title: '旧展厅', emoji: '🎁', image, blurb: '旧数据兼容',
      item_count: 1, character_count: 0,
      subject: { id: 1001, kind: 'work', name: '星轨巡旅' }
    }];
    const card = hallCard(screens['tab:goods'].render(), 'legacy');
    assert.match(card, />🎁<\/span>/);
    assert.doesNotMatch(card, /<img\b/, 'image=' + String(image));
  }
});

test('统一 IP 页策展头部复用同一封面与降级逻辑', () => {
  const { screens } = loadPrototype();
  const withImage = screens['goods-ip'].render('1001');
  assert.match(withImage, /class="g-ip-hall-visual g-ip-curation-cover"/);
  assert.match(withImage, /<span class="g-ip-hall-emoji" aria-hidden="true">🌌<\/span><img src="assets\/goods-ip-star-trail\.svg"/);
  assert.match(withImage, /onerror="this\.remove\(\)"/);

  const legacy = screens['goods-ip'].render('2001');
  assert.match(legacy, /class="g-ip-hall-visual g-ip-curation-cover"/);
  assert.match(legacy, /class="g-ip-hall-emoji"[^>]*>🐱<\/span>/);
  const cover = legacy.slice(legacy.indexOf('g-ip-curation-cover'), legacy.indexOf('g-ip-curation-title'));
  assert.doesNotMatch(cover, /<img\b/);
});

test('宅物 home.hero 保留字段与文案，但只渲染紧凑副标题', () => {
  const { context, screens } = loadPrototype();
  assert.equal(context.DB.GOODS_HOME.hero, '看看有什么好东西');
  const html = screens['tab:goods'].render();
  assert.match(html, /^<div class="g-hero-sub">看看有什么好东西<\/div>/);
  assert.doesNotMatch(html, /class="g-hero"|g-hero-title/);

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  assert.match(css, /\.g-hero-sub\s*\{\s*margin: 2px 4px 0; color: var\(--on-surface-variant\);\s*font-size: 12px; line-height: 18px;\s*\}/);
  assert.doesNotMatch(css, /^\.g-hero\s*\{|^\.g-hero-title\s*\{/m);
});

test('空 items 时 home.mosaic 仍渲染全部分类卡与可点击入口', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS = [];
  const html = screens['tab:goods'].render();
  const mosaic = mosaicHtml(html);
  assert.equal((mosaic.match(/class="g-mos-card"/g) || []).length, context.DB.GOODS_HOME.mosaic.length);
  assert.doesNotMatch(html, /data-a="goods-reshuffle"/, '空库时应隐藏换一批');

  for (const cat of context.DB.GOODS_CATS) {
    assert.ok(mosaic.includes('data-a="goods-open-cat" data-arg="' + cat.id + '"'), cat.id + ' 应保留进入分类页的入口');
    assert.ok(mosaic.includes('<span>' + cat.emoji + '</span>'), cat.id + ' 应使用分类 emoji');
    assert.ok(mosaic.includes('<div class="g-mos-name">' + cat.name + '</div>'));
    assert.ok(mosaic.includes('<div class="g-mos-sub">' + cat.sub + '</div>'));
  }
  assert.doesNotMatch(mosaic, /<img\b/);
  assert.match(mosaic, /class="g-cover v0" data-focus="center" style="--gh:\d+"/);
});

test('有商品的 mosaic 槽位仍使用物品封面而不是分类占位', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS_HOME = { hero: '测试', fresh_count: 0, mosaic: [{ hall: 'badge', span: 4, height: 148 }] };
  context.DB.GOODS_IP_HALLS = [];
  context.DB.GOODS = [context.DB.GOODS.find(g => g.id === 'g01')];
  const html = screens['tab:goods'].render();
  const mosaic = mosaicHtml(html);
  assert.equal((mosaic.match(/class="g-mos-card"/g) || []).length, 1);
  assert.match(html, /data-a="goods-reshuffle"/, '有商品时应保留换一批');
  assert.ok(mosaic.includes('data-a="goods-open-cat" data-arg="badge"'));
  assert.ok(mosaic.includes('<span>✨</span>'), '应沿用 g01 的物品封面');
  assert.equal(mosaic.includes('<span>📛</span>'), false, '有商品时不应改成小铁片分类占位');
  assert.ok(mosaic.includes('<div class="g-mos-name">小铁片</div>'));
});

test('宽扁物品形态展厅封面也使用 cover 填满，不再 contain 露出两侧渐变', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS_HOME = { hero: '测试', fresh_count: 0, mosaic: [{ hall: 'badge', span: 4, height: 128 }] };
  context.DB.GOODS_IP_HALLS = [];
  context.DB.GOODS = [{ ...context.DB.GOODS.find(g => g.id === 'g01'), images: [LOCAL_IMAGE] }];
  const mosaic = mosaicHtml(screens['tab:goods'].render());
  assert.match(mosaic, /class="g-cover v0" data-focus="center"/);
  assert.match(mosaic, /<img src="assets\/goods-ip-star-trail\.svg"/);
  assert.doesNotMatch(mosaic, /g-cover[^"]*\bfit\b/);

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const imageRule = css.match(/\.g-cover img\s*\{([^}]*)\}/);
  assert.ok(imageRule);
  assert.match(imageRule[1], /object-fit:\s*cover/);
  assert.doesNotMatch(css, /\.g-cover\.fit/);
});

test('IP 筛选提供有限快捷项与可搜索的完整选择器', () => {
  const { context, screens, actions } = loadPrototype();
  let html = screens['goods-cat'].render('badge');
  assert.match(html, /更多 4 个/);

  context.S.x.goodsCatIp = { badge: '1005' };
  html = screens['goods-cat'].render('badge');
  assert.match(html, /class="chip on" data-a="goods-cat-ip" data-arg="badge:1005"/);

  actions['goods-ip-picker-open']({ arg: 'badge' });
  assert.equal(context.S.dialog.bodyClass, 'g-ip-picker-dialog');
  assert.match(context.S.dialog.body, /搜索 IP 名称 \/ 年份/);
  assert.match(context.S.dialog.body, /g-ip-picker-count/);

  context.S.x.keep['goods-ip-filter-q'] = '像素';
  actions['goods-ip-filter-live']({});
  assert.match(context.S.dialog.body, /像素勇者/);
  assert.doesNotMatch(context.S.dialog.body, /猫耳女仆·闪底吧唧/);

  context.S.x.keep['goods-ip-filter-q'] = '不存在的 IP';
  actions['goods-ip-filter-live']({});
  assert.match(context.S.dialog.body, /没有匹配的 IP/);

  actions['goods-ip-pick']({ arg: 'badge:1005' });
  assert.equal(context.S.x.goodsCatIp.badge, '1005');
  assert.equal(context.S.dialog, null);
});

test('展厅两行筛选收进可折叠容器，滚动中只切 class 且空结果可撤销', () => {
  const { screens } = loadPrototype();
  const html = screens['goods-cat'].render('badge');
  assert.match(html, /<div class="g-cat-filters"><div class="g-cat-filters-inner"><div class="chip-row">/);
  assert.ok(html.indexOf('g-cat-filters') < html.indexOf('g-falls'));

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'js/screens/goods.js'), 'utf8');
  assert.match(css, /\.g-cat-filters\s*\{[^}]*grid-template-rows:\s*1fr/);
  assert.match(css, /\.g-cat-filters\.hidden\s*\{[^}]*grid-template-rows:\s*0fr/);
  assert.match(js, /function setGoodsFiltersHidden\(/);
  assert.match(js, /if \(!content\.querySelector\('\.g-falls'\)\)/);
  assert.match(js, /updateGoodsCatFilters\(t\)/);
});

test('瀑布图从干净节点淡入，当前批 eager 且预载下一批', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS = context.DB.GOODS.map(g => ({ ...g, images: [LOCAL_IMAGE] }));
  const html = screens['goods-cat'].render('badge');
  assert.match(html, /loading="eager" decoding="async" onload="this\.classList\.add\('is-loaded'\)/);
  assert.match(html, /onerror="this\.remove\(\)"/);

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'js/screens/goods.js'), 'utf8');
  assert.match(css, /\.g-cover img\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity \.18s/);
  assert.match(css, /\.g-cover img\.is-loaded\s*\{\s*opacity:\s*1/);
  assert.match(js, /fallItems\(cid, batch \+ 1, sort\)/);
  assert.match(js, /preloadFallBatch\(arg, nb, sort\)/);
  assert.match(js, /preloadFallBatch\(cur\.arg, nb \+ 1/);
});

test('卡片到详情 FLIP 只动画图片，标题延后显示且非首张安全降级', () => {
  const js = fs.readFileSync(path.join(ROOT, 'js/screens/goods.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  assert.match(js, /const clone = heroClone\(rel, hero\.rect, hero\.html\)/);
  assert.match(js, /targetTitle\.style\.visibility = 'hidden'/);
  assert.match(js, /finishHeroTransition\(\[clone\], targetTitle \? \[target, targetTitle\] : \[target\]\)/);
  assert.match(js, /pagerRoot\.scrollLeft[\s\S]*hero = null;\s*return;/);
  assert.doesNotMatch(js, /titleClone|titleRect|titleHtml|animateHeroTitle/);
  assert.doesNotMatch(css, /\.g-hero-anim\.title/);
});

test('展品详情图片区域与淘宝方形商品图保持 1:1', () => {
  const { screens } = loadPrototype();
  const html = screens['goods-detail'].render('g01');
  assert.match(html, /class="g-pager"/);
  assert.match(html, /class="g-shot"/);

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const shotRule = css.match(/\.g-shot\s*\{([^}]*)\}/);
  assert.ok(shotRule);
  assert.match(shotRule[1], /aspect-ratio:\s*1\s*\/\s*1/);
  assert.doesNotMatch(shotRule[1], /aspect-ratio:\s*3\s*\/\s*4/);
});

test('展厅列表使用手机至少双列、宽屏增列的瀑布流，长标题不截断', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const falls = css.match(/\.g-falls\s*\{([^}]*)\}/);
  assert.ok(falls);
  assert.match(falls[1], /column-count:\s*2/);
  assert.match(falls[1], /column-gap:\s*10px/);
  for (const [width, count] of [[520, 3], [760, 4], [1040, 5]]) {
    const media = css.match(new RegExp('@container \\(min-width: ' + width + 'px\\)\\s*\\{\\s*\\.g-falls\\s*\\{([^}]*)\\}'));
    assert.ok(media, width + 'px 宽屏断点应存在');
    assert.match(media[1], new RegExp('column-count:\\s*' + count));
  }

  const title = css.match(/\.g-fall-title\s*\{([^}]*)\}/);
  assert.ok(title);
  assert.match(title[1], /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(title[1], /line-clamp|-webkit-box|text-overflow|overflow:\s*hidden/);
});

test('分类展厅与 IP 展厅真实封面加载后保持原图比例', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS = context.DB.GOODS.map(g => ({ ...g, images: [LOCAL_IMAGE] }));
  for (const html of [screens['goods-cat'].render('badge'), screens['goods-ip'].render('1001')]) {
    assert.match(html, /class="g-falls"/);
    assert.match(html, /aspect-ratio:(?:1\/1|4\/5|3\/4)/, '加载前保留稳定占位比例');
    assert.match(html, /onload="this\.classList\.add\('is-loaded'\);this\.parentElement\.style\.aspectRatio=this\.naturalWidth\+'\/'\+this\.naturalHeight"/);
    assert.match(html, /loading="eager" decoding="async"/);
  }

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const coverRule = css.match(/\.g-cover\s*\{([^}]*)\}/);
  assert.ok(coverRule);
  assert.match(coverRule[1], /position:\s*relative/, '绝对定位图片必须受自身封面容器约束');
});

test('物品形态展厅由顶栏承担名称与简介，正文只保留策展语', () => {
  const { screens } = loadPrototype();
  const def = screens['goods-cat'];
  assert.equal(def.title('badge'), '小铁片');
  assert.equal(def.topSubtitle('badge'), '吧唧 · 马口铁徽章');
  const html = def.render('badge');
  assert.match(html, /^<div class="g-cat-hero"><div class="g-cat-emoji">📛<\/div>/);
  assert.match(html, /<div class="g-cat-blurb">别在包上的小心思，一枚一个心情。<\/div>/);
  assert.doesNotMatch(html, /g-cat-name|g-cat-sub/);
  assert.match(html, /data-a="goods-sort"/);
  assert.match(html, /class="g-falls"/);

  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const emojiRule = css.match(/\.g-cat-emoji\s*\{([^}]*)\}/);
  assert.ok(emojiRule);
  assert.match(emojiRule[1], /font-size: 22px/);
  assert.doesNotMatch(emojiRule[1], /background|border|box-shadow|width: 56px/);
});

test('空物品形态展厅仍保留头部身份并隐藏无意义排序', () => {
  const { context, screens } = loadPrototype();
  context.DB.GOODS = [];
  const html = screens['goods-cat'].render('badge');
  assert.match(html, /class="g-cat-hero"/);
  assert.match(html, /📛/);
  assert.doesNotMatch(html, /小铁片/, '正文不得重复顶栏展厅名');
  assert.equal(screens['goods-cat'].title('badge'), '小铁片');
  assert.match(html, /这个展厅还在布置中/);
  assert.doesNotMatch(html, /data-a="goods-sort"/);
});

test('全局顶栏使用连续背景、左对齐标题与可选辅助信息', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
  const topbar = css.match(/\.topbar\s*\{([^}]*)\}/);
  const title = css.match(/\.topbar-title\s*\{([^}]*)\}/);
  assert.ok(topbar && title);
  assert.match(topbar[1], /background: transparent/);
  assert.match(topbar[1], /border-bottom: 0/);
  assert.doesNotMatch(title[1], /text-align: center|grad-text|font-size: 22px/);
  assert.match(css, /\.topbar-subtitle\s*\{/);
  assert.match(ui, /def0\.topSubtitle/);
  assert.match(ui, /class="topbar-copy"/);
});
