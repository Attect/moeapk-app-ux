// 运行：node --test tests/ai-diffusion-wizard.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const screen = read('js/screens/ai-diffusion.js');

function diffusionModels() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/data/ai.js'), context);
  return context.window.DB.AI.filter(m => m.type === 'model' && m.kind === 'diffusion');
}

test('生图是独立全屏五步向导，并提供独立图片查看页', () => {
  assert.match(screen, /registerScreen\('diffusion', \{ title: '图片生成', full: true, render: diffPage \}\)/);
  assert.match(screen, /registerScreen\('diff-image', \{ title: '查看图片', full: true, render: diffImagePage \}\)/);
  for (const title of ['模型与生成方式', '计算模式', '创作输入', '生成参数', '生成结果']) {
    assert.ok(screen.includes(`title: '${title}'`), title);
  }
  assert.match(screen, /scrollTo\(\{ left, behavior:/);
  assert.match(screen, /e\.target\.id !== 'diff-pager'/);
  const css = read('css/app.css');
  assert.match(css, /\.diff-pager\s*\{[^}]*scroll-snap-type:\s*x mandatory/s);
  assert.match(css, /\.diff-step\s*\{[^}]*flex:\s*0 0 100%/s);
});

test('计算模式只有 CPU/GPU/NPU，Anima 仅作为模型家族元数据', () => {
  const block = screen.match(/const COMPUTE = \[(.*?)\];/s)[1];
  const ids = [...block.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['cpu', 'gpu', 'npu']);
  assert.ok(block.includes("engine: 'CPU 计算'"));
  assert.ok(block.includes("engine: 'MNN 计算'"));
  assert.ok(block.includes("engine: 'QNN / Hexagon 计算'"));
  assert.ok(!ids.includes('anima'));

  const generic = diffusionModels().find(m => m.id === 'anima-xl-universal');
  assert.equal(generic.diffusion.family, 'Anima');
  assert.deepEqual(Array.from(generic.diffusion.backends), ['cpu', 'gpu']);
});

test('每个生图模型显式声明真实后端与高通代际约束', () => {
  const models = diffusionModels();
  assert.ok(models.length >= 3);
  for (const m of models) {
    assert.ok(m.diffusion && Array.isArray(m.diffusion.backends), m.id);
    assert.ok(m.diffusion.backends.length > 0, m.id);
    assert.ok(m.diffusion.backends.every(b => ['cpu','gpu','npu'].includes(b)), m.id);
    if (m.diffusion.backends.includes('npu')) {
      assert.equal(m.diffusion.npuVendor, 'Qualcomm', m.id);
      assert.ok(m.diffusion.minGeneration >= 2, m.id);
    }
  }
  assert.match(screen, /无法计算 · NPU 仅对应 QNN \/ Hexagon/);
  assert.match(screen, /模型要求 ' \+ req\.npuVendor/);
});

test('采样步数已去滑杆，保留数字输入和加减按钮', () => {
  assert.match(screen, /type="number" inputmode="numeric" min="1" max="150" step="1" value="' \+ d\.steps \+ '" data-live="diff-steps"/);
  assert.match(screen, /data-a="diff-step-delta" data-arg="-1"/);
  assert.match(screen, /data-a="diff-step-delta" data-arg="1"/);
  assert.doesNotMatch(screen, /type="range"[^>]+data-live="diff-steps"/);
});

test('原有生图细节能力在向导中仍有真实动作入口', () => {
  for (const action of [
    'diff-prompt-lib', 'diff-caption', 'tag-inc', 'tag-undo', 'diff-sweep-open',
    'diff-hires', 'dc-preview', 'dc-tile', 'diff-seed-lock', 'diff-mask-erase',
    'diff-as-template', 'diff-rerun', 'diff-stop-after', 'diff-hist-undo',
    'diff-save-asset', 'diff-save-album', 'diff-share', 'dc-debug-fail'
  ]) assert.ok(screen.includes(`action('${action}'`), action);
  assert.ok(screen.includes("['DPM++ 2M', 'DPM++ 2M Karras', 'DPM++ 2M SDE'"));
  assert.match(screen, /nav\.push\('diff-image', ds\.arg\)/);
  assert.match(screen, /nav\.push\('diff-image', 'base:' \+ ds\.arg\)/);
});

test('生图原型保持纯静态，无网络或模块依赖', () => {
  assert.doesNotMatch(screen, /\bfetch\s*\(|\bimport\s*\(|https?:\/\//);
  assert.doesNotMatch(read('js/data/ai.js'), /\bfetch\s*\(|https?:\/\//);
  const html = read('index.html');
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert.ok(versions.length >= 20);
  assert.ok(versions.every(v => v === '80'));
});
