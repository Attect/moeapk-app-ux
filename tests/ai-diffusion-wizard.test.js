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

test('创作与结果画布使用主题表面，只有全屏查看器保留黑底', () => {
  const css = read('css/app.css');
  assert.match(css, /\.diff-workstage\s*\{[^}]*background:\s*var\(--surface-container\)/s);
  assert.doesNotMatch(css, /\.diff-workstage\s*\{[^}]*inverse-surface/s);
  assert.match(css, /\.diff-art-frame\s*\{[^}]*background:\s*var\(--surface-container\)/s);
  assert.match(css, /\.diff-art\s*\{[^}]*background:\s*var\(--surface-container\);[^}]*color:\s*var\(--on-surface\)/s);
  assert.match(css, /\.diff-stage-empty\s*\{[^}]*background:\s*var\(--surface-container\);[^}]*color:\s*var\(--on-surface-variant\)/s);
  assert.match(css, /\.diff-empty\s*\{[^}]*color:\s*var\(--on-surface-variant\)/s);
  assert.match(css, /\.diff-empty strong\s*\{[^}]*color:\s*var\(--on-surface\)/s);
  for (const selector of ['diff-stage-view > span', 'diff-mask-label', 'diff-zoom-badge', 'diff-fav']) {
    const rule = css.match(new RegExp('\\.' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
    assert.ok(rule, selector);
    assert.match(rule[1], /background:\s*var\(--surface-highest\)/, selector);
    assert.match(rule[1], /color:\s*var\(--on-surface\)/, selector);
    assert.doesNotMatch(rule[1], /rgba\(10,14,24|#fff/i, selector);
  }
  assert.ok(screen.includes('diff-block diff-prompt-block'));
  assert.match(css, /\.diff-viewer\s*\{[^}]*background:\s*#0a0712/s);
});

test('计算模式只有 CPU/GPU/NPU，CPU/MNN 路径使用真实 SD1.5 演示模型', () => {
  const block = screen.match(/const COMPUTE = \[(.*?)\];/s)[1];
  const ids = [...block.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['cpu', 'gpu', 'npu']);
  assert.ok(block.includes("engine: 'CPU 计算'"));
  assert.ok(block.includes("engine: 'MNN 计算'"));
  assert.ok(block.includes("engine: 'QNN / Hexagon 计算'"));
  assert.ok(!ids.includes('anima'));

  const generic = diffusionModels().find(m => m.id === 'anything-v5-mnn');
  assert.equal(generic.diffusion.family, 'Anything V5');
  assert.equal(generic.diffusion.architecture, 'SD1.5');
  assert.deepEqual(Array.from(generic.diffusion.backends), ['cpu', 'gpu']);
  assert.ok(!read('js/data/ai.js').includes('anima-xl-universal'));
  assert.ok(!read('js/data/ai.js').includes('Anima-XL-CPU-MNN'));
  for (const m of diffusionModels().filter(m => m.diffusion.family === 'Anima')) {
    assert.deepEqual(Array.from(m.diffusion.backends), ['npu'], '真实 Anima 仅允许 QNN PipelineAnima');
    assert.equal(m.diffusion.localImportOnly, true, 'Anima 展示只能来自明确标注的本地导入包');
  }
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
  assert.ok(screen.includes("['1:1', '4:3', '3:4', '16:9', '9:16']"), 'SDXL 模型宽高比能力仍保留');
  assert.match(screen, /nav\.push\('diff-image', ds\.arg\)/);
  assert.match(screen, /nav\.push\('diff-image', 'base:' \+ ds\.arg\)/);
});

test('创作页使用大输入框、文字按钮、页内收藏和真实提示词词表', () => {
  const css = read('css/app.css');
  assert.match(css, /textarea\.diff-prompt\s*\{[^}]*min-height:\s*156px/s);
  assert.match(css, /\.diff-media-editor \.mask-toolbar\s*\{[^}]*padding:\s*0 10px/s);
  for (const label of ['提示词库', '提示词词表', '图像反推']) assert.ok(screen.includes(label), label);
  for (const action of ['plib-save-current', 'plib-use-append', 'plib-delete', 'diff-vocabulary', 'vocab-download', 'vocab-query', 'vocab-use']) {
    assert.ok(screen.includes(`action('${action}'`), action);
  }
  assert.ok(!screen.includes("action('diff-prompt-check'"));
  assert.ok(screen.includes('个词未收录'));
  assert.ok(screen.includes('未收录：'));
  assert.ok(screen.includes('Danbooru 中文标签'));
  assert.ok(screen.includes('尚未下载完整标签词表'));
  assert.ok(screen.includes('约 194KB'));
  assert.ok(!screen.includes('不下载 388MB 反推模型'));
  assert.ok(!screen.includes('内置 50 条仅用于输入补全'));
  assert.ok(!screen.includes('模型PromptSuggestions') && !screen.includes('modelPromptSuggestions'));
  assert.ok(!screen.includes('当前模型推荐'));
});

test('检查结果与焦点词进入输入框底部状态条，负向提示词为可折叠项', () => {
  const css = read('css/app.css');
  // 状态条在输入框容器内部，用淡分割线与真实输入区隔开
  assert.match(screen, /<div class="diff-prompt-shell">/);
  assert.match(css, /\.diff-prompt-shell\s*\{[^}]*border:\s*1px solid var\(--outline-variant\)[^}]*border-radius:\s*8px/s);
  assert.match(css, /\.diff-prompt-status\s*\{[^}]*border-top:\s*1px solid color-mix\(in srgb, var\(--outline-variant\) 60%/s);
  assert.match(css, /\.diff-prompt-status\s*\{[^}]*justify-content:\s*space-between/s);
  // 左焦点词+翻译，右检查结果；点击展开明细而不是弹窗
  assert.match(screen, /class="diff-focus"/);
  assert.match(screen, /class="diff-check/);
  assert.match(screen, /action\('diff-status-toggle'/);
  assert.doesNotMatch(screen, /showDialog\(\{\s*title:\s*issues\.length/);
  // 负向提示词改为整行可折叠项
  assert.match(screen, /class="diff-collapse[^"]*"\s+data-a="diff-neg-toggle"\s+aria-expanded=/);
  assert.match(css, /\.diff-collapse\s*\{[^}]*width:\s*100%[^}]*cursor:\s*pointer/s);
  assert.ok(!screen.includes('diff-neg-head'));
});

test('生图原型保持纯静态，无网络或模块依赖', () => {
  assert.doesNotMatch(screen, /\bfetch\s*\(|\bimport\s*\(|https?:\/\//);
  assert.doesNotMatch(read('js/data/ai.js'), /\bfetch\s*\(|https?:\/\//);
  const html = read('index.html');
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert.ok(versions.length >= 20);
  assert.ok(versions.every(v => v === '96'));
});
