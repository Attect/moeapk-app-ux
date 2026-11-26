const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('LLM 配置只暴露真实后端与输出档位', () => {
  const shared = read('js/screens/ai.js');
  const screen = read('js/screens/ai-llm.js');
  assert.match(shared, /device: 'gpu'/);
  assert.match(shared, /maxOutput: 2048/);
  assert.ok(screen.includes('[1024, 2048, 4096, 8192]'));
  assert.ok(screen.includes("['cpu', 'gpu']"));
  assert.ok(!screen.includes("['cpu', 'gpu', 'npu']"));
  assert.ok(!screen.includes("['off', '关闭'], ['ngram', '自投机（推荐）'], ['mtp'"));
  assert.ok(screen.includes("action('lc-max-output'"));
});

test('流式阅读保留滚动位置并提供回到底部入口', () => {
  const screen = read('js/screens/ai-llm.js');
  const css = read('css/app.css');
  assert.ok(screen.includes('function renderChat()'));
  assert.ok(screen.includes('S.x.llmFollow'));
  assert.ok(screen.includes("action('llm-latest'"));
  assert.ok(screen.includes("document.addEventListener('scroll'"));
  assert.ok(!screen.includes("scrollIntoView({ block: 'end' })"));
  assert.ok(css.includes('.chat-scroll'));
  assert.ok(css.includes('.chat-latest.on'));
});

test('上下文按模型元数据开放到训练上限', () => {
  const data = read('js/data/ai.js');
  const shared = read('js/screens/ai.js');
  const screen = read('js/screens/ai-llm.js');
  assert.ok(data.includes('"context_length": 32768'));
  assert.ok(shared.includes('function contextChoices(model)'));
  assert.ok(shared.includes('131072, 262144'));
  assert.ok(shared.includes('contextLength: 262144'));
  assert.ok(screen.includes("ctx.values.map(n => chip(n, cfg.ctxLen === n, 'lc-ctx', n))"));
  assert.ok(!screen.includes("sl('上下文长度', 'ctxLen', 2048, 32768"));
});

test('浅绿主色使用同色系文字渐变并保留控件阴影参数', () => {
  const css = read('css/app.css');
  const apk = read('js/screens/apk.js');
  assert.ok(css.includes('--c-leaf: #A9D6A9'));
  assert.ok(css.includes('--primary: var(--c-leaf-deep)'));
  assert.ok(css.includes('--grad-primary: linear-gradient(135deg, #E2F3E2 0%, #A9D6A9 100%)'));
  assert.ok(css.includes('--grad-text: linear-gradient(120deg, #83AA83 10%, #4A724A 90%)'));
  assert.ok(css.includes('--grad-text: linear-gradient(120deg, #D0E4D0 10%, #83AA83 90%)'));
  assert.ok(css.includes('--grad-hero: linear-gradient(118deg, #D9ECD9 0%, #DFF3EA 52%, #DCE8FB 100%)'));
  assert.ok(css.includes('--on-primary: #2E462E'));
  assert.ok(css.includes('#E7ECE7'));
  assert.ok(css.includes('var(--fill, 50%)'));
  assert.ok(css.includes('--glow-primary: 0 4px 10px -3px'));
  assert.ok(css.includes('--shadow-card: 0 4px 14px -6px'));
  assert.ok(css.includes('--shadow-float: 0 8px 22px -10px'));
  assert.ok(!css.includes('--bubble-relief'));
  assert.ok(!css.includes('--glass-relief'));
  assert.ok(!css.includes('--c-pink'));
  assert.ok(!css.includes('box-shadow: var(--shadow-card), var(--glow-soft);'));
  assert.ok(apk.includes('class="update-icon"'));
});

test('所有静态资源统一使用本轮版本号', () => {
  const html = read('index.html');
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert.ok(versions.length >= 20);
  assert.ok(versions.every(v => v === '103'));
});
