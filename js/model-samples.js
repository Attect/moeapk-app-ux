// 图片模型样例：目录数据归一化、最多四张缩略图与查看器路由参数。
// 新格式：samples: [{ thumb, image, info }]；旧字符串按原图处理，缩略图回退为同一地址。
(function () {
  function list(model) {
    if (!model || !Array.isArray(model.samples)) return [];
    return model.samples.map(sample => {
      if (typeof sample === 'string') return sample ? { thumb: sample, image: sample, info: '' } : null;
      if (!sample || typeof sample !== 'object' || typeof sample.image !== 'string' || !sample.image) return null;
      return {
        thumb: typeof sample.thumb === 'string' && sample.thumb ? sample.thumb : sample.image,
        image: sample.image,
        info: typeof sample.info === 'string' ? sample.info : ''
      };
    }).filter(Boolean).slice(0, 4);
  }

  function modelKey(model) { return model && (model.id || model.name) || ''; }
  function ref(model, index) { return 'sample:' + encodeURIComponent(modelKey(model)) + ':' + index; }

  function read(value) {
    if (typeof value !== 'string' || value.indexOf('sample:') !== 0) return null;
    const body = value.slice(7), split = body.lastIndexOf(':');
    if (split < 1) return null;
    const index = Number(body.slice(split + 1));
    if (!Number.isInteger(index) || index < 0) return null;
    let key;
    try { key = decodeURIComponent(body.slice(0, split)); } catch (e) { return null; }
    const db = window.DB || {};
    const models = (db.AI || []).concat(db.MODEL_SEARCH_DEMO || []);
    const model = models.find(m => modelKey(m) === key);
    const samples = list(model);
    if (!model || !samples[index]) return null;
    return { model, sample: samples[index], index, count: samples.length };
  }

  function view(value) {
    const selected = read(value);
    if (!selected) return null;
    const model = selected.model;
    return {
      model,
      index: selected.index,
      items: list(model).map((sample, index) => ({
        id: ref(model, index), kind: 'image', image: sample.image,
        label: model.name + ' · 样例 ' + (index + 1),
        modelName: model.name, sampleIndex: index, sample: true
      }))
    };
  }

  function html(model) {
    const samples = list(model);
    if (!samples.length) return '';
    const name = (model && model.name) || '图片模型';
    return '<div class="model-samples">' + samples.map((sample, index) => {
      const label = '查看 ' + name + ' 的第 ' + (index + 1) + ' 张样例原图';
      return '<button type="button" class="model-sample" data-a="av-open-sample" data-arg="' + esc(ref(model, index)) + '"' +
        ' aria-label="' + esc(label) + '" title="查看原图">' +
        '<img src="' + esc(sample.thumb) + '" alt="" width="200" height="200" loading="lazy" decoding="async" draggable="false">' +
        '</button>';
    }).join('') + '</div>';
  }

  window.ModelSamples = { list, html, read, view, ref };
})();
