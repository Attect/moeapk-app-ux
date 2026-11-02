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
    action() {},
    icon() { return ''; },
    esc: s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    chip(label, selected, act, arg) {
      return '<button class="chip' + (selected ? ' on' : '') + '" data-a="' + act + '" data-arg="' + (arg == null ? '' : arg) + '">' + label + '</button>';
    },
    textBtn(label) { return '<button>' + label + '</button>'; },
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
  return { context, screens };
}

function hallCard(html, id) {
  const marker = 'data-arg="' + id + '"';
  const at = html.indexOf(marker);
  assert.notEqual(at, -1, '应找到展厅卡 ' + id);
  const start = html.lastIndexOf('<button', at);
  const end = html.indexOf('</button>', at);
  return html.slice(start, end + '</button>'.length);
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
