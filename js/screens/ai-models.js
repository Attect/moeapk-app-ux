// 模型中心 + 模型搜索子页。对应 ui/ai/ModelHubScreen.kt、ModelSearchScreen.kt
// 第四轮重设计：分类 Tab（对话/生图/语音/放大/点云）+ 用途/格式标签 + 就地过滤搜索 +
// 明确的「找模型」入口（带关键词直达搜索页）；存储占用卡与清理保留（F11）。
(function () {
  const { jobBar } = window._aiShared;

  // 统一标签体系：kind → 用途标签；格式从引擎/文件名推断
  const KIND_LABEL = { llm: '对话', diffusion: '生图', tts: '语音', 'tts-encoder': '语音', upscale: '放大', sharp: '点云' };
  const CATS = [['all', '全部'], ['llm', '对话'], ['diffusion', '生图'], ['tts', '语音'], ['upscale', '放大'], ['sharp', '点云']];
  function fmtOfEngine(m) {
    const e = m.engine || '';
    if (e === 'llm-fork') return 'GGUF';
    if (e === 'onnxruntime') return 'ONNX';
    if (e === 'sd-localdream') return /\.zip$/i.test((m.parts && m.parts[0] && m.parts[0].name) || '') ? (/qnn/i.test(m.parts[0].name) ? 'QNN' : 'MNN') : 'MNN';
    if (e === 'sharp-qnn' || e === 'sharp-cpu') return 'DLC';
    if (e === 'sharp-mnn') return 'MNN';
    return '';
  }
  function fmtOfName(name) {
    const n = (name || '').toLowerCase();
    if (n.endsWith('.gguf')) return 'GGUF';
    if (n.endsWith('.onnx')) return 'ONNX';
    if (n.endsWith('.mnn')) return 'MNN';
    if (n.endsWith('.dlc')) return 'DLC';
    if (n.endsWith('.bin')) return 'BIN';
    if (n.endsWith('.zip')) return 'ZIP';
    return '';
  }
  function kindOfLocal(m) {
    // 本地模型的用途标签：优先显式 kind（中文或英文 key），再按格式猜
    if (!m.kind) return '';
    const k = KIND_LABEL[m.kind] || m.kind;
    if (/对话|生图|语音|放大|点云/.test(k)) return k;
    if (/llm|对话/i.test(k)) return '对话';
    if (/diffusion|生图|图像/i.test(k)) return '生图';
    if (/tts|语音/i.test(k)) return '语音';
    if (/upscale|放大/i.test(k)) return '放大';
    return k;
  }
  function tagsHtml(kind, fmt) {
    let h = '';
    if (kind) h += '<span class="achip tag-kind">' + esc(kind) + '</span>';
    if (fmt) h += '<span class="achip">' + esc(fmt) + '</span>';
    return h;
  }
  function matchCat(kindLabel, cat) {
    if (cat === 'all') return true;
    const map = { '对话': 'llm', '生图': 'diffusion', '语音': 'tts', '放大': 'upscale', '点云': 'sharp' };
    return map[kindLabel] === cat;
  }

  // ---------- 模型中心（子页；F11 存储占用视角） ----------
  registerScreen('models', {
    title: '模型中心',
    render() {
      const local = S.x.localModels = S.x.localModels || [];
      const cat = S.x.mdlCat || 'all';
      const q = ((S.x.keep && S.x.keep['mdl-q']) || '').trim().toLowerCase();
      const sorted = S.x.mdlSort === 'size' ? local.slice().sort((a, b) => b.size - a.size)
        : S.x.mdlSort === 'name' ? local.slice().sort((a, b) => a.name.localeCompare(b.name)) : local;
      const total = local.reduce((s, m) => s + m.size, 0);

      // 分类 + 过滤
      const localFiltered = sorted.filter(m => {
        const kl = kindOfLocal(m);
        if (!matchCat(kl, cat)) return false;
        if (q && m.name.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      const rec = DB.AI.filter(m => m.type === 'model');
      const recFiltered = rec.filter(m => {
        if (!matchCat(KIND_LABEL[m.kind] || '', cat)) return false;
        if (q && m.name.toLowerCase().indexOf(q) < 0 && (m.summary || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });

      let h = '';
      // F11：存储占用卡（总大小 / 数量 / 清理入口）
      h += card('<div class="dl-row"><div style="flex:1"><div class="li-title">模型存储占用</div>' +
        '<div class="li-sub">' + (local.length ? local.length + ' 个模型 · 共 ' + fmtSize(total) : '暂无本地模型') + '</div></div>' +
        (local.length ? textBtn('清理', 'models-clean') : '') + '</div>' +
        (local.length ? '<div style="margin-top:8px">' + progress(Math.min(1, total / 8e9)) + '<div class="muted" style="font-size:11px;margin-top:4px">约 ' + fmtSize(total) + ' / 建议预留 8 GB 模型分区</div></div>' : ''));

      // 分类 Tab + 就地过滤
      h += '<div class="chip-row" style="position:sticky;top:-8px;z-index:3;background:var(--bg);padding-top:10px">' +
        CATS.map(c => chip(c[1], cat === c[0], 'mdl-cat', c[0])).join('') + '</div>';
      h += card('<div class="msg-row" style="margin-top:0">' + icon('search', 'small') +
        '<input class="field-input" style="flex:1" data-keep="mdl-q" placeholder="过滤模型名称…" value="' + esc((S.x.keep && S.x.keep['mdl-q']) || '') + '"></div>' +
        '<div style="padding:0 12px 10px;display:flex;gap:8px;align-items:center">' + textBtn('＋ 从手机导入', 'models-import') +
        '<span class="muted" style="font-size:11px;flex:1;text-align:right">排序：</span>' +
        chip('时间', S.x.mdlSort !== 'size' && S.x.mdlSort !== 'name', 'mdl-sort', 'time') +
        chip('大小', S.x.mdlSort === 'size', 'mdl-sort', 'size') +
        chip('名称', S.x.mdlSort === 'name', 'mdl-sort', 'name') + '</div>');

      // 我的模型（分类 + 标签）
      h += sectionTitle('我的模型' + (q || cat !== 'all' ? ' · ' + localFiltered.length + ' 个' : ''));
      h += localFiltered.length ? '<div class="card tight" style="padding:0;margin-top:0">' + localFiltered.map((m) => {
        const idx = local.indexOf(m);
        const kl = kindOfLocal(m), fmt = m.fmt || fmtOfName(m.name);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + fmtSize(m.size) + ' · ' + esc(m.src) + '</div>' +
          '<div class="tag-row">' + tagsHtml(kl, fmt) + '</div></div>' +
          textBtn('删除', 'models-del', idx, 'danger') + '</div>';
      }).join('') + '</div>'
        : (local.length ? emptyHint('当前分类/过滤条件下没有模型') :
          card('<div class="muted small" style="padding:14px">还没有本地模型。下载推荐模型、从搜索页获取，或点「从手机导入」添加自己的模型文件。</div>'));

      // 推荐模型（分类 + 标签）
      h += sectionTitle('推荐模型' + (q || cat !== 'all' ? ' · ' + recFiltered.length + ' 个' : ''));
      h += recFiltered.length ? '<div class="card tight" style="padding:0;margin-top:0">' + recFiltered.map(m => {
        const size = m.parts.reduce((x, p) => x + p.size, 0);
        const j = mock.job('rec-dl-' + m.id);
        const ready = (S.x.localModels || []).some(l => l.id === m.id) || (j && j.done);
        let trail;
        if (ready) trail = '<span class="badge soft">已就绪</span>';
        else if (j) trail = '<div style="width:90px">' + progress(j.p) + '</div>';
        else trail = textBtn('下载', 'rec-dl', m.id);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + esc(m.summary) + ' · ' + fmtSize(size) + '</div>' +
          '<div class="tag-row">' + tagsHtml(KIND_LABEL[m.kind] || m.kind, fmtOfEngine(m)) + '</div></div>' + trail + '</div>';
      }).join('') + '</div>' : emptyHint('当前分类/过滤条件下没有推荐模型');

      // 找模型：带关键词直达搜索页（替代原来难懂的"打开模型搜索"）
      const src = S.x.msrc || '全部';
      h += sectionTitle('找模型');
      h += card('<div class="msg-row" style="margin-top:0">' +
        '<input class="field-input" style="flex:1" data-keep="find-q" placeholder="在魔塔社区 / HF 镜像 / HuggingFace 搜模型…" value="' + esc((S.x.keep && S.x.keep['find-q']) || '') + '"></div>' +
        '<div class="chip-row" style="padding-top:0">' + ['全部', '魔塔社区', 'HF 镜像', 'HuggingFace'].map(x =>
          chip(x, src === x, 'mdl-src', x)).join('') + '</div>' +
        '<div style="padding:0 12px 12px">' + btn('搜索模型库', 'models-find', null, 'small block') + '</div>');
      return h;
    }
  });
  action('mdl-cat', ds => { S.x.mdlCat = ds.arg; render(); });
  action('mdl-src', ds => { S.x.msrc = ds.arg; render(); });
  action('mdl-sort', ds => { S.x.mdlSort = ds.arg; render(); });
  // 输入即过滤（data-keep 写入后即时重渲染）
  document.addEventListener('input', e => {
    if (e.target.dataset && e.target.dataset.keep === 'mdl-q') render();
  });
  action('models-find', () => {
    const q = ((S.x.keep && S.x.keep['find-q']) || '').trim();
    S.x.keep = S.x.keep || {};
    S.x.keep['ms-q'] = q;
    S.x.ms = { q: q, source: S.x.msrc || '全部', task: '全部', sort: '综合排序', searched: !!q, searching: !!q };
    nav.push('model-search');
    if (q) setTimeout(() => { const ms = S.x.ms; ms.searching = false; render(); }, 900);
  });
  action('go-model-search', () => nav.push('model-search'));
  action('models-import', () => {
    const kinds = ['gguf', 'zip'];
    S.x.localModels.push({ id: 'imported-' + Date.now(), name: 'imported-' + (S.x.localModels.length + 1) + '.' + kinds[S.x.localModels.length % 2], kind: '对话', fmt: kinds[S.x.localModels.length % 2] === 'gguf' ? 'GGUF' : 'ZIP', size: 180000000 + S.x.localModels.length * 70000000, src: '本地导入' });
    toast('已导入（模拟 OpenDocument）'); render();
  });
  // F11 清理：删除"未使用"的本地模型（演示口径：非推荐模型来源的）
  action('models-clean', () => {
    const local = S.x.localModels;
    const recIds = DB.AI.filter(m => m.type === 'model').map(m => m.id);
    const unused = local.filter(m => m.src !== '推荐下载' || recIds.indexOf(m.id) < 0);
    if (!unused.length) { toast('没有可清理的模型（推荐模型保留）'); return; }
    showDialog({
      title: '清理未使用模型',
      body: '<div class="muted" style="font-size:14px">将删除 ' + unused.length + ' 个非推荐来源的模型，释放约 ' + fmtSize(unused.reduce((s, m) => s + m.size, 0)) + '。推荐下载的模型保留。</div>',
      actions: [
        { label: '取消' },
        {
          label: '清理', style: 'filled', run: () => {
            S.x.localModels = local.filter(m => unused.indexOf(m) < 0);
            toast('已清理 ' + unused.length + ' 个模型', { act: 'models-undo-clean', arg: JSON.stringify(unused), label: '撤销' });
            render();
          }
        }
      ]
    });
  });
  action('models-undo-clean', ds => {
    const restored = JSON.parse(ds.arg);
    restored.forEach(m => { if (!S.x.localModels.some(x => x.id === m.id)) S.x.localModels.unshift(m); });
    render();
  });
  // I2 分级：模型删除是重删（占空间大、不可秒重建），保留二次确认弹窗
  action('models-del', ds => confirmDialog('删除模型', '将从本机删除该模型文件。', '删除', () => {
    S.x.localModels.splice(+ds.arg, 1); render();
  }, true));
  action('rec-dl', ds => {
    mock.startJob('rec-dl-' + ds.arg, '下载', 2600, ['源 1', '源 2']);
    const t = setInterval(() => {
      if (mock.isJobDone('rec-dl-' + ds.arg)) {
        clearInterval(t);
        const m = DB.AI.find(x => x.id === ds.arg);
        S.x.localModels.push({ id: m.id, name: m.parts[0].name, kind: KIND_LABEL[m.kind] || m.kind, fmt: fmtOfEngine(m), size: m.parts.reduce((s, p) => s + p.size, 0), src: '推荐下载' });
        render();
      }
    }, 300);
  });

  // ---------- 模型搜索（子页） ----------
  registerScreen('model-search', {
    title: '模型搜索',
    render(arg) {
      const ms = S.x.ms = S.x.ms || { q: '', source: '全部', task: '全部', sort: '综合排序', searched: false };
      let h = '<div class="dl-status" style="padding:8px 2px 0">搜索 HuggingFace / 魔塔社区的模型，找到后可直接下载到本机</div>' +
        '<div class="msg-row" style="margin-top:8px">' +
        '<input class="field-input" style="flex:1" data-keep="ms-q" placeholder="输入模型名或关键词…" value="' + esc(ms.q) + '">' +
        '<button class="btn" style="min-height:48px;padding:0 18px" data-a="ms-search">搜索</button></div>';
      const groups = [['来源', ['全部', '魔塔社区', 'HF 镜像', 'HuggingFace'], 'source'],
        ['用途', ['全部', '对话 LLM', '图像生成', '语音音频', '视频生成', '其它'], 'task'],
        ['排序', ['综合排序', '最多下载', '最多喜欢', '最近更新'], 'sort']];
      groups.forEach(g => {
        h += '<div class="muted small" style="margin-top:10px">' + g[0] + '</div><div class="chip-row" style="padding-top:4px">' +
          g[1].map(x => chip(x, ms[g[2]] === x, 'ms-filter', g[2] + ':' + x)).join('') + '</div>';
      });

      if (!ms.searched) return h + emptyHint('输入关键词开始搜索');
      // I4：搜索中保留筛选器原地转圈（骨架屏），不再整页闪白
      if (ms.searching) return h + '<div class="dl-status" style="padding:10px 4px">搜索中…</div>' +
        '<div class="skel"></div><div class="skel" style="min-height:96px"></div><div class="skel"></div>';
      const list = DB.MODEL_SEARCH_DEMO.filter(m => (ms.source === '全部' || m.source === ms.source) && (ms.task === '全部' || m.task === ms.task));
      h += '<div class="dl-status" style="padding:10px 4px">共 ' + list.length + ' 条结果</div>';
      if (!list.length) return h + emptyHint('没有找到匹配模型');
      const localNames = (S.x.localModels || []).map(m => m.name);
      h += list.map(m => {
        const files = m.files || [];
        const allLocal = files.length && files.every(f => localNames.indexOf(f.name) >= 0);
        return card(
        '<div class="dl-row"><div class="li-title" style="flex:1;font-weight:400">' + esc(m.name) + '</div>' +
        (allLocal ? '<span class="badge soft">' + icon('check_circle', 'small') + ' 已下载</span>' : '') +
        '<span class="badge soft">' + esc(m.task) + '</span>' + (m.gated ? '<span class="badge">需申请访问</span>' : '') + '</div>' +
        '<div class="li-sub" style="margin-top:4px">' + esc(m.author) + ' · ' + esc(m.source) + '</div>' +
        '<div class="muted" style="font-size:13px;margin-top:6px">' + esc(m.summary) + '</div>' +
        '<div class="stat-grid"><span>下载 ' + m.downloads + '</span><span>喜欢 ' + m.likes + '</span><span>更新 ' + m.updated + '</span><span>' + m.size + '</span><span class="achip">GGUF</span></div>' +
        '<div style="margin-top:8px">' + textBtn('查看文件', 'ms-files', m.name) + '</div>');
      }).join('');
      h += '<div class="muted small center" style="padding:14px">已加载全部结果</div>';
      return h;
    }
  });
  action('ms-search', () => { const ms = S.x.ms; ms.q = (S.x.keep && S.x.keep['ms-q']) || ''; ms.searched = true; ms.searching = true; render(); setTimeout(() => { ms.searching = false; render(); }, 900); });
  action('ms-filter', ds => { const [k, v] = ds.arg.split(':'); S.x.ms[k] = v; render(); });
  action('ms-files', ds => {
    const m = DB.MODEL_SEARCH_DEMO.find(x => x.name === ds.arg);
    const localNames = (S.x.localModels || []).map(x => x.name);
    showDialog({
      title: m.name,
      body: m.files.map(f => {
        const isLocal = localNames.indexOf(f.name) >= 0;
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(f.name) + '</div>' +
          '<div class="li-sub">' + fmtSize(f.size) + (isLocal ? ' · 已下载' : '') + '</div></div>' +
          (isLocal ? '<span class="badge soft">已下载</span>' : textBtn('下载', 'ms-file-dl', JSON.stringify({ name: f.name, size: f.size }))) + '</div>';
      }).join(''),
      actions: [{ label: '关闭' }]
    });
  });
  action('ms-file-dl', ds => {
    const f = JSON.parse(ds.arg);
    closeDialog();
    const t = mock.enqueue(f.name, f.size, { kind: 'model' });
    // 下载完成后登记到本地模型，供"已下载"标记
    const timer = setInterval(() => {
      if (t.status === 'done') {
        clearInterval(timer);
        S.x.localModels = S.x.localModels || [];
        if (!S.x.localModels.some(x => x.name === f.name)) {
          S.x.localModels.push({ id: 'ms-' + Date.now(), name: f.name, kind: '对话', fmt: fmtOfName(f.name), size: f.size, src: '模型搜索' });
        }
      } else if (t.status === 'failed') {
        clearInterval(timer);
      }
    }, 500);
  });
})();
