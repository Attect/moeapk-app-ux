// 宅物 Tab：陈列室主页 / 展厅（分类瀑布流） / 展品卡（详情）
// 板块定案（2026-10）：策展式陈列，不是商城——
//   · 主页与展厅卡片不出现价格红字；主页分类卡只图+名，列表页价格小字弱化；
//   · 无销量、无促销、无"买"字：主按钮为「去淘宝看看」；
//   · 来源披露压到最短：主页/详情页各一句小字（措辞略分工），列表页不放；
//   · 陈列备注由 AI 生成 + 人工抽查（抽查可关）。
// 对应（规划中）：ui/goods/GoodsHomeScreen.kt、GoodsCatScreen.kt、GoodsDetailScreen.kt
(function () {
  const catById = id => (DB.GOODS_CATS || []).find(c => c.id === id);
  const goodById = id => (DB.GOODS || []).find(g => g.id === id);
  const goodsByCat = cid => (DB.GOODS || []).filter(g => g.cat === cid);
  const fmtPrice = p => '¥' + (p % 1 ? p.toFixed(1) : String(p));

  // 按 seed 稳定的伪随机：换一批 / 随手翻翻 改变 seed 重排，render 之间不漂移
  function rng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  // 展品封面：优先真实商品图（images，淘宝 CDN；失败移除 img 回落 emoji 渐变占位）。
  // 无图时用 emoji + 色相渐变占位（演示数据形态）。v 0/1/2 取多图/变体，详情页 pager 用。
  function cover(g, v) {
    const vi = v || 0;
    const img = g.images && g.images.length ? g.images[Math.min(vi, g.images.length - 1)] : null;
    const ph = '<span>' + (g.emoji || '🎁') + '</span>';
    if (img) {
      return '<div class="g-cover v' + vi + '" style="--gh:' + (g.hue == null ? 300 : g.hue) + '">' + ph +
        '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()"></div>';
    }
    return '<div class="g-cover v' + vi + '" style="--gh:' + (g.hue == null ? 300 : g.hue) + '">' + ph + '</div>';
  }
  // 来源披露统一为一句小字：主页与详情页措辞略有分工，列表页不放
  function legalLine() {
    return '<div class="g-legal">数据来自淘宝推广渠道</div>';
  }
  function legalLineDetail() {
    return '<div class="g-legal">信息来自淘宝推广渠道，此处仅作展示不进行交易</div>';
  }

  // ---------- 主页：杂志式错落分类墙 ----------
  registerScreen('tab:goods', {
    title: '宅物',
    render() {
      const seed = S.x.goodsSeed || 0;
      const rand = rng(seed * 1009 + 7);
      let h = '<div class="g-hero"><div class="g-hero-title">看看有什么好东西</div></div>';

      // 新入荷：收录最近的 8 件（卡片只署名不标价）
      const fresh = (DB.GOODS || []).slice().sort((a, b) => a.days - b.days).slice(0, 8);
      h += '<div class="sec-head"><span class="sec-title">新入荷</span></div>' +
        '<div class="g-fresh">' + fresh.map(g => {
          const c = catById(g.cat);
          return '<div class="g-fresh-card" data-a="goods-open" data-arg="' + g.id + '">' +
            cover(g) +
            '<div class="g-fresh-name">' + esc(g.title) + '</div>' +
            '<div class="g-fresh-cat">' + esc(c ? c.name : '') + ' · ' + g.days + ' 天前</div></div>';
        }).join('') + '</div>';

      // 展厅：分类乱序 + 每厅随机抽一件展品做封面；卡幅按固定节奏（6 列网格）
      const SPANS = [[4, 148], [2, 148], [2, 112], [2, 124], [2, 112], [3, 136], [3, 136], [2, 128], [4, 128], [3, 120], [3, 132], [2, 108], [2, 120], [2, 108]];
      h += '<div class="sec-head"><span class="sec-title">展厅</span>' + textBtn('换一批', 'goods-reshuffle') + '</div>';
      h += '<div class="g-mosaic">';
      shuffle(DB.GOODS_CATS || [], rand).forEach((c, i) => {
        const items = goodsByCat(c.id);
        if (!items.length) return;
        const g = items[Math.floor(rand() * items.length)];
        const sp = SPANS[i % SPANS.length];
        h += '<div class="g-mos-card" style="grid-column:span ' + sp[0] + ';height:' + sp[1] + 'px" data-a="goods-open-cat" data-arg="' + c.id + '">' +
          cover(g) +
          '<div class="g-mos-label"><div class="g-mos-name">' + esc(c.name) + '</div>' +
          '<div class="g-mos-sub">' + esc(c.sub) + '</div></div></div>';
      });
      h += '</div>' + legalLine();
      return h;
    }
  });
  action('goods-reshuffle', () => {
    S.x.goodsSeed = (S.x.goodsSeed || 0) + 1;
    render();
    toast('陈列已重新摆放');
  });

  // ---------- 展厅（分类页）：无限双列瀑布流，偏小红书 ----------
  // 滚动接近底部自动追加下一批（对应 App 侧 Paging 懒加载 + 服务端分页下发；
  // 真机数据耗尽自然到底，没有"到底啦"提示，底部也不放任何说明文字）。
  // 原型数据有限：批次循环复用本厅展品，批间换序换比例，避免机械重复感。
  const ARS = ['1/1', '4/5', '3/4', '4/3']; // 封面比例按 id 哈希错开，瀑布有高差
  const MAX_BATCH = 40; // 原型安全上限（防 DOM 无限增长），真机无此概念
  function fallCard(g, batch) {
    // 第 1 批比例按 id 固定（首屏稳定）；后续批次叠加批号盐，同件展品每批高差不同
    const ar = ARS[(hashStr(g.id) + (batch > 1 ? batch * 7 : 0)) % ARS.length];
    const img = g.images && g.images.length ? g.images[0] : null;
    const inner = '<span>' + (g.emoji || '🎁') + '</span>' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : '');
    return '<div class="g-fall-card" data-a="goods-open" data-arg="' + g.id + '">' +
      '<div class="g-cover v0" style="--gh:' + (g.hue == null ? 300 : g.hue) + ';aspect-ratio:' + ar + '">' + inner + '</div>' +
      '<div class="g-fall-body"><div class="g-fall-title">' + esc(g.title) + '</div>' +
      '<div class="g-fall-meta"><span class="g-fall-price">' + fmtPrice(g.price) + '</span>' +
      '<span>' + g.days + ' 天前收录</span></div></div></div>';
  }
  // 一批的 HTML：第 1 批按当前排序原样；第 2 批起按批号盐重洗
  function fallBatch(cid, batch, sort) {
    let items = goodsByCat(cid);
    if (batch > 1) items = shuffle(items, rng(hashStr(cid) * 13 + batch * 7919));
    else if (sort === 'rand') items = shuffle(items, rng((S.x.goodsSeed || 0) * 31 + hashStr(cid)));
    else items = items.slice().sort((a, b) => a.days - b.days);
    return items.map(g => fallCard(g, batch)).join('');
  }
  // 批次计数按展厅留存：切走再回来 / 同屏重渲染（回顶按钮显隐等）都不丢已加载长度
  function batchesOf(cid) {
    S.x.goodsBatches = S.x.goodsBatches || {};
    return Math.min(MAX_BATCH, S.x.goodsBatches[cid] || 1);
  }
  registerScreen('goods-cat', {
    title: arg => { const c = catById(arg); return c ? c.name : '展厅'; },
    render(arg) {
      const c = catById(arg);
      if (!c) return emptyHint('展厅不存在');
      const sort = S.x.goodsSort || 'new';
      if (!goodsByCat(arg).length) return emptyHint('这个展厅还在布置中');
      let h = '<div class="g-cat-hero">' +
        '<div class="g-cat-emoji">' + c.emoji + '</div>' +
        '<div class="g-cat-titles"><div class="g-cat-name">' + esc(c.name) + '</div>' +
        '<div class="g-cat-sub">' + esc(c.sub) + '</div>' +
        '<div class="g-cat-blurb">' + esc(c.blurb) + '</div></div></div>';
      // 只有策展向排序：不提供价格/销量排序
      h += '<div class="chip-row">' +
        chip('最近收录', sort === 'new', 'goods-sort', 'new') +
        chip('随手翻翻', sort === 'rand', 'goods-sort', 'rand') + '</div>';
      const nb = batchesOf(arg);
      S.x.goodsBatches[arg] = nb;
      h += '<div class="g-falls">' +
        Array.from({ length: nb }, (_, i) => fallBatch(arg, i + 1, sort)).join('') + '</div>';
      // 内容不足一屏时滚动事件不会触发：渲染后自检补批直至溢出（每次 render 重查，到顶自停）
      setTimeout(() => {
        const el = document.getElementById('content');
        const cur = nav.current();
        if (!el || !cur || cur.page !== 'goods-cat' || cur.arg !== arg) return;
        if (el.scrollHeight < el.clientHeight + 400 && batchesOf(arg) < MAX_BATCH) {
          S.x.goodsBatches[arg] = batchesOf(arg) + 1;
          render();
        }
      }, 0);
      return h;
    }
  });
  action('goods-sort', ds => {
    S.x.goodsSort = ds.arg;
    const cur = nav.current(); // 排序一变旧位置无意义：批次归一从头看
    if (cur && cur.page === 'goods-cat' && S.x.goodsBatches) S.x.goodsBatches[cur.arg] = 1;
    render();
  });
  action('goods-open-cat', ds => nav.push('goods-cat', ds.arg));
  action('goods-open', ds => nav.push('goods-detail', ds.arg));

  // ---------- 展品卡（详情）：上图下文，底部固定「去淘宝看看」 ----------
  registerScreen('goods-detail', {
    title: '展品卡',
    render(arg) {
      const g = goodById(arg);
      if (!g) return emptyHint('这件展品已撤下');
      const c = catById(g.cat);
      const buying = S.x.buyFor === g.id;
      // 顶部图片 pager：scroll-snap 横滑；圆点由下方全局 scroll 监听直接改 class（不走 render）。
      // 页数 = 真实图片数（演示数据的占位图固定 3 页；单图商品只出 1 页）。
      const shots = Math.max(1, Math.min(3, (g.images && g.images.length) || 3));
      let h = '<div class="g-pager-wrap"><div class="g-pager">' +
        Array.from({ length: shots }, (_, v) => '<div class="g-shot">' + cover(g, v) + '</div>').join('') +
        '</div><div class="g-dots">' +
        Array.from({ length: shots }, (_, i) => '<i class="g-dot' + (i === 0 ? ' on' : '') + '"></i>').join('') +
        '</div></div>';
      h += '<div class="g-d-title">' + esc(g.title) + '</div>';
      h += '<div class="g-d-meta">' + esc(c ? c.name : '') + ' · ' + g.days + ' 天前收录</div>';
      // 真实价：普通文字色加大，不用电商红；划线价为淘宝标价
      h += '<div class="g-d-price-row"><span class="g-d-price">' + fmtPrice(g.price) + '</span>' +
        (g.list ? '<span class="g-d-list">' + fmtPrice(g.list) + '</span><span class="g-d-list-note">为淘宝标价</span>' : '') +
        '</div>';
      // 陈列备注（AI 生成 + 人工抽查，抽查可关）
      h += '<div class="g-note"><div class="g-note-label">✦ 陈列备注</div>' + esc(g.note) + '</div>';
      h += '<div class="chip-row g-attrs">' + g.attrs.map(assistChip).join('') + '</div>';
      // 原始标题折叠：透明度对照——让人看到我们提炼了多少
      const orgOpen = !!S.x['goods-org-' + g.id];
      h += '<div class="g-org" data-a="goods-org" data-arg="' + g.id + '">' +
        icon(orgOpen ? 'expand_less' : 'expand_more') + '<span>它在淘宝的原始标题</span></div>' +
        (orgOpen ? '<div class="g-org-text">' + esc(g.origin) + '</div>' : '');
      // 同展厅还有
      const rel = goodsByCat(g.cat).filter(x => x.id !== g.id).slice(0, 5);
      if (rel.length) {
        h += '<div class="sec-head"><span class="sec-title">同展厅还有</span></div>' +
          '<div class="g-fresh">' + rel.map(x =>
            '<div class="g-fresh-card" data-a="goods-open" data-arg="' + x.id + '">' +
            cover(x) +
            '<div class="g-fresh-name">' + esc(x.title) + '</div>' +
            '<div class="g-fresh-cat">' + fmtPrice(x.price) + '</div></div>').join('') + '</div>';
      }
      // 披露（定案：固定于详情页底部，一句小字）
      h += legalLineDetail();
      // 底部 CTA：复制淘口令（次） + 去淘宝看看（主）
      h += '<div class="g-cta">' +
        '<button class="icbtn g-cta-copy" data-a="goods-tpwd" data-arg="' + g.id + '" title="复制淘口令">' + icon('content_copy') + '</button>' +
        btn(buying ? '正在唤起淘宝…' : icon('open_in_new') + ' 去淘宝看看', 'goods-buy', g.id, 'flex' + (buying ? ' g-buying' : '')) +
        '</div>';
      return h;
    }
  });

  // 跳转淘宝（原型固定模拟失败结局）。
  // 真机流程（2026-10 定案，App 侧实现约定）：
  //  ① 直接 try startActivity(淘宝 scheme Intent)——不做 resolveActivity 预检：
  //     Android 11+ 包可见性规则下，国产 ROM 会把它当"查询已安装应用"弹权限提示，观感差；
  //  ② 捕获 ActivityNotFoundException（未安装）→ 立即弹淘口令对话框；
  //  ③ 发起成功记时间戳，5s 内本 Activity onResume 回来 = 唤起失败/被拦截 → 弹淘口令对话框；
  //  ④ 淘口令由服务端预生成（taobao.tbk.tpwd.create），随展品数据下发，不点击不调 API。
  action('goods-buy', ds => {
    if (S.x.buyFor) return;
    S.x.buyFor = ds.arg;
    render();
    setTimeout(() => {
      S.x.buyFor = null;
      const g = goodById(ds.arg);
      if (!g) { render(); return; }
      showDialog({
        title: '没能打开淘宝',
        body: '已尝试唤起淘宝 App，但它没有回应（可能未安装，或被系统拦下了）。' +
          '复制淘口令后手动打开淘宝，会自动识别这件展品：' +
          '<div class="mono-block">' + esc(g.tpwd) + '</div>',
        actions: [
          { label: '算了', run: closeDialog },
          { label: '复制淘口令', style: 'filled', run: () => copyTpwd(g) }
        ]
      });
    }, 2000);
  });
  action('goods-tpwd', ds => { const g = goodById(ds.arg); if (g) copyTpwd(g); });
  action('goods-org', ds => {
    const k = 'goods-org-' + ds.arg;
    S.x[k] = !S.x[k];
    render();
  });
  function copyTpwd(g) {
    const ok = () => toast('淘口令已复制，打开淘宝自动识别');
    const bad = () => toast('自动复制失败，请长按口令手动复制');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(g.tpwd).then(ok, bad);
      else bad();
    } catch (e) { bad(); }
  }

  // 无限瀑布流：接近底部（1.2 屏阈值，提前续上不露白）追加一批。
  // 只往 .g-falls 尾部插 DOM，绝不走 render——滚动途中整页重建会打断滚轮动画、
  // 主线程逐帧全量重排（滚到底冻住一拍、上下都动不了的根因）。批次计数照记 S.x，
  // 之后任何 render（回顶按钮显隐等）都按原长度还原，不丢已加载内容。
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (!t || t.id !== 'content') return;
    if (t.scrollHeight - t.scrollTop - t.clientHeight > t.clientHeight * 1.2) return;
    const cur = nav.current();
    if (!cur || cur.page !== 'goods-cat') return;
    const falls = t.querySelector('.g-falls');
    if (!falls) return;
    const nb = batchesOf(cur.arg);
    if (nb >= MAX_BATCH) return;
    S.x.goodsBatches[cur.arg] = nb + 1;
    falls.insertAdjacentHTML('beforeend', fallBatch(cur.arg, nb + 1, S.x.goodsSort || 'new'));
  }, true);

  // pager 圆点跟随：直接改 DOM class，不触发 render（避免重建导致 pager 回滚）
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('g-pager')) {
      const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
      const wrap = t.parentElement;
      if (!wrap) return;
      wrap.querySelectorAll('.g-dot').forEach((d, j) => d.classList.toggle('on', i === j));
    }
  }, true);
})();
