// 运行：node --test tests/ai-diffusion-model-picker.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const screen = read('js/screens/ai-diffusion.js');
const modelCenter = read('js/screens/ai-models.js');
const css = read('css/app.css');

function functionBody(name, nextName) {
  const start = screen.indexOf(`function ${name}(`);
  const end = screen.indexOf(`function ${nextName}(`, start + 1);
  assert(start >= 0 && end > start, `${name} → ${nextName} source range`);
  return screen.slice(start, end);
}

test('有本机模型时默认已下载，无本机模型时默认全部，手动选择不被重绘覆盖', () => {
  assert.match(screen, /d\.modelView !== 'downloaded' && d\.modelView !== 'all'/);
  assert.match(screen, /d\.modelView = readyGroups\.length \? 'downloaded' : 'all'/);
  assert.match(screen, /data-a="diff-model-view" data-arg="downloaded"/);
  assert.match(screen, /data-a="diff-model-view" data-arg="all"/);
  const action = screen.match(/action\('diff-model-view',[\s\S]*?\n  \}\);/);
  assert(action, '模型范围动作存在');
  assert(!action[0].includes('modelId =') && !action[0].includes('afterRenderGo') && !action[0].includes('goStep('),
    '切换可见范围不得改选模型或自动前进');
  assert(action[0].includes('modelViewTouched = true'));
  assert.match(screen, /if \(!d\.modelViewTouched\) d\.modelView = 'downloaded'/);
  assert(screen.includes('还没有已下载的生图模型') && screen.includes('浏览全部模型'));
});

test('先按组合并再筛选权重包，已选包优先且非首包已下载也能直接显示', () => {
  assert.match(screen, /const groups = window\.ModelGroups\.group\(DIFF_MODELS\)/);
  assert.match(screen, /const variants = g\.variants\.filter\(v => modelReady\(v\.model\)\)/);
  const body = functionBody('modelGroupHtml', 'variantChipsHtml');
  assert(body.includes('[d.modelId, d.modelPreviewId]'));
  assert(body.indexOf('g.variants.find(v => modelReady(v.model))') < body.indexOf('|| g.variants[0]'));
  assert(body.includes('compact ? localModelRow'));
  assert.match(screen, /visibleGroups\.sort/);
});

test('已下载使用紧凑本机卡片，全部模型继续提供完整样例和下载状态', () => {
  const local = functionBody('localModelRow', 'modelRow');
  assert(local.includes('diff-local-cover') && local.includes('diff-local-package'));
  assert(local.includes("selected ? '继续' : '使用'"));
  assert(!local.includes('ModelSamples.groupHtml'), '本机快速选择不重复四张样例');
  const allRow = screen.slice(screen.indexOf('function modelRow('), screen.indexOf("action('diff-model-view'"));
  assert(allRow.includes('ModelSamples.groupHtml(g)'));
  assert(allRow.includes('diff-ready-tag') && allRow.includes('data-ready='));
  assert(screen.includes("ready ? '已下载' : (j && !j.done ? '下载中' : '未下载')"));
  assert(screen.includes("(ready ? icon('check') : '')"), '已下载权重包有非纯颜色标记');
});

test('模型中心与生图页共享本机状态，下载完成才选用且下一步校验真实就绪', () => {
  const ready = functionBody('modelReady', 'ensureLocalModel');
  assert(ready.includes('S.x.localModels') && ready.includes("'diff-mdl-', 'rec-dl-'"));
  assert.match(screen, /ensureLocalModel\(m\);/);
  assert.match(screen, /const canUse = cur && cur\.page === 'diffusion' && current\.step === 0/);
  assert.match(screen, /current\.modelSelectionVersion \|\| 0\) === selectionVersion && current\.modelPreviewId === m\.id/);
  assert.match(screen, /if \(canUse\) useDownloadedModel\(m\); else render\(\);/);
  assert.match(screen, /if \(!modelReady\(modelOf\(d\.modelId\)\)\) \{ toast\('请先下载并选择生图模型'\)/);
  assert.match(screen, /const downloadingModel = DIFF_MODELS\.some/);
  assert.match(screen, /const stepScroll = \(activeJob && !activeJob\.done\) \|\| downloadingModel/);
  assert.match(screen, /if \(next === 0\) requestAnimationFrame\(revealSelectedModel\)/);
});

test('后台下载不覆盖更新的选择，删除与清理同步撤销历史完成态', () => {
  assert.match(screen, /d\.modelSelectionVersion = \(d\.modelSelectionVersion \|\| 0\) \+ 1/);
  assert.match(screen, /d\.modelId = p\.modelId; d\.modelPreviewId = p\.modelId;/);
  assert(modelCenter.includes('function clearModelDownloadState(models)'));
  assert(modelCenter.includes("mock.resetJob('diff-mdl-' + m.id)"));
  assert(modelCenter.includes("mock.resetJob('rec-dl-' + m.id)"));
  assert(modelCenter.includes('clearModelDownloadState(unused)'));
  assert(modelCenter.includes('clearModelDownloadState([removed])'));
});

test('模型范围栏吸顶、家族标题横跨双列，紧凑卡片与空态使用既有设计令牌', () => {
  assert.match(css, /\.diff-model-scope\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.diff-family\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.diff-family\s*\{[^}]*background:\s*var\(--bg\)/s);
  assert.match(css, /\.diff-local-cover\s*\{[^}]*background:\s*var\(--surface-highest\)/s);
  assert.match(css, /\.diff-model-empty\s*\{[^}]*background:\s*var\(--surface-low\)/s);
  assert.match(css, /@container \(min-width: 720px\)\s*\{[\s\S]*?\.diff-models\s*\{\s*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@container \(max-width: 380px\)\s*\{[\s\S]*?\.diff-local-cover\s*\{\s*width:\s*48px;\s*height:\s*48px/s);
});
