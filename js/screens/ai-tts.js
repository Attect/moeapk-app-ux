// 语音生成子页 + 音色管理子页。对应 ui/ai/TtsScreen.kt、TtsVoicesScreen.kt
(function () {
  const { A, jobBar } = window._aiShared;

  registerScreen('tts', { title: '语音生成', topRight: { icon: 'menu', act: 'tts-menu' }, render: ttsPage });

  // ---------- 语音生成（独立子页：合成记录抽屉 + 底部输入区） ----------
  const T = () => A().tts = A().tts || { device: 'cpu', text: '你好，我是 MoeApk 的端侧语音合成。', voice: (S.x.voices[0] || {}).name || null, modelReady: false, curId: null, history: [] };

  function ttsPage() {
    const t = T();
    const wide = isWide();
    let h = wide ? '<div class="chat-page two-pane"><div class="pane-side">' + ttsHistHtml() + '</div><div class="pane-main">'
      : '<div class="chat-page">';
    // 主区域：模型下载 / 合成进度 / 当前结果 / 空态
    const j = mock.job('tts-synth');
    const mdl = mock.job('tts-dl');
    if (!t.modelReady && !(mdl && !mdl.done)) {
      h += '<div style="padding-top:8px">' + card(
        '<div class="dl-status">语音合成模型未下载</div>' +
        '<div style="margin-top:8px">' + btn('下载模型（' + fmtSize(534000000) + '）', 'tts-dl', null, 'small') + '</div>') + '</div>';
    } else if (mdl && !mdl.done) {
      h += '<div style="padding-top:8px">' + card(
        '<div class="dl-status">下载模型 · ' + esc(mdl.phase || '') + ' · ' + Math.round(mdl.p * 100) + '%</div>' +
        '<div style="margin-top:6px">' + progress(mdl.p) + '</div>') + '</div>';
    } else if (j && !j.done) {
      h += '<div style="padding-top:8px">' + card(
        '<div class="dl-status">合成中 · ' + esc(j.phase || '') + ' · ' + Math.round(j.p * 100) + '%</div>' +
        '<div style="margin-top:6px">' + progress(j.p) + '</div>') + '</div>';
    } else if (t.curId) {
      const r = t.history.find(x => x.id === t.curId);
      if (r) {
        let bars = '';
        for (let i = 0; i < 24; i++) {
          const bh = 12 + Math.round(44 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
          bars += '<i style="height:' + (r.playing ? bh : Math.round(bh * 0.45)) + 'px"></i>';
        }
        h += '<div style="padding-top:8px">' + card(
          '<div class="av-audio" style="border-radius:10px">' +
          '<button class="bigplay" data-a="tts-play">' + icon(r.playing ? 'pause' : 'play_arrow') + '</button>' +
          '<div class="wave">' + bars + '</div>' +
          '<div style="color:rgba(255,255,255,.7);font-size:12px">' + esc(r.label) + ' · ' + esc(r.dur) + ' · ' + (t.device === 'qnn' ? 'NPU' : 'CPU') + '</div></div>' +
          '<div class="muted" style="font-size:12px;margin-top:8px;word-break:break-all">' + esc(r.text) + '</div>' +
          '<div style="margin-top:10px">' + btn('保存到素材', 'tts-save-asset', null, 'small') + '</div>') + '</div>';
      }
    } else {
      h += '<div class="chat-empty">' + icon('play_arrow') +
        '<div style="font-size:16px;color:var(--on-surface)">输入文本，开始合成</div>' +
        '<div class="muted small">底部输入文本并选择音色；合成记录与音色管理在右上角菜单。</div></div>';
    }
    // 底部输入区：音色选择 + 推理方式 / 文本 + 合成
    const voice = (S.x.voices || []).find(v => v.name === t.voice);
    const textLen = ((S.x.keep && S.x.keep['tts-text']) || t.text || '').length;
    const estSec = Math.max(1, Math.round(textLen / 4.2));
    h += '<div class="composer">' +
      '<div class="composer-top">' +
      '<button class="chip model-chip" data-a="tts-voice-pick">' + icon('person') + '<span>' + esc(voice ? voice.name : '默认音色') + '</span>' + icon('expand_more') + '</button>' +
      '<div class="chip-row" style="padding:0;flex:1;justify-content:flex-end;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">' +
      chip('CPU', t.device === 'cpu', 'tts-device', 'cpu') + chip('NPU', t.device === 'qnn', 'tts-device', 'qnn') + '</div></div>' +
      '<div class="msg-row">' +
      '<input class="field-input" style="flex:1" data-keep="tts-text" placeholder="输入要合成的文本…" value="' + esc(t.text) + '">' +
      '<button class="btn" style="min-height:48px;padding:0 18px" data-a="tts-synth">' + icon('play_arrow') + '</button></div>' +
      // F12：字数 / 预计时长提示
      '<div class="muted" style="font-size:11px;margin-top:4px;text-align:right">' + textLen + ' 字 · 约 ' + estSec + ' 秒（按 4.2 字/秒估算）</div>' +
      '</div>';
    if (!wide && S.x.ttsDrawer) h += ttsDrawerHtml();
    return h + (wide ? '</div></div>' : '</div>');
  }

  // 合成记录主体：抽屉（窄屏 overlay）与双栏侧栏（≥920px 常驻）共用；F10 支持搜索
  function ttsHistHtml() {
    const t = T();
    const kw = ((S.x.keep && S.x.keep['tts-hist-q']) || '').trim().toLowerCase();
    const list = kw ? t.history.filter(r => (r.text || '').toLowerCase().indexOf(kw) >= 0 || (r.label || '').toLowerCase().indexOf(kw) >= 0) : t.history;
    const items = list.map(r =>
      '<div class="d-sess' + (t.curId === r.id ? ' on' : '') + '" data-a="tts-hist" data-arg="' + r.id + '">' +
      '<span class="li-icon">' + icon('play_arrow') + '</span>' +
      '<div class="d-body"><div class="d-title">' + esc(r.label) + '</div>' +
      '<div class="d-sub">' + esc(r.text) + ' · ' + esc(r.dur) + '</div></div>' +
      '<button class="d-del" data-a="tts-hist-del" data-arg="' + r.id + '" title="删除">' + icon('close') + '</button></div>').join('');
    return '<div class="d-head"><span>合成记录</span><span class="muted small">' + t.history.length + ' 条</span></div>' +
      '<div style="padding:0 12px 10px"><div class="search-box">' + icon('search') +
      '<input class="field-input" data-keep="tts-hist-q" placeholder="搜索文本…" value="' + esc((S.x.keep && S.x.keep['tts-hist-q']) || '') + '"></div></div>' +
      '<div style="padding:0 12px 10px">' + btn('＋ 新建合成', 'tts-new', null, 'small block ghost') + '</div>' +
      '<div class="d-list">' + (items || '<div class="muted small center" style="padding:24px 0">' + (kw ? '没有匹配的记录' : '暂无合成记录') + '</div>') + '</div>' +
      '<div class="d-foot" data-a="tts-settings">' + icon('settings') + '<span>音色管理</span></div>';
  }
  function ttsDrawerHtml() {
    return '<div class="drawer-mask" data-a="tts-drawer-close"><div class="drawer" data-a="drawer-body">' +
      ttsHistHtml() + '</div></div>';
  }
  action('tts-menu', () => { S.x.ttsDrawer = true; render(); });
  action('tts-drawer-close', () => { S.x.ttsDrawer = false; render(); });
  action('tts-new', () => { T().curId = null; S.x.ttsDrawer = false; render(); });
  action('tts-hist', ds => { T().curId = ds.arg; S.x.ttsDrawer = false; render(); });
  // I2 轻删：合成记录删除走 toast 撤销
  action('tts-hist-del', ds => {
    const t = T();
    const r = t.history.find(x => x.id === ds.arg);
    if (!r) return;
    const idx = t.history.indexOf(r);
    t.history.splice(idx, 1);
    if (t.curId === ds.arg) t.curId = null;
    toast('已删除合成记录', { act: 'tts-hist-undo', arg: JSON.stringify({ r, idx }), label: '撤销' });
    render();
  });
  action('tts-hist-undo', ds => {
    const d = JSON.parse(ds.arg);
    T().history.splice(Math.min(d.idx, T().history.length), 0, d.r);
    render();
  });
  action('tts-settings', () => { S.x.ttsDrawer = false; nav.push('tts-voices'); });

  // 音色选择对话框（含音色管理入口 + 试听）
  action('tts-voice-pick', () => {
    const t = T();
    showDialog({
      title: '选择音色',
      body: ((S.x.voices || []).length ? S.x.voices.map(v =>
        '<div class="li"><span class="li-icon">' + icon('person') + '</span><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(v.name) + '</div>' +
        '<div class="li-sub">' + esc(v.note) + '</div></div>' +
        '<button class="icbtn" data-a="tts-voice-listen" data-arg="' + esc(v.name) + '" title="试听">' + icon(S.x.listenVoice === v.name ? 'pause' : 'play_arrow') + '</button>' +
        (t.voice === v.name ? '<span class="badge soft">当前</span>' : textBtn('选用', 'tts-voice-choose', v.name)) + '</div>').join('') :
        '<div class="muted small center" style="padding:14px 0">暂无音色，请先在"音色管理"中克隆</div>') +
        '<div class="hr"></div>' +
        '<div class="li" data-a="tts-settings"><div class="li-body"><div class="li-title" style="font-weight:400">音色管理 / 克隆新音色</div></div>' +
        '<span class="li-arrow">' + icon('keyboard_arrow_right') + '</span></div>',
      actions: [{ label: '取消' }]
    });
  });
  action('tts-voice-listen', ds => {
    if (S.x.listenVoice === ds.arg) { S.x.listenVoice = null; render(); return; }
    S.x.listenVoice = ds.arg;
    render();
    toast('试听：' + ds.arg + '（模拟播放 3 秒）');
    setTimeout(() => { if (S.x.listenVoice === ds.arg) { S.x.listenVoice = null; render(); } }, 3000);
  });
  action('tts-voice-choose', ds => { T().voice = ds.arg; closeDialog(); render(); });

  action('tts-device', ds => { T().device = ds.arg; render(); });
  action('tts-dl', () => {
    mock.startJob('tts-dl', '下载模型', 3000, ['源 1', '校验']);
    const t = setInterval(() => {
      const job = mock.job('tts-dl');
      if (!job) { clearInterval(t); return; }
      if (job.done) { T().modelReady = true; clearInterval(t); render(); }
    }, 300);
    render();
  });
  action('tts-synth', () => {
    const t = T();
    t.text = (S.x.keep && S.x.keep['tts-text']) || t.text;
    if (!t.text.trim()) { toast('请输入要合成的文本'); return; }
    if (!t.modelReady) { toast('模型未下载，请先下载模型'); return; }
    mock.startJob('tts-synth', '合成语音', 2400, t.device === 'qnn' ? ['NPU 实时路径'] : ['CPU 异步']);
    const timer = setInterval(() => {
      const job = mock.job('tts-synth');
      if (!job) { clearInterval(timer); return; } // 被取消
      if (job.done) {
        clearInterval(timer);
        const r = { id: 'v' + Date.now(), label: '合成 ' + (t.history.length + 1), text: t.text, dur: '0:0' + (4 + t.history.length % 5), playing: false };
        t.history.unshift(r);
        t.curId = r.id;
        render();
      }
    }, 300);
    render();
  });
  action('tts-play', () => {
    const t = T();
    const r = t.history.find(x => x.id === t.curId);
    if (!r) return;
    r.playing = !r.playing;
    render();
    if (r.playing) setTimeout(() => { if (r.playing) { r.playing = false; render(); } }, 6000);
  });
  action('tts-save-asset', () => {
    const t = T();
    const r = t.history.find(x => x.id === t.curId);
    if (!r) return;
    S.x.assets.unshift({ id: 'as' + Date.now(), kind: 'audio', hue: 268, label: r.label, date: '2026-09-18', meta: '8' });
    toast('已保存到素材库，可在素材页播放');
  });

  // ---------- 音色管理（子页：克隆 + 已保存音色） ----------
  registerScreen('tts-voices', {
    title: '音色管理',
    render() {
      let h = '';
      h += sectionTitle('克隆新音色（语音克隆）');
      h += card(
        btn('从素材选择音频', 'tts-clone-pick', null, 'small ghost') +
        (S.x.cloneAudio ? '<div class="dl-status" style="margin-top:8px">已选择：' + esc(S.x.cloneAudio) + '</div>' : '') +
        field({ id: 'tts-ref-text', label: '参考音频的文本内容（必填）' }) +
        '<div style="margin-top:10px">' + btn('编码并保存音色', 'tts-encode', null, 'small') + '</div>' +
        jobBar('tts-encode', '音色已保存'));
      h += sectionTitle('已保存音色');
      h += card((S.x.voices || []).length ?
        '<div class="card tight" style="padding:0;margin-top:0">' + S.x.voices.map(v =>
          '<div class="li"><span class="li-icon">' + icon('person') + '</span><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(v.name) + '</div>' +
          '<div class="li-sub">' + esc(v.note) + '</div></div>' +
          (T().voice === v.name ? '<span class="badge soft">当前</span>' : textBtn('选用', 'tts-voice', v.name)) +
          textBtn('删除', 'tts-voice-del', v.name, 'danger') + '</div>').join('') + '</div>' :
        '<div class="muted small center" style="padding:8px 0">暂无音色</div>');
      return h;
    }
  });
  action('tts-clone-pick', () => {
    const auds = (S.x.assets || []).filter(a => a.kind === 'audio');
    if (!auds.length) { toast('素材库暂无音频，可先保存合成结果'); return; }
    showDialog({
      title: '选择参考音频（素材库）',
      body: auds.map(a =>
        '<div class="li" data-a="tts-clone-choose" data-arg="' + a.id + '"><span class="li-icon">' + icon('play_arrow') + '</span>' +
        '<div class="li-body"><div class="li-title" style="font-weight:400">' + esc(a.label) + '</div></div>' +
        '<span class="li-arrow">' + icon('keyboard_arrow_right') + '</span></div>').join(''),
      actions: [{ label: '取消' }]
    });
  });
  action('tts-clone-choose', ds => {
    const a = (S.x.assets || []).find(x => x.id === ds.arg);
    if (a) S.x.cloneAudio = a.label;
    closeDialog(); render();
  });
  action('tts-encode', () => {
    mock.startJob('tts-encode', '编码参考音色', 1500, ['提取特征']);
    const t = setInterval(() => {
      const job = mock.job('tts-encode');
      if (!job) { clearInterval(t); return; }
      if (job.done) {
        clearInterval(t);
        S.x.voices.push({ name: 'voice_' + (S.x.voices.length + 1), note: '本地参考音色 · ' + (S.x.cloneAudio || '素材音频') });
        S.x.cloneAudio = '';
        render();
      }
    }, 300);
    render();
  });
  action('tts-voice', ds => { T().voice = ds.arg; render(); });
  action('tts-voice-del', ds => confirmDialog('删除参考音色', '删除后不可恢复。', '删除', () => {
    S.x.voices = S.x.voices.filter(v => v.name !== ds.arg);
    if (T().voice === ds.arg) T().voice = null;
    render();
  }, true));
})();
