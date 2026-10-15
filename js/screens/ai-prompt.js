// 提示词库子页 + 提示词编辑子页（第十八轮新增）。对应（规划中）ui/ai/PromptLibraryScreen.kt、PromptEditScreen.kt
(function () {
  const CATS = ['全部', '人物', '场景', '风格', '负面', '收藏'];

  registerScreen('prompts', {
    title: '提示词库',
    topRight: { icon: 'add', act: 'prompt-new' },
    render() {
      const cat = S.x.promptCat || '全部';
      const kw = ((S.x.keep && S.x.keep['prompt-q']) || '').trim().toLowerCase();
      const list = DB.PROMPTS.filter(p => {
        if (cat === '收藏' && !p.fav) return false;
        if (cat !== '全部' && cat !== '收藏' && p.cat !== cat) return false;
        if (kw && (p.title + ' ' + p.text).toLowerCase().indexOf(kw) < 0) return false;
        return true;
      });
      let h = '<div class="chip-row" style="position:sticky;top:-8px;z-index:3;background:var(--bg);padding-top:10px">' +
        CATS.map(c => chip(c, cat === c, 'prompt-cat', c)).join('') + '</div>';
      h += card('<div class="msg-row" style="margin-top:0">' + icon('search', 'small') +
        '<input class="field-input" style="flex:1" data-keep="prompt-q" placeholder="搜索标题或内容…" value="' + esc((S.x.keep && S.x.keep['prompt-q']) || '') + '"></div>');
      h += list.length ? list.map(p =>
        '<div class="card" data-a="prompt-edit" data-arg="' + p.id + '" style="cursor:pointer">' +
        '<div class="dl-row"><div class="li-title" style="flex:1;font-weight:400">' + esc(p.title) + '</div>' +
        '<button class="icbtn" data-a="prompt-fav" data-arg="' + p.id + '" title="收藏">' + icon(p.fav ? 'favorite' : 'favorite_border') + '</button></div>' +
        '<div class="li-sub" style="white-space:normal;word-break:break-all">' + esc(p.text) + '</div>' +
        '<div class="tag-row"><span class="achip tag-kind">' + esc(p.cat) + '</span>' +
        (p.uses ? '<span class="achip">使用 ' + p.uses + ' 次</span>' : '') + '</div></div>'
      ).join('') : card('<div class="muted small center" style="padding:18px">当前分类/搜索下没有条目；点右上角 ＋ 新建一条。</div>');
      // 词库与补全（danbooru.csv 进下载页；翻译 CSV 支持母语搜索）
      h += sectionTitle('词库与补全');
      h += card(listItem({
        icon: 'cloud_download', title: 'Danbooru 标签词库',
        sub: '约 14 万条 · 3.5 MB · 生图页输入时补全（前缀 > 包含 > 翻译）',
        trailing: textBtn('下载', 'prompt-dict-dl')
      }) + '<div class="hr"></div>' + listItem({
        icon: 'language', title: '导入翻译 CSV',
        sub: 'tag,…,翻译（取最后一个非空列），支持用中文搜标签',
        arrow: true, action: 'prompt-dict-import'
      }), 'tight');
      return h;
    }
  });
  action('prompt-cat', ds => { S.x.promptCat = ds.arg; render(); });
  action('prompt-fav', ds => {
    const p = DB.PROMPTS.find(x => x.id === ds.arg);
    if (p) p.fav = !p.fav;
    render();
  });
  action('prompt-dict-dl', () => {
    mock.enqueue('danbooru.csv', 3600000, { kind: 'model' });
    toast('已加入下载队列：Danbooru 词库，完成后生图页自动启用补全');
  });
  action('prompt-dict-import', () => toast('已导入翻译 CSV（模拟 OpenDocument）：中文搜索标签已启用'));

  // ---------- 提示词编辑（新建 / 编辑） ----------
  registerScreen('prompt-edit', {
    title: '编辑提示词',
    render(arg) {
      const p = DB.PROMPTS.find(x => x.id === arg);
      const isNew = !p;
      const title = p ? p.title : '';
      const text = p ? p.text : '';
      const cat = p ? p.cat : '人物';
      S.x.pe = S.x.pe || {};
      if (S.x.pe.id !== (arg || 'new')) {
        S.x.pe = { id: arg || 'new', cat };
        S.x.keep = S.x.keep || {};
        S.x.keep['pe-title'] = title;
        S.x.keep['pe-text'] = text;
      }
      return card(
        '<label class="field"><span class="field-label">标题</span>' +
        '<input class="field-input" data-keep="pe-title" placeholder="如：通用女主角" value="' + esc(title) + '"></label>' +
        '<label class="field"><span class="field-label">内容（英文，逗号分隔）</span>' +
        '<textarea class="field-input" rows="5" data-keep="pe-text" placeholder="1girl, solo, …">' + esc(text) + '</textarea></label>' +
        '<div class="muted small">分类</div><div class="chip-row" style="padding-top:4px">' +
        ['人物', '场景', '风格', '负面'].map(c => chip(c, S.x.pe.cat === c, 'pe-cat', c)).join('') + '</div>') +
        '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
        btn(isNew ? '保存' : '保存修改', 'pe-save', arg, '') +
        btn('插入到生图页', 'pe-insert', arg, 'ghost') + '</div>' +
        '<div class="muted small center" style="padding:12px">「插入到生图页」会把内容填入图片生成页的提示词框。</div>';
    }
  });
  action('pe-cat', ds => { S.x.pe.cat = ds.arg; render(); });
  action('pe-save', ds => {
    const title = ((S.x.keep && S.x.keep['pe-title']) || '').trim();
    const text = ((S.x.keep && S.x.keep['pe-text']) || '').trim();
    if (!title || !text) { toast('标题与内容都不能为空'); return; }
    const p = DB.PROMPTS.find(x => x.id === ds.arg);
    if (p) {
      p.title = title; p.text = text; p.cat = S.x.pe.cat;
      toast('已保存修改');
    } else {
      DB.PROMPTS.unshift({ id: 'p' + Date.now(), cat: S.x.pe.cat, title, text, fav: false, uses: 0 });
      toast('已加入提示词库');
    }
    nav.pop();
  });
  action('pe-insert', ds => {
    const text = ((S.x.keep && S.x.keep['pe-text']) || '').trim();
    if (!text) { toast('内容为空，无法插入'); return; }
    keepSet('diff-prompt', text);
    if (S.x.ai && S.x.ai.diff) S.x.ai.diff.prompt = text;
    nav.goTab('ai');
    nav.push('diffusion');
    toast('已填入生图页提示词');
  });
  action('prompt-new', () => nav.push('prompt-edit', ''));
  action('prompt-edit', ds => nav.push('prompt-edit', ds.arg));
})();
