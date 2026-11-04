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

test('所有静态资源统一使用本轮版本号', () => {
  const html = read('index.html');
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert.ok(versions.length >= 20);
  assert.ok(versions.every(v => v === '59'));
});
