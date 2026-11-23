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
    return '<div class="model-samples">' + samples.map((sample, index) => sampleButton(model, sample, index, name)).join('') + '</div>';
  }

  /**
   * 分组行的预览：组内跨变体去重后的样例（相同预览只留一份）。
   * 每张样例按「首个持有它的变体 + 该变体内的序号」生成引用，查看器数据源不变。
   */
  function groupHtml(group) {
    const samples = (group && group.samples) || [];
    if (!samples.length) return '';
    const title = (group && group.title) || '图片模型';
    const buttons = samples.map((sample, i) => {
      const hit = (group.variants || []).map(v => ({ model: v.model, samples: list(v.model) }))
        .find(entry => entry.samples.some(s => s.thumb === sample.thumb && s.image === sample.image));
      const index = hit ? hit.samples.findIndex(s => s.thumb === sample.thumb && s.image === sample.image) : 0;
      const label = '查看 ' + title + ' 的第 ' + (i + 1) + ' 张样例原图';
      return '<button type="button" class="model-sample" data-a="av-open-sample" data-arg="' + esc(ref(hit.model, index)) + '"' +
        ' aria-label="' + esc(label) + '" title="查看原图">' +
        '<img src="' + esc(sample.thumb) + '" alt="" width="200" height="200" loading="lazy" decoding="async" draggable="false">' +
        '</button>';
    }).join('');
    return '<div class="model-samples">' + buttons + '</div>';
  }

  function sampleButton(model, sample, index, name) {
    const label = '查看 ' + name + ' 的第 ' + (index + 1) + ' 张样例原图';
    return '<button type="button" class="model-sample" data-a="av-open-sample" data-arg="' + esc(ref(model, index)) + '"' +
      ' aria-label="' + esc(label) + '" title="查看原图">' +
      '<img src="' + esc(sample.thumb) + '" alt="" width="200" height="200" loading="lazy" decoding="async" draggable="false">' +
      '</button>';
  }

  window.ModelSamples = { list, html, groupHtml, read, view, ref };
})();
