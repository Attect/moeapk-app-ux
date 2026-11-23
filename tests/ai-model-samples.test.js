// 运行：node --test tests/ai-model-samples.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const esc = value => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function samplesApi() {
  const context = { window: {}, esc };
  vm.createContext(context);
  vm.runInContext(read('js/model-samples.js'), context);
  return context;
}

function aiData() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/data/ai.js'), context);
  return context.window.DB.AI;
}

test('samples 新旧格式统一，过滤无效项且最多返回四张', () => {
  const context = samplesApi();
  const api = context.window.ModelSamples;
  const model = { id: 'repo/model', name: '演示模型', samples: [
    'legacy.webp',
    { thumb: 'one-200.webp', image: 'one-1024.webp', info: 'one.json' },
    { thumb: 'missing-image.webp' }, null,
    { image: 'two-512.webp' },
    { thumb: 'three-200.webp', image: 'three-1024.webp' },
    { image: 'four-512.webp' },
    { image: 'fifth-512.webp' }
  ] };
  const list = api.list(model);
  assert.equal(list.length, 4);
  assert.deepEqual(Array.from(list, item => item.image), ['legacy.webp', 'one-1024.webp', 'two-512.webp', 'three-1024.webp']);
  assert.equal(list[0].thumb, 'legacy.webp', '旧字符串同时作为 image 与回退 thumb');
  assert.equal(list[1].thumb, 'one-200.webp');
  assert.equal(list[1].info, 'one.json');
  assert.equal(list[2].thumb, 'two-512.webp', '对象缺省 thumb 时回退 image');

  context.window.DB = { AI: [model] };
  const ref = api.ref(model, 1);
  assert.equal(ref, 'sample:repo%2Fmodel:1', '模型 key 中的路径分隔符不得进入路由');
  const resolved = api.read(ref);
  assert.equal(resolved.model, model);
  assert.equal(resolved.sample.image, 'one-1024.webp');
  assert.equal(resolved.count, 4);
  assert.equal(api.read('sample:repo%2Fmodel:4'), null, '第五张不可通过路由绕过四张上限');
  assert.equal(api.read('sample:other:0'), null, '不得跨模型借用样例');
});

test('无样例不输出容器，缩略图按钮只引用 thumb 并携带原图路由', () => {
  const context = samplesApi();
  const api = context.window.ModelSamples;
  assert.equal(api.html({ id: 'empty', samples: [] }), '');
  assert.equal(api.html({ id: 'missing' }), '');
  const html = api.html({ id: 'm', name: 'M', samples: [
    { thumb: 'small-200.webp', image: 'large-1024.webp', info: 'private.json' },
    { thumb: 'small2-200.webp', image: 'large2-512.webp', info: 'private2.json' }
  ] });
  assert.equal((html.match(/class="model-sample"/g) || []).length, 2);
  assert(html.includes('src="small-200.webp"'));
  assert(!html.includes('src="large-1024.webp"'));
  assert(html.includes('data-arg="sample:m:0"'));
  assert(html.includes('width="200" height="200"'));
  assert(!html.includes('private.json'), '生成信息 URL 不进入界面');
});

test('演示目录按模型提供独立样例，所有资源与 info JSON 均在本地存在', () => {
  const models = aiData().filter(m => m.type === 'model' && m.kind === 'diffusion');
  const anything = models.find(m => m.id === 'anything-v5-mnn');
  const animagine = models.find(m => m.id === 'animagine-v4-sdxl');
  const chillout = models.find(m => m.id === 'chillout-mix-qnn');
  assert.equal(anything.samples.length, 4);
  assert.equal(animagine.samples.length, 3);
  assert(!Array.isArray(chillout.samples) || chillout.samples.length === 0, '保留无样例模型走查入口');

  for (const model of [anything, animagine]) {
    for (const sample of model.samples) {
      for (const key of ['thumb', 'image', 'info']) {
        assert.equal(typeof sample[key], 'string', `${model.id}.${key}`);
        assert(!/^https?:/i.test(sample[key]), '不得依赖外部图片或生成信息接口');
        assert(fs.existsSync(path.join(root, sample[key])), sample[key]);
      }
      assert(sample.thumb.endsWith('-200.webp'));
      assert(/-(512|1024)\.webp$/.test(sample.image));
      const info = JSON.parse(read(sample.info));
      assert.equal(info.width, info.height);
      assert([512, 1024].includes(info.width));
      assert(sample.image.endsWith(`-${info.width}.webp`));
    }
  }
});

test('模型中心与生图向导复用同一样例组件和已有全屏查看页', () => {
  const hub = read('js/screens/ai-models.js');
  const diffusion = read('js/screens/ai-diffusion.js');
  assert(hub.includes("m.kind === 'diffusion' ? ModelSamples.html(m) : ''"));
  assert(hub.includes("kl === '生图' ? ModelSamples.html(m) : ''"));
  assert(diffusion.includes('ModelSamples.html(m)'));
  assert(diffusion.includes("action('diff-open-sample'"));
  assert(diffusion.includes("nav.push('diff-image', ds.arg)"));
  assert(diffusion.includes('ModelSamples.read(value)'));
  assert(diffusion.includes('class="diff-viewer-image"'));
  assert(!diffusion.includes('sampleView.sample.info'), '本任务不展示生成信息');

  const css = read('css/app.css');
  assert.match(css, /\.model-samples\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.model-sample\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
  assert.match(css, /\.model-sample img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(css, /\.diff-viewer-stage\.original \.diff-viewer-image\s*\{[^}]*max-width:\s*none;[^}]*max-height:\s*none/s);

  const html = read('index.html');
  assert(html.indexOf('js/model-samples.js') < html.indexOf('js/screens/ai-diffusion.js'));
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
  assert(versions.length >= 20 && versions.every(v => v === '99'));
});
