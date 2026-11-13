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

test('视觉令牌使用低饱和主色、轻量阴影和统一更新卡', () => {
  const css = read('css/app.css');
  const apk = read('js/screens/apk.js');
  assert.ok(css.includes('--c-pink: #E5A8C0'));
  assert.ok(css.includes('--grad-primary: linear-gradient(135deg, #F4D2DF 0%, #E5A8C0 100%)'));
  assert.ok(css.includes('--on-primary: #4F2738'));
  assert.ok(css.includes('#E7DFE8'));
  assert.ok(css.includes('var(--fill, 50%)'));
  assert.ok(css.includes('--glow-primary: 0 4px 10px -3px'));
  assert.ok(!css.includes('box-shadow: var(--shadow-card), var(--glow-soft);'));
  assert.ok(apk.includes('class="update-icon"'));
});

test('所有静态资源统一使用本轮版本号', () => {
  const html = read('index.html');
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert.ok(versions.length >= 20);
  assert.ok(versions.every(v => v === '75'));
});
