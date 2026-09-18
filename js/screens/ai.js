// AI Tab：入口枢纽（任务队列 + 模型管理 / LLM 对话 / 图片生成 / 语音生成 四个独立子页）。
// 2026-09-18 改版：放大已移至素材查看器操作，不再单列；LLM 多会话 Agent 化；生图支持文生图/图生图。
// 对应：ui/ai/AiScreen.kt（改版后）。各子页拆至 ai-llm.js / ai-diffusion.js / ai-tts.js / ai-models.js。
(function () {
  const A = () => S.x.ai = S.x.ai || {};
  const L = () => A().llm = A().llm || { sessions: [], cur: null, modelSel: 'bonsai-vl', attach: null };
  const curSess = () => { const l = L(); return l.sessions.find(s => s.id === l.cur) || null; };
  const LLM_DEF = { ctxLen: 8192, seed: 42, temp: 0.7, device: 'npu', threads: 4, batch: 128, kv: 'Q8_0' };
  function cfgOf(id) {
    S.x.llmCfg = S.x.llmCfg || {};
    if (!S.x.llmCfg[id]) S.x.llmCfg[id] = Object.assign({}, LLM_DEF);
    return S.x.llmCfg[id];
  }
  // 可选对话模型：目录 LLM + 本地导入 + 多模态演示
  const LLM_MODELS = DB.AI.filter(m => m.type === 'model' && m.kind === 'llm').map(m => ({
    id: m.id, name: m.name, size: m.parts.reduce((s, p) => s + p.size, 0),
    local: false, multiModal: false
  })).concat([
    { id: 'local-bonsai', name: 'Bonsai-1.7B-Local.gguf', size: 260000000, local: true, multiModal: false },
    { id: 'bonsai-vl', name: 'Bonsai-VL 2B（多模态）', size: 1750000000, local: true, multiModal: true }
  ]);

  function jobBar(key, label) {
    const j = mock.job(key);
    if (!j) return '';
    if (j.done) return '<div class="dl-status">' + esc(label) + ' ✓</div>';
    return '<div class="dl-status">' + esc(j.label || label) + '… ' + Math.round(j.p * 100) + '%' + (j.phase ? '（' + esc(j.phase) + '）' : '') + '</div>' + progress(j.p);
  }
  function assetThumb(a, cls) {
    return '<div class="' + (cls || '') + '" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))"></div>';
  }
  // 共享给拆分文件（ai-llm / ai-diffusion / ai-tts）
  window._aiShared = { A, L, curSess, cfgOf, LLM_MODELS, jobBar, assetThumb };

  registerScreen('tab:ai', {
    title: 'AI',
    render() {
      const q = S.x.aiQueue || [];
      const running = q.filter(x => mock.queueState(x) === 'running').length;
      // 取最近一个进行中任务，在入口列表项下方展示迷你进度
      let live = null;
      for (const x of q) {
        if (mock.queueState(x) === 'running') { live = { title: x.title, j: mock.job(x.key) }; break; }
      }
      const l = S.x.ai && S.x.ai.llm;
      const nSess = l && l.sessions ? l.sessions.length : 0;
      const cur = l && l.sessions.find(s => s.id === l.cur);
      const d = S.x.ai && S.x.ai.diff;
      const t = S.x.ai && S.x.ai.tts;
      return '<div class="card tight" style="padding:0;margin-top:2px">' +
        listItem({
          icon: 'schedule', title: 'AI 任务队列',
          sub: q.length ? running + ' 个进行中 · 共 ' + q.length + ' 个任务' : '暂无任务',
          trailing: running ? '<span class="count-badge dot"></span>' : undefined,
          arrow: true, action: 'go-ai-queue'
        }) +
        (live && live.j ? '<div style="padding:0 16px 12px"><div class="dl-status">' + esc(live.title) + ' · ' + esc(live.j.phase || '进行中') + ' · ' + Math.round(live.j.p * 100) + '%</div>' + progress(live.j.p) + '</div>' : '') +
        '</div>' +
        '<div class="card tight" style="padding:0">' +
        listItem({ icon: 'file_open', title: '模型管理', sub: '下载 / 导入 / 搜索模型', arrow: true, action: 'go-models' }) +
        '<div class="hr"></div>' +
        listItem({
          icon: 'smart_toy', title: 'LLM 对话',
          sub: nSess ? nSess + ' 个会话' + (cur ? ' · 当前：' + cur.modelName : '') : '多会话 AI 助手，支持图片',
          arrow: true, action: 'go-llm'
        }) +
        '<div class="hr"></div>' +
        listItem({
          icon: 'image', title: '图片生成',
          sub: d && d.history && d.history.length ? '已生成 ' + d.history.length + ' 张 · 文生图 / 图生图' : '文生图 / 图生图',
          arrow: true, action: 'go-diffusion'
        }) +
        '<div class="hr"></div>' +
        listItem({
          icon: 'play_arrow', title: '语音生成',
          sub: t && t.history && t.history.length ? '已合成 ' + t.history.length + ' 条 · ' + t.device.toUpperCase() : '语音合成 / 克隆音色',
          arrow: true, action: 'go-tts'
        }) +
        '</div>' +
        '<div class="muted small center" style="padding:14px">AI 放大、扩图、3D 点云请在素材页对图片操作。</div>';
    }
  });
  action('go-ai-queue', () => nav.push('ai-queue'));
  action('go-models', () => nav.push('models'));
  action('go-llm', () => nav.push('llm'));
  action('go-diffusion', () => nav.push('diffusion'));
  action('go-tts', () => nav.push('tts'));

  // ---------- AI 任务队列（子页） ----------
  registerScreen('ai-queue', {
    title: 'AI 任务队列',
    render() {
      const q = S.x.aiQueue || [];
      const items = q.map(x => {
        const st = mock.queueState(x);
        if (st === 'gone') return '';
        if (st === 'done') {
          return '<div class="li"><span class="li-icon" style="color:var(--primary)">' + icon('check') + '</span>' +
            '<div class="li-body"><div class="li-title" style="font-weight:400">' + esc(x.title) + '</div>' +
            '<div class="li-sub">已完成</div></div>' +
            textBtn('清除', 'aq-clear-one', x.key, 'ghost') + '</div>';
        }
        const j = mock.job(x.key);
        return '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(x.title) + '</div>' +
          '<div class="dl-status">' + esc(j.phase || '进行中') + ' · ' + Math.round(j.p * 100) + '%</div>' +
          '<div style="margin-top:6px">' + progress(j.p) + '</div></div>' +
          textBtn('取消', 'aq-cancel', x.key, 'danger') + '</div>';
      }).join('');
      const anyDone = q.some(x => mock.queueState(x) === 'done');
      let h = items ? '<div class="card tight" style="padding:0">' + items + '</div>' :
        '<div class="empty-illust">' + icon('schedule') +
        '<div class="empty-title">暂无 AI 任务</div>' +
        '<div class="empty-sub">模型下载、生成、合成等任务会在这里排队展示</div>' +
        // I5：空态导流
        '<div class="empty-cta">' + btn('去生成图片', 'aq-go-diff', null, 'small') +
        btn('去模型中心', 'aq-go-models', null, 'small ghost') + '</div></div>';
      if (anyDone) h += '<div style="margin-top:12px">' + btn('清空已完成', 'aq-clear-done', null, 'ghost block') + '</div>';
      h += '<div class="muted small center" style="padding:12px">AI 任务依次排队执行；文件下载在 我的 → 下载任务 中查看。</div>';
      return h;
    }
  });
  action('aq-cancel', ds => { mock.resetJob(ds.arg); toast('已取消'); render(); });
  action('aq-go-diff', () => { nav.goTab('ai'); nav.push('diffusion'); });
  action('aq-go-models', () => { nav.goTab('ai'); nav.push('models'); });
  action('aq-clear-one', ds => { mock.resetJob(ds.arg); render(); });
  action('aq-clear-done', () => {
    (S.x.aiQueue || []).filter(x => mock.queueState(x) === 'done').forEach(x => mock.resetJob(x.key));
    render();
  });
})();
