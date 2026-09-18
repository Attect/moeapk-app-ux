// AI Tab：对话 / 生图 / 语音 / 放大 + 模型中心 + 模型搜索
// 对应：ui/ai/AiScreen.kt、LlmBench.kt、DiffusionBench.kt、TtsBench.kt、UpscaleBench.kt、
//       ModelHubScreen.kt、ModelSearchScreen.kt
(function () {
  const A = () => S.x.ai = S.x.ai || {};
  const ai = () => A();
  function jobBar(key, label) {
    const j = mock.job(key);
    if (!j) return '';
    if (j.done) return '<div class="dl-status">' + esc(label) + ' ✓</div>';
    return '<div class="dl-status">' + esc(j.label || label) + '… ' + Math.round(j.p * 100) + '%' + (j.phase ? '（' + esc(j.phase) + '）' : '') + '</div>' + progress(j.p);
  }

  // ---------- Tab 容器 ----------
  registerScreen('tab:ai', {
    title: 'AI',
    render() {
      const tabs = [['llm', '对话'], ['diffusion', '生图'], ['tts', '语音'], ['upscale', '放大'], ['models', '模型']];
      const row = '<div class="chip-row" style="margin:0 -16px;padding:6px 16px 2px">' +
        tabs.map(t => chip(t[1], S.aiTab === t[0], 'ai-tab', t[0])).join('') + '</div>';
      const body = { llm: llmBench, diffusion: diffusionBench, tts: ttsBench, upscale: upscaleBench }[S.aiTab]();
      return row + body;
    }
  });
  action('ai-tab', ds => {
    if (ds.arg === 'models') { nav.push('models'); return; }
    nav.setAiTab(ds.arg);
  });

  // ---------- 对话（LLM 测试台） ----------
  function llmBench() {
    const s = ai().llm = ai().llm || { messages: [] };
    let h = card('<div class="li-title">LLM 测试台</div><div class="li-sub" style="margin-top:4px">状态：' +
      (s.loaded ? '模型已加载（' + esc(s.model || '') + '）' : s.engineReady ? '引擎就绪' : '未初始化') + '</div>');
    h += '<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;align-items:flex-start">';
    h += btn('1. 获取 AI 目录', 'llm-catalog', null, 'small' + (s.catalog ? ' ghost' : ''));
    if (s.catalog) {
      h += btn('2. 准备引擎（llm-fork）', 'llm-engine', null, 'small' + (s.engineReady ? ' ghost' : ''));
      h += jobBar('llm-engine', '引擎就绪');
    }
    if (s.engineReady) {
      h += btn('3. 选择模型' + (s.model ? '（当前：' + esc(s.model) + '）' : ' / 更换模型'), 'llm-pick', null, 'small');
    }
    if (s.model) {
      const done = mock.isJobDone('llm-load');
      if (s.modelLocal && !s.modelReady) {
        h += btn('下载 ' + esc(s.model) + '（' + fmtSize(s.modelSize || 0) + '）', 'llm-modeldl', null, 'small');
        h += jobBar('llm-modeldl', '模型已就绪');
      } else if (!done && !s.loaded) {
        h += btn('4. 加载模型', 'llm-load', null, 'small');
        h += jobBar('llm-load', '模型已加载');
      } else if (!s.loaded) {
        h += btn('4. 加载模型', 'llm-load', null, 'small');
      }
    }
    h += '</div>';
    if (s.loaded) {
      h += sectionTitle('对话测试');
      h += '<div id="chat">';
      s.messages.forEach(m => {
        h += '<div class="msg-row"><div class="msg-card ' + m.role + '">' + esc(m.text) + '</div></div>';
      });
      if (s.thinking) h += '<div class="msg-row"><div class="msg-card ai">' + esc(s.partial || '') + '<span class="muted">▍</span></div></div>';
      h += '</div>';
      h += '<div class="msg-row">' +
        '<input class="field-input" style="flex:1" data-keep="llm-q" placeholder="输入消息…">' +
        '<button class="btn" style="min-height:48px;padding:0 18px" data-a="llm-send">' + icon('send') + '</button></div>';
    }
    return h;
  }
  action('llm-catalog', () => { const s = ai().llm; s.catalog = true; s.engineReady = s.engineReady || mock.isJobDone('llm-engine'); render(); });
  action('llm-engine', () => { mock.startJob('llm-engine', '准备引擎', 2600, ['连接节点', '下载引擎包', '解压校验']); const s = ai().llm; const t = setInterval(() => { if (mock.isJobDone('llm-engine')) { s.engineReady = true; clearInterval(t); render(); } }, 300); });
  action('llm-pick', () => {
    const models = DB.AI.filter(m => m.type === 'model' && m.kind === 'llm');
    showDialog({
      title: '选择对话模型',
      body: models.map(m => {
        const size = m.parts.reduce((s, p) => s + p.size, 0);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + esc(m.summary) + ' · ' + fmtSize(size) + '</div></div>' +
          textBtn('选用', 'llm-choose', JSON.stringify({ id: m.id, name: m.name, size, local: false })) + '</div>';
      }).join('') +
        '<div class="hr"></div><div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">Bonsai-1.7B-Local.gguf</div><div class="li-sub">本地导入 · ' + fmtSize(260000000) + '</div></div>' +
        textBtn('选用', 'llm-choose', JSON.stringify({ id: 'local', name: 'Bonsai-1.7B-Local.gguf', size: 260000000, local: true })) + '</div>',
      actions: [{ label: '取消' }]
    });
  });
  action('llm-choose', ds => {
    const m = JSON.parse(ds.arg); const s = ai().llm;
    s.model = m.name; s.modelSize = m.size; s.modelLocal = m.local; s.modelReady = !!m.local;
    if (!m.local) mock.resetJob('llm-modeldl');
    s.loaded = false; mock.resetJob('llm-load');
    closeDialog(); render();
  });
  action('llm-modeldl', () => { const s = ai().llm; mock.startJob('llm-modeldl', '下载模型', 3200, ['源 1', '源 2']); const t = setInterval(() => { if (mock.isJobDone('llm-modeldl')) { s.modelReady = true; clearInterval(t); render(); } }, 300); });
  action('llm-load', () => { mock.startJob('llm-load', '加载模型', 2000, ['初始化', '读入权重']); const s = ai().llm; const t = setInterval(() => { if (mock.isJobDone('llm-load')) { s.loaded = true; clearInterval(t); render(); } }, 300); });
  action('llm-send', () => {
    const s = ai().llm;
    const q = (S.x.keep && S.x.keep['llm-q'] || '').trim();
    if (!q || s.thinking) return;
    s.messages.push({ role: 'user', text: q });
    S.x.keep['llm-q'] = ''; s.thinking = true; s.partial = '';
    render();
    const reply = '这是模拟回复：端侧模型已收到你的消息「' + q + '」。在原型中，对话内容用于验证消息气泡、流式输出与滚动行为。';
    let i = 0;
    const t = setInterval(() => {
      s.partial = reply.slice(0, i += 4);
      if (i >= reply.length) {
        clearInterval(t); s.messages.push({ role: 'ai', text: reply }); s.thinking = false;
      }
      render();
      const c = document.getElementById('content'); if (c) c.scrollTop = c.scrollHeight;
    }, 60);
  });

  // ---------- 生图（Diffusion 测试台） ----------
  function diffusionBench() {
    const s = ai().diff = ai().diff || { engine: 'qnn', prompt: '1girl, anime style, masterpiece, best quality', steps: 20 };
    let h = card('<div class="li-title">生图测试台</div><div class="li-sub" style="margin-top:4px">状态：' +
      (s.result ? '已生成' : s.model ? '模型就绪（' + esc(s.model) + '）' : '未获取目录') + '</div>');
    h += '<div class="chip-row">' + [['qnn', 'NPU（QNN）'], ['mnn', 'CPU（MNN）'], ['sdxl', 'SDXL（QNN）']].map(e => chip(e[1], s.engine === e[0], 'diff-engine', e[0])).join('') + '</div>';
    h += btn('获取模型目录', 'diff-catalog', null, 'small');
    if (s.catalog) {
      const models = DB.AI.filter(m => m.kind === 'diffusion');
      h += '<div class="card tight" style="padding:0">' + models.map(m => {
        const size = m.parts.reduce((x, p) => x + p.size, 0);
        const cur = s.modelId === m.id;
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + fmtSize(size) + '</div></div>' +
          (cur ? '<span class="badge soft">当前</span>' : textBtn('下载模型（' + fmtSize(size) + '）', 'diff-dl', m.id)) + '</div>';
      }).join('') + '</div>';
      h += jobBar('diff-dl', '模型已就绪');
      h += field({ id: 'diff-prompt', label: '提示词（英文，逗号分隔）', value: s.prompt });
      h += '<label class="slider-row"><span class="li-title" id="diff-steps-label">采样步数 ' + s.steps + '</span>' +
        '<input type="range" min="10" max="40" step="1" value="' + s.steps + '" class="slider" data-live="diff-steps"></label>';
      h += '<div style="margin-top:12px">' + btn('生成图像', 'diff-gen', null, 'block') + '</div>';
      h += jobBar('diff-gen', '生成完成');
    }
    if (s.result) {
      h += card('<div style="aspect-ratio:1;border-radius:10px;background:linear-gradient(135deg,#f7c98a,#c96a8e 55%,#5a4a8a);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:12px">模拟出图（原型占位）</div>' +
        '<div class="li-sub" style="margin-top:8px">' + esc(s.resultInfo) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        btn('保存到相册', 'diff-save', null, 'small ghost') + btn('AI 放大', 'diff-upscale', null, 'small ghost') + btn('存壁纸', 'diff-wallpaper', null, 'small ghost') + '</div>');
    }
    return h;
  }
  action('diff-engine', ds => { ai().diff.engine = ds.arg; render(); });
  action('diff-catalog', () => { ai().diff.catalog = true; render(); });
  action('diff-dl', ds => {
    mock.startJob('diff-dl', '下载模型', 3600, ['源 1', '源 2', '校验']);
    const t = setInterval(() => {
      if (mock.isJobDone('diff-dl')) {
        clearInterval(t);
        const m = DB.AI.find(x => x.id === ds.arg);
        ai().diff.modelId = m.id; ai().diff.model = m.name;
        ai().diff.result = null;
        render();
      }
    }, 300);
  });
  action('diff-steps', (ds, el) => {
    const s = ai().diff; s.steps = +el.value;
    const lb = document.getElementById('diff-steps-label');
    if (lb) lb.textContent = '采样步数 ' + s.steps; // 拖动中只改标签，避免重渲染打断拖动
  });
  action('diff-gen', () => {
    const s = ai().diff;
    s.prompt = (S.x.keep && S.x.keep['diff-prompt']) || s.prompt;
    mock.startJob('diff-gen', '生成图像', 4200, ['编码提示词', '去噪 ' + s.steps + ' 步', '解码']);
    const t = setInterval(() => {
      if (mock.isJobDone('diff-gen')) {
        clearInterval(t);
        s.result = true; s.resultInfo = s.engine === 'sdxl' ? '1024×1024 · SDXL · ' + s.steps + ' 步' : '512×512 · ' + s.steps + ' 步';
        render();
      }
    }, 300);
  });
  action('diff-save', () => toast('已保存到相册（Pictures/MoeApk）'));
  action('diff-upscale', () => { nav.setAiTab('upscale'); });
  action('diff-wallpaper', () => { const s = ai().diff; S.x.wallpapers.unshift({ id: 'wp' + Date.now(), hue: 340, label: '生图·模拟', date: '2026-09-18' }); toast('已存入壁纸库'); });

  // ---------- 语音（TTS 测试台） ----------
  function ttsBench() {
    const s = ai().tts = ai().tts || { device: 'cpu', text: '你好，我是 MoeApk 的端侧语音合成。', playing: false };
    let h = card('<div class="li-title">语音测试台</div><div class="li-sub" style="margin-top:4px">状态：' +
      (s.synth ? '已合成（' + esc(s.device.toUpperCase()) + '）' : s.modelReady ? '模型就绪' : '未获取目录') + '</div>');
    h += '<div class="chip-row">' + chip('CPU', s.device === 'cpu', 'tts-device', 'cpu') + chip('NPU（QNN）', s.device === 'qnn', 'tts-device', 'qnn') + '</div>';
    h += btn('获取模型目录', 'tts-catalog', null, 'small');
    if (s.catalog) {
      h += btn('下载模型（' + fmtSize(534000000) + '）', 'tts-dl', null, 'small');
      h += jobBar('tts-dl', '模型已就绪');
    }
    h += field({ id: 'tts-text', label: '合成文本', value: s.text });
    h += sectionTitle('参考音色（语音克隆）');
    h += card(
      btn('从相册选择音频', 'tts-pick-audio', null, 'small ghost') +
      (s.pickedAudio ? '<div class="dl-status" style="margin-top:8px">已选择：' + esc(s.pickedAudio) + '</div>' : '') +
      field({ id: 'tts-ref-text', label: '参考音频的文本内容（必填）' }) +
      '<div style="margin-top:10px">' + btn('编码并保存参考音色', 'tts-encode', null, 'small') + '</div>' +
      jobBar('tts-encode', '音色已保存'));
    if (S.x.voices.length) {
      h += '<div class="card tight" style="padding:0">' + S.x.voices.map(v =>
        '<div class="li"><div class="li-icon">' + icon('person') + '</div><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(v.name) + '</div>' +
        '<div class="li-sub">' + esc(v.note) + '</div></div>' +
        (s.voice === v.name ? '<span class="badge soft">当前</span>' : textBtn('选用', 'tts-voice', v.name)) +
        textBtn('删除', 'tts-voice-del', v.name, 'danger') + '</div>').join('') + '</div>';
    }
    h += '<div style="margin-top:14px">' + btn('合成语音', 'tts-synth', null, 'block') + '</div>';
    h += jobBar('tts-synth', '合成完成');
    if (s.synth) {
      h += '<div style="margin-top:10px">' + btn(s.playing ? '停止' : '播放', 'tts-play', null, 'block ghost') + '</div>';
    }
    return h;
  }
  action('tts-device', ds => { ai().tts.device = ds.arg; render(); });
  action('tts-catalog', () => { ai().tts.catalog = true; render(); });
  action('tts-dl', () => { mock.startJob('tts-dl', '下载模型', 3000, ['源 1', '校验']); const t = setInterval(() => { if (mock.isJobDone('tts-dl')) { ai().tts.modelReady = true; clearInterval(t); render(); } }, 300); });
  action('tts-pick-audio', () => { ai().tts.pickedAudio = 'recording_20260918.wav'; toast('已选择音频（模拟）'); render(); });
  action('tts-encode', () => { mock.startJob('tts-encode', '编码参考音色', 1500, ['提取特征']); const t = setInterval(() => { if (mock.isJobDone('tts-encode')) { S.x.voices.push({ name: 'voice_' + (S.x.voices.length + 1), note: '本地参考音色' }); clearInterval(t); render(); } }, 300); });
  action('tts-voice', ds => { ai().tts.voice = ds.arg; render(); });
  action('tts-voice-del', ds => confirmDialog('删除参考音色', '删除后不可恢复。', '删除', () => {
    S.x.voices = S.x.voices.filter(v => v.name !== ds.arg);
    if (ai().tts.voice === ds.arg) ai().tts.voice = null;
    render();
  }, true));
  action('tts-synth', () => {
    const s = ai().tts;
    s.text = (S.x.keep && S.x.keep['tts-text']) || s.text;
    mock.startJob('tts-synth', '合成语音', 2400, s.device === 'qnn' ? ['NPU 实时路径'] : ['CPU 异步']);
    const t = setInterval(() => { if (mock.isJobDone('tts-synth')) { s.synth = true; clearInterval(t); render(); } }, 300);
  });
  action('tts-play', () => { const s = ai().tts; s.playing = !s.playing; render(); if (s.playing) setTimeout(() => { s.playing = false; render(); }, 6000); });

  // ---------- 放大（Upscale 测试台） ----------
  function upscaleBench() {
    const s = ai().up = ai().up || { model: 'anime', scale: 4, picked: false };
    let h = card('<div class="li-title">AI 图片放大</div><div class="li-sub" style="margin-top:4px">基于 Real-ESRGAN 的 4 倍超分辨率，动漫模型约 18MB，写实模型仅 QNN NPU 可用。</div>');
    h += '<div class="muted small" style="margin-top:10px">模型</div><div class="chip-row">' +
      chip('动漫', s.model === 'anime', 'up-model', 'anime') + chip('写实（QNN）', s.model === 'real', 'up-model', 'real') + '</div>';
    h += '<div class="muted small">倍率</div><div class="chip-row">' +
      [2, 3, 4].map(x => chip(x + 'x', s.scale === x, 'up-scale', x)).join('') + '</div>';
    h += btn('从相册选择图片', 'up-pick', null, 'small ghost');
    if (s.picked) {
      h += card('<div style="display:flex;gap:12px;align-items:center"><div style="width:72px;height:96px;border-radius:8px;background:linear-gradient(160deg,#7fa8d0,#31456b);flex:none"></div>' +
        '<div style="flex:1"><div class="li-title" style="font-weight:400">示例图片.jpg</div><div class="li-sub">1080×1440</div></div></div>');
      h += '<div style="margin-top:10px">' + btn('开始放大（' + s.scale + 'x）', 'up-run', null, 'block') + '</div>';
      h += jobBar('up-run', '放大完成');
    }
    if (s.result) {
      h += card('<div style="display:flex;gap:12px;align-items:center"><div style="width:72px;height:96px;border-radius:8px;background:linear-gradient(160deg,#a8c4e0,#3f5a85);flex:none"></div>' +
        '<div style="flex:1"><div class="li-title" style="font-weight:400">放大结果</div><div class="li-sub">' + esc(s.result) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' + btn('保存到相册', 'up-save', null, 'small ghost') + btn('存入壁纸库', 'up-wall', null, 'small ghost') + '</div></div></div>');
    }
    return h;
  }
  action('up-model', ds => { ai().up.model = ds.arg; render(); });
  action('up-scale', ds => { ai().up.scale = +ds.arg; render(); });
  action('up-pick', () => { ai().up.picked = true; render(); });
  action('up-run', () => {
    mock.startJob('up-run', '放大中', 2800, ['切块', '推理']);
    const t = setInterval(() => {
      if (mock.isJobDone('up-run')) {
        clearInterval(t); const s = ai().up;
        s.result = '2160×2880（' + s.scale + 'x）· ' + (s.model === 'anime' ? 'Real-ESRGAN anime_6B' : '4x_UltraSharpV2_Lite');
        render();
      }
    }, 300);
  });
  action('up-save', () => toast('已保存到相册'));
  action('up-wall', () => { S.x.wallpapers.unshift({ id: 'wp' + Date.now(), hue: 210, label: '放大·模拟', date: '2026-09-18' }); toast('已存入壁纸库'); });

  // ---------- 模型中心（子页） ----------
  registerScreen('models', {
    title: '模型中心',
    render() {
      const local = S.x.localModels = S.x.localModels || [];
      let h = '';
      h += sectionTitle('我的模型');
      h += card('<div style="padding:8px 12px 12px">' + textBtn('＋ 从手机导入', 'models-import') + '</div>' +
        (local.length ? '<div class="card tight" style="padding:0;margin-top:0">' + local.map((m, i) =>
          '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + esc(m.kind) + ' · ' + fmtSize(m.size) + ' · ' + esc(m.src) + '</div></div>' +
          textBtn('删除', 'models-del', i, 'danger') + '</div>').join('') + '</div>' : ''));
      h += sectionTitle('搜索模型');
      h += card('<div class="chip-row" style="padding-top:0">' + ['魔塔社区', 'HF 镜像', 'HuggingFace'].map(x => '<span class="achip">' + x + '</span>').join('') + '</div>' +
        '<div style="padding:0 12px 12px">' + btn('打开模型搜索', 'go-model-search', null, 'small ghost') + '</div>');
      h += sectionTitle('推荐模型');
      const rec = DB.AI.filter(m => m.type === 'model');
      h += card('<div class="card tight" style="padding:0;margin-top:0">' + rec.map(m => {
        const size = m.parts.reduce((x, p) => x + p.size, 0);
        const j = mock.job('rec-dl-' + m.id);
        const ready = (S.x.localModels || []).some(l => l.id === m.id) || (j && j.done);
        let trail;
        if (ready) trail = '<span class="badge soft">已就绪</span>';
        else if (j) trail = '<div style="width:90px">' + progress(j.p) + '</div>';
        else trail = textBtn('下载', 'rec-dl', m.id);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) + '</div>' +
          '<div class="li-sub">' + esc(m.summary) + ' · ' + fmtSize(size) + '</div></div>' + trail + '</div>';
      }).join('') + '</div>');
      return h;
    }
  });
  action('go-model-search', () => nav.push('model-search'));
  action('models-import', () => {
    const kinds = ['gguf', 'zip'];
    S.x.localModels.push({ id: 'imported-' + Date.now(), name: 'imported-' + (S.x.localModels.length + 1) + '.' + kinds[S.x.localModels.length % 2], kind: '对话 LLM', size: 180000000 + S.x.localModels.length * 70000000, src: '本地导入' });
    toast('已导入（模拟 OpenDocument）'); render();
  });
  action('models-del', ds => confirmDialog('删除模型', '将从本机删除该模型文件。', '删除', () => {
    S.x.localModels.splice(+ds.arg, 1); render();
  }, true));
  action('rec-dl', ds => {
    mock.startJob('rec-dl-' + ds.arg, '下载', 2600, ['源 1', '源 2']);
    const t = setInterval(() => {
      if (mock.isJobDone('rec-dl-' + ds.arg)) {
        clearInterval(t);
        const m = DB.AI.find(x => x.id === ds.arg);
        S.x.localModels.push({ id: m.id, name: m.parts[0].name, kind: { llm: '对话 LLM', diffusion: '图像生成', tts: '语音音频', upscale: '图像放大' }[m.kind] || m.kind, size: m.parts.reduce((s, p) => s + p.size, 0), src: '推荐下载' });
        render();
      }
    }, 300);
  });

  // ---------- 模型搜索（子页） ----------
  registerScreen('model-search', {
    title: '模型搜索',
    render() {
      const ms = S.x.ms = S.x.ms || { q: '', source: '全部', task: '全部', sort: '综合排序', searched: false };
      let h = '<div class="msg-row" style="margin-top:8px">' +
        '<input class="field-input" style="flex:1" data-keep="ms-q" placeholder="在魔塔社区 / HF 镜像 / HuggingFace 搜索…" value="' + esc(ms.q) + '">' +
        '<button class="btn" style="min-height:48px;padding:0 18px" data-a="ms-search">搜索</button></div>';
      const groups = [['来源', ['全部', '魔塔社区', 'HF 镜像', 'HuggingFace'], 'source'],
        ['用途', ['全部', '对话 LLM', '图像生成', '语音音频', '视频生成', '其它'], 'task'],
        ['排序', ['综合排序', '最多下载', '最多喜欢', '最近更新'], 'sort']];
      groups.forEach(g => {
        h += '<div class="muted small" style="margin-top:10px">' + g[0] + '</div><div class="chip-row" style="padding-top:4px">' +
          g[1].map(x => chip(x, ms[g[2]] === x, 'ms-filter', g[2] + ':' + x)).join('') + '</div>';
      });
      if (!ms.searched) return h + emptyHint('输入关键词开始搜索');
      if (ms.searching) return h + spinner();
      const list = DB.MODEL_SEARCH_DEMO.filter(m => (ms.source === '全部' || m.source === ms.source) && (ms.task === '全部' || m.task === ms.task));
      h += '<div class="dl-status" style="padding:10px 4px">共 ' + list.length + ' 条结果</div>';
      if (!list.length) h += emptyHint('没有找到匹配模型');
      h += list.map(m => card(
        '<div class="dl-row"><div class="li-title" style="flex:1;font-weight:400">' + esc(m.name) + '</div><span class="badge soft">' + esc(m.task) + '</span>' + (m.gated ? '<span class="badge">需申请访问</span>' : '') + '</div>' +
        '<div class="li-sub" style="margin-top:4px">' + esc(m.author) + ' · ' + esc(m.source) + '</div>' +
        '<div class="muted" style="font-size:13px;margin-top:6px">' + esc(m.summary) + '</div>' +
        '<div class="stat-grid"><span>下载 ' + m.downloads + '</span><span>喜欢 ' + m.likes + '</span><span>更新 ' + m.updated + '</span><span>' + m.size + '</span><span class="achip">GGUF</span></div>' +
        '<div style="margin-top:8px">' + textBtn('查看文件', 'ms-files', m.name) + '</div>')).join('');
      h += '<div class="muted small center" style="padding:14px">已加载全部结果</div>';
      return h;
    }
  });
  action('ms-search', () => { const ms = S.x.ms; ms.q = (S.x.keep && S.x.keep['ms-q']) || ''; ms.searched = true; ms.searching = true; render(); setTimeout(() => { ms.searching = false; render(); }, 900); });
  action('ms-filter', ds => { const [k, v] = ds.arg.split(':'); S.x.ms[k] = v; render(); });
  action('ms-files', ds => {
    const m = DB.MODEL_SEARCH_DEMO.find(x => x.name === ds.arg);
    showDialog({
      title: m.name,
      body: m.files.map(f =>
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(f.name) + '</div>' +
        '<div class="li-sub">' + fmtSize(f.size) + '</div></div>' +
        textBtn('下载', 'ms-file-dl', JSON.stringify({ name: f.name, size: f.size })) + '</div>').join(''),
      actions: [{ label: '关闭' }]
    });
  });
  action('ms-file-dl', ds => { const f = JSON.parse(ds.arg); closeDialog(); mock.enqueue(f.name, f.size, { kind: 'model' }); });
})();
