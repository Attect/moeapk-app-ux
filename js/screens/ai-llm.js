// LLM 对话子页 + LLM 推理配置子页。对应 ui/ai/LlmScreen.kt、LlmConfigScreen.kt
(function () {
  const { A, L, curSess, cfgOf, LLM_MODELS, assetThumb } = window._aiShared;

  registerScreen('llm', {
    title: () => { const s = curSess(); return s ? s.title : 'LLM 对话'; },
    topRight: { icon: 'menu', act: 'llm-menu' },
    render: llmBlock
  });

  // ---------- LLM 对话（多会话 Agent） ----------
  // 布局：主区域为对话区（无会话时为新对话空态），底部输入区含模型选择 + 上下文用量；
  // 侧边抽屉（topRight 菜单键）放会话列表，抽屉底部为推理设置。
  function llmBlock() {
    const l = L();
    const sess = curSess();
    const m = sess ? LLM_MODELS.find(x => x.id === sess.modelId) : LLM_MODELS.find(x => x.id === l.modelSel);
    const cfg = cfgOf(m.id);
    // 横屏/平板（≥920px）：会话列表常驻左栏，对话区与输入区在右（App 侧对应双栏列表详情布局）
    const wide = isWide();
    let h = wide ? '<div class="chat-page two-pane"><div class="pane-side">' + drawerListHtml(l) + '</div><div class="pane-main">'
      : '<div class="chat-page">';
    if (!sess) {
      h += '<div class="chat-empty">' + icon('smart_toy') +
        '<div style="font-size:16px;color:var(--on-surface)">新对话</div>' +
        '<div class="muted small">底部选择模型后输入消息开始；' + (wide ? '左侧可切换历史对话。' : '历史对话在右上角菜单。') + '</div></div>';
    } else {
      const key = 'llm-' + sess.id;
      const j = mock.job(key);
      if (!sess.loaded) {
        let body;
        if (j && !j.done) {
          body = '<div class="dl-status">' + esc(j.label) + (j.phase ? ' · ' + esc(j.phase) : '') + ' · ' + Math.round(j.p * 100) + '%</div>' + progress(j.p) +
            '<div style="margin-top:8px">' + textBtn('取消', 'llm-cancel', sess.id, 'danger') + '</div>';
        } else {
          body = '<div class="dl-status">模型未加载</div><div style="margin-top:8px">' +
            btn(sess.local ? '加载模型' : '下载并加载（' + fmtSize(sess.size) + '）', 'llm-reload', sess.id, 'small') + '</div>';
        }
        h += '<div style="padding-top:8px">' + card(body) + '</div>';
      } else {
        h += '<div id="chat">';
        sess.messages.forEach((msg, mi) => {
          if (msg.role === 'sys') { h += '<div class="msg-row"><div class="msg-card sys">' + esc(msg.text) + '</div></div>'; return; }
          h += '<div class="msg-row"><div class="msg-card ' + msg.role + '">' +
            (msg.img != null ? assetThumb({ hue: msg.img }, 'msg-img') : '') +
            (msg.text ? esc(msg.text) : '') + '</div></div>';
          // F8 消息操作：AI 最后一条 → 复制/重新生成；用户最后一条 → 编辑重发
          const isLastAi = msg.role === 'ai' && mi === sess.messages.length - 1 && !sess.thinking;
          const isLastUser = msg.role === 'user' && mi === sess.messages.length - 1 && !sess.thinking;
          if (isLastAi) {
            h += '<div class="msg-actions"><button data-a="llm-copy" data-arg="' + mi + '" title="复制">' + icon('content_copy') + '</button>' +
              '<button data-a="llm-regen" title="重新生成">' + icon('refresh') + '</button></div>';
          } else if (isLastUser) {
            h += '<div class="msg-actions"><button data-a="llm-edit-last" title="编辑并重新发送">' + icon('edit') + '</button></div>';
          }
        });
        if (sess.thinking) h += '<div class="msg-row"><div class="msg-card ai">' + esc(sess.partial || '') + '<span class="muted">▍</span></div></div>';
        h += '</div>';
      }
    }
    // 底部输入区：模型选择 + 上下文用量；附件 + 输入 + 发送
    const tokens = sess ? sess.tokens : 0;
    const pct = Math.min(100, Math.round(tokens / cfg.ctxLen * 100));
    const attId = sess ? sess.attach : l.attach;
    const att = attId && (S.x.assets || []).find(a => a.id === attId);
    h += '<div class="composer">' +
      '<div class="composer-top">' +
      '<button class="chip model-chip" data-a="llm-pick">' + icon('smart_toy') + '<span>' + esc(m.name) + '</span>' + icon('expand_more') + '</button>' +
      '<div class="ctx"><span>' + Math.round(tokens) + ' / ' + cfg.ctxLen + '</span>' +
      '<div class="pbar"><div class="pbar-fill' + (pct > 80 ? ' hot' : '') + '" style="width:' + pct + '%"></div></div></div></div>' +
      '<div class="msg-row">' +
      '<button class="icbtn" data-a="llm-attach" title="附加图片">' + icon('image') + '</button>';
    if (att) h += '<button class="attach-chip" data-a="llm-unattach" title="移除附件">' + assetThumb(att, 'th') + '<span>' + icon('close') + '</span></button>';
    h += '<input class="field-input" style="flex:1" data-keep="llm-q" placeholder="输入消息…">' +
      (sess && sess.thinking ?
        '<button class="btn stop" style="min-height:48px;padding:0 18px" data-a="llm-stop">' + icon('stop') + '</button>' :
        '<button class="btn" style="min-height:48px;padding:0 18px" data-a="llm-send">' + icon('send') + '</button>') + '</div>' +
      '</div>';
    if (!wide && S.x.llmDrawer) h += drawerHtml(l);
    return h + (wide ? '</div></div>' : '</div>');
  }

  // 会话列表主体：抽屉（窄屏 overlay）与双栏侧栏（≥920px 常驻）共用
  function drawerListHtml(l) {
    const items = l.sessions.map(s =>
      '<div class="d-sess' + (l.cur === s.id ? ' on' : '') + '" data-a="llm-switch" data-arg="' + s.id + '">' +
      '<div class="d-body"><div class="d-title">' + esc(s.title) + '</div>' +
      '<div class="d-sub">' + esc(s.modelName) + (s.loaded ? '' : ' · 加载中') + '</div></div>' +
      '<button class="d-del" data-a="llm-del-sess" data-arg="' + s.id + '" title="删除">' + icon('close') + '</button></div>').join('');
    return '<div class="d-head"><span>对话</span><span class="muted small">' + l.sessions.length + ' 个</span></div>' +
      '<div style="padding:0 12px 10px">' + btn('＋ 新建对话', 'llm-new-chat', null, 'small block ghost') + '</div>' +
      '<div class="d-list">' + (items || '<div class="muted small center" style="padding:24px 0">暂无历史对话</div>') + '</div>' +
      '<div class="d-foot" data-a="llm-settings">' + icon('settings') + '<span>推理设置</span></div>';
  }
  function drawerHtml(l) {
    return '<div class="drawer-mask" data-a="llm-drawer-close"><div class="drawer" data-a="drawer-body">' +
      drawerListHtml(l) + '</div></div>';
  }

  action('llm-menu', () => { S.x.llmDrawer = true; render(); });
  action('llm-drawer-close', () => { S.x.llmDrawer = false; render(); });
  action('llm-new-chat', () => { const l = L(); l.cur = null; l.attach = null; S.x.llmDrawer = false; render(); });
  action('llm-switch', ds => { L().cur = ds.arg; S.x.llmDrawer = false; render(); });

  // 底部模型选择对话框（新对话态选 modelSel；有消息会话换模型则另起新对话）
  action('llm-pick', () => {
    const l = L(); const sess = curSess();
    const curId = sess ? sess.modelId : l.modelSel;
    showDialog({
      title: '选择模型',
      body: LLM_MODELS.map(m =>
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(m.name) +
        (m.multiModal ? ' <span class="badge soft">多模态</span>' : '') + (m.local ? ' <span class="badge soft">本地</span>' : '') + '</div>' +
        '<div class="li-sub">' + fmtSize(m.size) + (m.multiModal ? ' · 支持图片输入' : '') + '</div></div>' +
        (curId === m.id ? '<span class="badge soft">当前</span>' : textBtn('选用', 'llm-pick-choose', JSON.stringify(m))) + '</div>').join(''),
      actions: [{ label: '取消' }]
    });
  });
  action('llm-pick-choose', ds => {
    const m = JSON.parse(ds.arg);
    const l = L(); const sess = curSess();
    closeDialog();
    if (!sess) { l.modelSel = m.id; l.attach = null; render(); return; }
    if (!sess.messages.length) {
      mock.resetJob('llm-' + sess.id);
      sess.modelId = m.id; sess.modelName = m.name; sess.multiModal = m.multiModal;
      sess.local = m.local; sess.size = m.size; sess.loaded = false; sess.attach = null;
      startSessJob(sess); render(); return;
    }
    // 已有对话：保留旧会话，以新模型开新对话
    l.modelSel = m.id; l.attach = null;
    const ns = createSession(m);
    l.cur = ns.id;
    startSessJob(ns);
    render();
  });
  function createSession(m) {
    const l = L();
    const sess = {
      id: 's' + Date.now() + Math.floor(Math.random() * 999), title: '新对话',
      modelId: m.id, modelName: m.name, multiModal: m.multiModal,
      local: m.local, size: m.size, messages: [], tokens: 0, attach: null
    };
    l.sessions.unshift(sess);
    return sess;
  }
  function startSessJob(sess) {
    const key = 'llm-' + sess.id;
    if (sess.local) mock.startJob(key, '加载模型', 1800, ['加载权重', '预热 KV 缓存']);
    else mock.startJob(key, '下载并加载 ' + sess.modelName, 3600, ['准备引擎', '下载模型', '校验', '加载权重']);
    const t = setInterval(() => {
      if (mock.isJobDone(key)) {
        sess.loaded = true; clearInterval(t);
        if (sess.pending) { sess.pending = false; doReply(sess); }
        render();
      }
    }, 300);
  }
  // 流式回复（模型就绪后调用）
  function doReply(sess) {
    sess.thinking = true; sess.partial = '';
    render();
    const lastUser = [...sess.messages].reverse().find(x => x.role === 'user');
    const q = lastUser ? lastUser.text : '';
    const reply = '这是模拟回复：端侧模型已收到你的消息' + (lastUser && lastUser.img != null ? '（含 1 张图片）' : '') +
      (q ? '「' + q + '」' : '') + '。在原型中，对话内容用于验证多会话、消息气泡、图片附件、流式输出与上下文压缩行为。';
    let i = 0;
    const t = setInterval(() => {
      // 已被停止：丢弃后续输出
      if (!sess.thinking) { clearInterval(t); return; }
      sess.partial = reply.slice(0, i += 4);
      if (i >= reply.length) {
        clearInterval(t);
        sess.messages.push({ role: 'ai', text: reply });
        sess.tokens += reply.length / 2;
        sess.thinking = false;
      }
      render();
      const c = document.getElementById('chat'); if (c) c.scrollIntoView({ block: 'end' });
    }, 60);
  }
  action('llm-stop', () => {
    const sess = curSess();
    if (!sess) return;
    sess.thinking = false;
    if (sess.partial) {
      sess.messages.push({ role: 'ai', text: sess.partial });
      sess.tokens += sess.partial.length / 2;
      sess.partial = '';
    }
    render();
  });
  // F8：复制 / 重新生成 / 编辑重发
  action('llm-copy', ds => {
    const sess = curSess();
    const msg = sess && sess.messages[+ds.arg];
    if (!msg) return;
    try { navigator.clipboard.writeText(msg.text); } catch (e) { /* file:// 或无权限时忽略 */ }
    toast('已复制到剪贴板');
  });
  action('llm-regen', () => {
    const sess = curSess();
    if (!sess || sess.thinking) return;
    // 移除最后一条 AI 回复（若有），保留用户提问，重新生成
    const last = sess.messages[sess.messages.length - 1];
    if (last && last.role === 'ai') { sess.tokens = Math.max(0, sess.tokens - last.text.length / 2); sess.messages.pop(); }
    doReply(sess);
  });
  action('llm-edit-last', () => {
    const sess = curSess();
    if (!sess || sess.thinking) return;
    const last = sess.messages[sess.messages.length - 1];
    if (!last || last.role !== 'user') return;
    // 移除末尾 user+ai 对，文本回填输入框重新编辑
    sess.messages.pop();
    if (sess.messages.length && sess.messages[sess.messages.length - 1].role === 'ai') sess.messages.pop();
    S.x.keep = S.x.keep || {};
    S.x.keep['llm-q'] = last.text || '';
    if (sess.title !== '新对话' && sess.messages.filter(m => m.role === 'user').length === 0) sess.title = '新对话';
    render();
    toast('已载入上一条消息，修改后重新发送');
  });
  action('llm-del-sess', ds => confirmDialog('删除会话', '将删除该会话的全部对话记录。', '删除', () => {
    const l = L();
    mock.resetJob('llm-' + ds.arg);
    l.sessions = l.sessions.filter(s => s.id !== ds.arg);
    if (l.cur === ds.arg) l.cur = (l.sessions[0] || {}).id || null;
    render();
  }, true));
  action('llm-reload', ds => {
    const sess = L().sessions.find(s => s.id === ds.arg);
    if (sess) startSessJob(sess);
    render();
  });
  action('llm-cancel', ds => { mock.resetJob('llm-' + ds.arg); render(); });
  // 抽屉底部"推理设置"：按当前会话模型（无会话则按 modelSel）进入配置页
  action('llm-settings', () => {
    const sess = curSess();
    const id = sess ? sess.modelId : L().modelSel;
    S.x.lcId = id;
    S.x.llmDrawer = false;
    nav.push('llm-config', id);
  });

  action('llm-attach', () => {
    const l = L();
    const sess = curSess();
    const canImg = sess ? sess.multiModal : (LLM_MODELS.find(x => x.id === l.modelSel) || {}).multiModal;
    if (!canImg) {
      if (sess) sess.messages.push({ role: 'sys', text: '当前模型不支持图片输入，附件已忽略' });
      else toast('当前模型不支持图片输入');
      render(); return;
    }
    const imgs = (S.x.assets || []).filter(a => a.kind === 'image');
    showDialog({
      title: '选择图片（素材库）',
      body: imgs.length ? '<div class="pick-grid">' + imgs.map(a =>
        '<div class="pick-cell" data-a="llm-pick-img" data-arg="' + a.id + '" title="' + esc(a.label) + '" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))"></div>').join('') + '</div>'
        : emptyHint('素材库暂无图片，请先到素材页导入'),
      actions: [{ label: '取消' }]
    });
  });
  action('llm-pick-img', ds => {
    const l = L(); const sess = curSess();
    if (sess) sess.attach = ds.arg; else l.attach = ds.arg;
    closeDialog(); render();
  });
  action('llm-unattach', () => {
    const l = L(); const sess = curSess();
    if (sess) sess.attach = null; else l.attach = null;
    render();
  });

  action('llm-send', () => {
    const l = L();
    let sess = curSess();
    const q = ((S.x.keep && S.x.keep['llm-q']) || '').trim();
    const imgId = sess ? sess.attach : l.attach;
    if (!q && !imgId) return;
    if (sess && (!sess.loaded || sess.thinking)) return;
    if (!sess) {
      // 新对话：以当前所选模型建会话（首条消息触发下载/加载，就绪后自动回复）
      const m = LLM_MODELS.find(x => x.id === l.modelSel) || LLM_MODELS[0];
      sess = createSession(m);
      l.cur = sess.id;
      startSessJob(sess);
    }
    const img = imgId && (S.x.assets || []).find(a => a.id === imgId);
    sess.messages.push({ role: 'user', text: q, img: img ? img.hue : null });
    if (sess.title === '新对话' && q) sess.title = q.slice(0, 12) + (q.length > 12 ? '…' : '');
    sess.tokens += q.length / 2 + (imgId ? 512 : 0); // 图片按固定 token 估算
    sess.attach = null; l.attach = null;
    if (S.x.keep) S.x.keep['llm-q'] = '';
    // 接近上下文上限时自动压缩
    const cfg = cfgOf(sess.modelId);
    if (sess.tokens > cfg.ctxLen * 0.8) {
      const n = sess.messages.filter(x => x.role !== 'sys').length;
      sess.tokens = Math.round(sess.tokens * 0.5);
      sess.messages.push({ role: 'sys', text: '上下文接近上限，已自动压缩 ' + n + ' 条历史消息' });
    }
    if (!sess.loaded) { sess.pending = true; render(); return; }
    doReply(sess);
  });

  // ---------- LLM 推理配置（子页，按模型独立保存） ----------
  registerScreen('llm-config', {
    title: 'LLM 推理配置',
    render(arg) {
      S.x.lcId = arg || S.x.lcId;
      const m = LLM_MODELS.find(x => x.id === S.x.lcId) || { name: S.x.lcId };
      const cfg = cfgOf(S.x.lcId);
      const sl = (label, k, min, max, step, fmt) =>
        '<label class="slider-row"><span class="li-title">' + esc(label) + ' ' + fmt(cfg[k]) + '</span>' +
        '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + cfg[k] + '" class="slider" data-live="lc-set" data-k="' + k + '"></label>';
      let h = '<div class="dl-status" style="padding:8px 2px 0">当前模型：' + esc(m.name) + '</div>';
      h += card(
        sl('上下文长度', 'ctxLen', 2048, 32768, 1024, v => v) +
        '<label class="field"><span class="field-label">种子（-1 为随机）</span>' +
        '<input class="field-input" type="number" value="' + cfg.seed + '" data-live="lc-seed"></label>' +
        sl('推理强度（温度）', 'temp', 0, 1.5, 0.05, v => (+v).toFixed(2)) +
        '<div class="muted small" style="padding-top:6px">推理方式</div><div class="chip-row" style="padding-top:4px">' +
        ['cpu', 'gpu', 'npu'].map(d => chip(d.toUpperCase(), cfg.device === d, 'lc-device', d)).join('') + '</div>' +
        sl('线程数', 'threads', 1, 8, 1, v => v) +
        sl('批大小', 'batch', 8, 512, 8, v => v) +
        '<div class="muted small" style="padding-top:6px">KV 缓存量化</div><div class="chip-row" style="padding-top:4px">' +
        ['FP16', 'Q8_0', 'Q4_0'].map(kv => chip(kv, cfg.kv === kv, 'lc-kv', kv)).join('') + '</div>');
      h += '<div style="margin-top:12px;display:flex;gap:8px">' +
        btn('恢复默认', 'lc-reset', null, 'ghost') + btn('完成', 'lc-done', null, 'flex') + '</div>';
      h += '<div class="muted small center" style="padding:12px">配置按模型独立保存，切换模型互不影响。</div>';
      return h;
    }
  });
  action('lc-set', (ds, el) => {
    const cfg = cfgOf(S.x.lcId); const k = ds.k;
    cfg[k] = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) {
      const base = lb.textContent.replace(/ [\d.]+$/, '');
      lb.textContent = base + ' ' + (k === 'temp' ? (+cfg[k]).toFixed(2) : cfg[k]);
    }
  });
  action('lc-seed', (ds, el) => { cfgOf(S.x.lcId).seed = +el.value; });
  action('lc-device', ds => { cfgOf(S.x.lcId).device = ds.arg; render(); });
  action('lc-kv', ds => { cfgOf(S.x.lcId).kv = ds.arg; render(); });
  action('lc-reset', () => { S.x.llmCfg[S.x.lcId] = Object.assign({}, LLM_DEF); render(); });
  action('lc-done', () => nav.pop());
})();
