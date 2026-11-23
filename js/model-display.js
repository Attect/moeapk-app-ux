// 图片模型显示契约：同一基础模型的不同权重包（量化 / 后端 / 芯片桶）合并为一行，
// 行内再选具体版本；预览图跨变体按地址去重，相同样例只保留一份。
// 家族 + 主名（忽略大小写与空格）相同才算同一模型；DMD2、不同版本主名不同，不合并。
(function () {
  var FAMILY_WORDS = ['SD1.5', 'SDXL', 'DiT', 'Anima', 'Z-Image', 'Klein', 'FLUX', 'Qwen', 'Image', '2.1', 'Krea', 'Turbo'];
  var BACKEND_WORDS = ['CPU', 'GPU', 'NPU', 'QNN', 'MNN', 'OpenCL'];
  var PAREN = /（([^（）]*)）$/;

  // 家族口径与 App 一致：按架构（SD1.5 / SDXL / DiT…）分组，组内再按基础模型名分行。
  function family(model) {
    var diffusion = model && model.diffusion;
    if (diffusion && diffusion.architecture) return diffusion.architecture;
    if (diffusion && diffusion.family) return diffusion.family;
    return (model && model.name) || '其它模型';
  }

  function splitName(name, familyLabel) {
    var base = String(name || '');
    var segments = [];
    var m;
    while ((m = PAREN.exec(base))) {
      segments.push(m[1]);
      base = base.slice(0, m.index) + base.slice(m.index + m[0].length);
    }
    base = base.trim().replace(/[-·\s]+$/, '');
    var familyWords = FAMILY_WORDS.concat(String(familyLabel || '').split(/[\s-]+/).filter(Boolean));
    var tags = [];
    segments.forEach(function (segment) {
      segment.split('·').forEach(function (part) {
        var text = part.trim();
        if (!text) return;
        var tokens = text.split(/[\s，]+/).filter(Boolean);
        // 家族词与后端词已在组头/徽标体现，只有桶、量化位宽、派生说明才是区分信息
        if (tokens.some(function (token) {
          return familyWords.indexOf(token) < 0 && BACKEND_WORDS.indexOf(token) < 0;
        })) tags.push(text);
      });
    });
    return { base: base, tags: tags };
  }

  // 画风分档：二次元主题 App 里二次元模型排前、写实模型排后。
  // 判定只读目录自带的 summary 与模型名；混合风格（动漫×写实）与判定不出的归通用，
  // 与同档其它模型一起保持目录原顺序（稳定排序），不把不认识的模型乱插。
  var ANIME_SUMMARY = ['二次元', '动漫', '卡通', '萌系', '可爱', '插画'];
  var REAL_SUMMARY = ['写实', '真实', '人像', '照片'];
  var REAL_NAME = ['reality', 'realistic', 'realism', 'realvis', 'realisian', 'photo', 'chillout',
    'realskin', 'vision', 'epic', 'orange', 'xxx', 'reed', 'gonzalomo', 'shaper', 'majicmix'];
  var ANIME_NAME = ['anime', 'anything', 'cute', 'yuki', 'kemono', 'furry', 'pony', 'illustrious', 'noobai',
    'novelai', 'anim', 'toon', 'chibi', 'moe', 'harem', 'ppanimix', 'chenkinnoob', 'featherfall',
    'flanime', 'animepopcute', 'sushi', 'meina', 'mistoon', 'nai', 'counterfeit', 'qtea',
    'unholy', 'fabled', 'lustify', 'biglust', 'oneobsession', 'hdarainbow', 'rawdiance',
    'rawb2diance', 'lemonsugar', 'bsse', 'perfect', 'prefect', 'illustrij', 'miaomiao', 'mix',
    'sweet', 'obsidian'];
  var STYLE_RANK = { '二次元': 0, '通用': 1, '写实': 2 };

  function styleOf(model) {
    var summary = String((model && model.summary) || '').toLowerCase();
    var anime = ANIME_SUMMARY.some(w => summary.indexOf(w) >= 0);
    var real = REAL_SUMMARY.some(w => summary.indexOf(w) >= 0);
    if (anime && real) return '通用';
    if (real) return '写实';
    if (anime) return '二次元';
    var name = String((model && (model.id + ' ' + model.name)) || '').toLowerCase();
    if (REAL_NAME.some(w => name.indexOf(w) >= 0)) return '写实';
    if (ANIME_NAME.some(w => name.indexOf(w) >= 0)) return '二次元';
    return '通用';
  }

  function styleLabel(model) {
    var style = styleOf(model);
    return style === '通用' ? '' : style;
  }

  function normalize(name) { return String(name || '').replace(/\s+/g, '').toLowerCase(); }

  function backendLabel(model) {
    var backends = (model && model.diffusion && model.diffusion.backends) || [];
    if (backends.indexOf('cpu') >= 0 || backends.indexOf('gpu') >= 0) return 'MNN CPU';
    if (backends.indexOf('npu') >= 0) return 'QNN NPU';
    return '';
  }

  function samplesOf(model) {
    if (!model || !Array.isArray(model.samples)) return [];
    return model.samples.map(function (sample) {
      if (typeof sample === 'string') return sample ? { thumb: sample, image: sample } : null;
      if (!sample || typeof sample !== 'object' || !sample.image) return null;
      return { thumb: sample.thumb || sample.image, image: sample.image };
    }).filter(Boolean);
  }

  function versionTail(id) {
    var m = /v(\d{2,})$/.exec(String(id || ''));
    if (!m) return null;
    var digits = m[1];
    return 'v' + digits.slice(0, -1) + '.' + digits.slice(-1);
  }

  function commonPrefix(ids) {
    if (!ids.length) return '';
    var prefix = ids[0];
    ids.slice(1).forEach(function (id) {
      var i = 0;
      while (i < prefix.length && i < id.length && prefix[i] === id[i]) i++;
      prefix = prefix.slice(0, i);
    });
    return prefix;
  }

  /** 分组：键 = 家族 + 归一化主名；组内保持目录顺序。 */
  function group(models) {
    var byKey = [];
    (models || []).forEach(function (model) {
      var fam = family(model);
      var split = splitName(model.name, fam);
      var key = fam + '|' + normalize(split.base);
      var bucket = byKey.find(function (entry) { return entry.key === key; });
      if (!bucket) {
        bucket = { key: key, family: fam, base: split.base, items: [] };
        byKey.push(bucket);
      }
      bucket.items.push({ model: model, base: split.base, tags: split.tags });
    });
    return byKey.map(function (bucket) {
      var raw = bucket.items.map(function (item) {
        var backend = (item.model && item.model.kind) === 'diffusion' ? backendLabel(item.model) : '';
        return [item.tags.join(' · '), backend].filter(Boolean).join(' · ');
      });
      var counts = {};
      raw.forEach(function (label) { counts[label] = (counts[label] || 0) + 1; });
      var idPrefix = commonPrefix(bucket.items.map(function (item) { return item.model.id; }));
      var labels = bucket.items.map(function (item, index) {
        if (counts[raw[index]] === 1) return raw[index];
        if (item.base !== bucket.base) return (item.base + ' · ' + raw[index]).trim();
        var version = versionTail(item.model.id);
        return version ? raw[index] + ' · ' + version : raw[index];
      });
      var finalCounts = {};
      labels.forEach(function (label) { finalCounts[label] = (finalCounts[label] || 0) + 1; });
      var variants = bucket.items.map(function (item, index) {
        var label = labels[index];
        if (finalCounts[label] > 1) {
          var tail = item.model.id.slice(idPrefix.length).replace(/^[-_]+/, '') || item.model.id;
          label = label + ' · ' + tail;
        }
        return { model: item.model, label: label, tags: item.tags };
      });
      // 预览图跨变体按地址去重：相同样例只留一份，最多四张
      var samples = [];
      var seen = {};
      variants.forEach(function (variant) {
        samplesOf(variant.model).forEach(function (sample) {
          var key = sample.thumb + '|' + sample.image;
          if (seen[key] || samples.length >= 4) return;
          seen[key] = true;
          samples.push(sample);
        });
      });
      var style = styleOf(bucket.items[0].model);
      return {
        family: bucket.family, title: bucket.base, variants: variants, samples: samples,
        style: style, styleLabel: style === '通用' ? '' : style,
        order: byKey.indexOf(bucket)
      };
    });
    // 家族内按画风排序（二次元 → 通用 → 写实）；同档保持目录原顺序（稳定排序）
    var byFamily = [];
    grouped.forEach(function (g) {
      var slot = byFamily.find(entry => entry.family === g.family);
      if (!slot) { slot = { family: g.family, items: [] }; byFamily.push(slot); }
      slot.items.push(g);
    });
    var out = [];
    byFamily.forEach(function (slot) {
      slot.items.slice().sort((a, b) => (STYLE_RANK[a.style] - STYLE_RANK[b.style]) || (a.order - b.order))
        .forEach(g => out.push(g));
    });
    return out;
  }

  window.ModelGroups = { family: family, splitName: splitName, group: group, samplesOf: samplesOf, backendLabel: backendLabel, styleOf: styleOf, styleLabel: styleLabel };
})();
