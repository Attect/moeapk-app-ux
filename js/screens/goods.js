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
  // feed 契约中价格为字符串（"25.9"），演示数据是数字——两种都兼容
  const fmtPrice = p => {
    const n = typeof p === 'number' ? p : parseFloat(p);
    if (!isFinite(n)) return '¥' + String(p);
    return '¥' + (n % 1 ? String(Math.round(n * 100) / 100) : String(n));
  };

  // 数据落灰度文案（对应 feed 的 fresh_days：距最近一次联盟核实的天数）：
  // 今天=此物刚刚擦新 / ≤3 天=此物放了两三天了 / ≤7 天=此物放了一段时间 /
  // ≤14 天=此物有点落灰了 / 更久=此物落灰了；失效展品的「这是古董」由提示条承担，不走这里。
  // 旧数据缺 fresh_days 时回落收录天数。
  function freshText(g) {
    const d = g.fresh_days == null ? (g.days || 0) : g.fresh_days;
    if (d <= 0) return '此物刚刚擦新';
    if (d <= 3) return '此物放了两三天了';
    if (d <= 7) return '此物放了一段时间';
    if (d <= 14) return '此物有点落灰了';
    return '此物落灰了';
  }

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
  // 无图时用 emoji + 色相渐变占位（演示数据形态）。v 0/1/2… 取多图/变体，详情页 pager 用。
  // 淘宝图基本 1:1 方形：focus（top/center/bottom，AI 选封面时返回）决定 cover 裁剪的纵向对齐；
  // flat=true（宽扁槽位）改 contain 完整呈现、两侧露渐变底（与占位设计语言一致，绝不切商品）。
  // ar 为可选的容器宽高比（瀑布流卡片用）。
  function cover(g, v, opts) {
    const vi = v || 0;
    const flat = !!(opts && opts.flat);
    const ar = opts && opts.ar;
    const img = g.images && g.images.length ? g.images[Math.min(vi, g.images.length - 1)] : null;
    const ph = '<span>' + (g.emoji || '🎁') + '</span>';
    const cls = 'g-cover v' + vi + (flat ? ' fit' : '');
    const focus = (g.focus === 'top' || g.focus === 'bottom') ? g.focus : 'center';
    const df = ' data-focus="' + focus + '"';
    const style = '--gh:' + (g.hue == null ? 300 : g.hue) + (ar ? ';aspect-ratio:' + ar : '');
    if (img) {
      return '<div class="' + cls + '"' + df + ' style="' + style + '">' + ph +
        '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()"></div>';
    }
    return '<div class="' + cls + '"' + df + ' style="' + style + '">' + ph + '</div>';
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
      // 首页布局来自数据层（对应 feed 的 home 对象；后台「展厅与首页」动态配置）
      const home = DB.GOODS_HOME || { hero: '看看有什么好东西', fresh_count: 8, mosaic: [] };
      let h = '<div class="g-hero"><div class="g-hero-title">' + esc(home.hero) + '</div></div>';

      // 新入荷：收录最近的 N 件（卡片只署名不标价；fresh_count=0 隐藏整个区块）
      if (home.fresh_count > 0) {
        const fresh = (DB.GOODS || []).slice().sort((a, b) => a.days - b.days).slice(0, home.fresh_count);
        h += '<div class="sec-head"><span class="sec-title">新入荷</span></div>' +
          '<div class="g-fresh">' + fresh.map(g => {
            const c = catById(g.cat);
            return '<div class="g-fresh-card" data-a="goods-open" data-arg="' + g.id + '">' +
              cover(g) +
              '<div class="g-fresh-name">' + esc(g.title) + '</div>' +
              '<div class="g-fresh-cat">' + esc(c ? c.name : '') + ' · ' + g.days + ' 天前</div></div>';
          }).join('') + '</div>';
      }

      // 展厅墙：槽位顺序/跨列/高度按布局配置原样渲染（空厅跳过）。
      // 「换一批」不动布局，只在每个槽位的展厅内重抽封面展品（反复刷有新的脸面，布局不晕车）。
      // 宽扁槽（宽高比 >1.25，如 span4×128）方形图 cover 会只剩中间一条横带——
      // 改 contain 完整呈现、两侧露渐变底（与 emoji 占位同一设计语言）。
      const SPAN_W = { 2: 126, 3: 194, 4: 262, 6: 398 }; // 6 列网格各跨列的代表宽度（430 视口估算）
      h += '<div class="sec-head"><span class="sec-title">展厅</span>' + textBtn('换一批', 'goods-reshuffle') + '</div>';
      h += '<div class="g-mosaic">';
      (home.mosaic || []).forEach(slot => {
        const c = catById(slot.hall);
        if (!c) return;
        const items = goodsByCat(c.id);
        if (!items.length) return;
        const g = items[Math.floor(rand() * items.length)];
        const flat = (SPAN_W[slot.span] || 126) / slot.height > 1.25;
        h += '<div class="g-mos-card" style="grid-column:span ' + slot.span + ';height:' + slot.height + 'px" data-a="goods-open-cat" data-arg="' + c.id + '">' +
          cover(g, 0, { flat: flat }) +
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
    toast('每个展厅都换了件展品露脸');
  });

  // ---------- 展厅（分类页）：无限双列瀑布流，偏小红书 ----------
  // 滚动接近底部自动追加下一批（对应 App 侧 Paging 懒加载 + 服务端分页下发；
  // 真机数据耗尽自然到底，没有"到底啦"提示，底部也不放任何说明文字）。
  // 原型数据有限：批次循环复用本厅展品，批间换序换比例，避免机械重复感。
  // 比例只留竖向（1/1、4/5、3/4）：淘宝图基本 1:1 方形，4/3 横卡会上下大裁切头切尾。
  const ARS = ['1/1', '4/5', '3/4']; // 封面比例按 id 哈希错开，瀑布有高差
  const MAX_BATCH = 40; // 原型安全上限（防 DOM 无限增长），真机无此概念
  function fallCard(g, batch) {
    // 第 1 批比例按 id 固定（首屏稳定）；后续批次叠加批号盐，同件展品每批高差不同
    const ar = ARS[(hashStr(g.id) + (batch > 1 ? batch * 7 : 0)) % ARS.length];
    return '<div class="g-fall-card" data-a="goods-open" data-arg="' + g.id + '">' +
      cover(g, 0, { ar: ar }) +
      '<div class="g-fall-body"><div class="g-fall-title">' + esc(g.title) +
      (g.stale ? '<span class="g-fall-stale">或已绝版</span>' : '') + '</div>' +
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
  // goods-open 注册在下方「共享元素转场」节（带卡片快照与 FLIP 动画）

  // ---------- 展品卡（详情）：上图下文，底部固定「去淘宝看看」 ----------
  // 信息分区（2026-10-09 重排）：身份区（顶栏标题=展品名；标题/展厅/收录时间/落灰度一行 meta）→
  // 策展区（陈列备注=灵魂 + 规格芯片）→ 坦诚区（原始标题直展 + 失效提示 + 披露）→
  // CTA 行（复制口令 / 去淘宝看看 / 价格居右）。
  registerScreen('goods-detail', {
    title: arg => { const g = goodById(arg); return g ? g.title : '展品卡'; },
    render(arg) {
      const g = goodById(arg);
      if (!g) return emptyHint('这件展品已撤下');
      const c = catById(g.cat);
      const buying = S.x.buyFor === g.id;
      // 顶部图片 pager：scroll-snap 横滑；圆点由下方全局 scroll 监听直接改 class（不走 render）。
      // 页数 = 真实图片数（上限 5，与后端 pics 上限一致；演示数据的占位图固定 3 页）。
      // 双指撑开/双击进全屏查看器（见文件末查看器节）。
      const shots = Math.max(1, Math.min(5, (g.images && g.images.length) || 3));
      let h = '<div class="g-pager-wrap"><div class="g-pager">' +
        Array.from({ length: shots }, (_, v) => '<div class="g-shot">' + cover(g, v) + '</div>').join('') +
        '</div><div class="g-dots">' +
        Array.from({ length: shots }, (_, i) => '<i class="g-dot' + (i === 0 ? ' on' : '') + '"></i>').join('') +
        '</div></div>';
      // 身份区：标题 + 一行 meta（展厅 · 收录时间 · 落灰度；失效由下方古董条承担）
      h += '<div class="g-d-title">' + esc(g.title) + '</div>';
      h += '<div class="g-d-meta">' + esc(c ? c.name : '') + ' · ' + g.days + ' 天前收录' +
        (g.stale ? '' : ' · ' + freshText(g)) + '</div>';
      // 策展区：陈列备注（AI 生成 + 人工抽查，抽查可关）+ 规格芯片
      h += '<div class="g-note"><div class="g-note-label">✦ 陈列备注</div>' + esc(g.note) + '</div>';
      h += '<div class="chip-row g-attrs">' + g.attrs.map(assistChip).join('') + '</div>';
      // 坦诚区：原始标题直接展示（提炼对照，不再折叠）
      h += '<div class="g-org-label">它在淘宝的原始标题</div>' +
        '<div class="g-org-text">' + esc(g.origin) + '</div>';
      // 预售提示（联盟 presale_info 判定）：付定金阶段到手价=定金+尾款预估，坦诚标注避免误导
      if (g.presale) {
        h += '<div class="g-presale">' + icon('info') +
          '<span><b>预售商品</b>——还在付定金阶段，价格含定金+尾款的预估，以淘宝页面为准。</span></div>';
      }
      // 可能存在的优惠（联盟促销条目；券会过期/有门槛，弱化呈现不催促）：
      // 每条目一张小卡片 + SVG 图标示意（券=票券 / 折=百分号 / 减降补贴=降价标签 / 其它=通用优惠）
      if (g.promos && g.promos.length) {
        const pIcon = p => {
          if (p.includes('券')) return 'confirmation_number';
          if (p.includes('折')) return 'percent';
          if (p.includes('减') || p.includes('降') || p.includes('补贴')) return 'sell';
          return 'local_offer';
        };
        h += '<div class="g-promo"><div class="g-promo-label">可能存在的优惠</div>' +
          '<div class="g-promo-list">' +
          g.promos.map(p => '<div class="g-promo-card">' + icon(pIcon(p)) + '<span>' + esc(p) + '</span></div>').join('') +
          '</div></div>';
      }
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
      // 可能已失效（保留展示：用户可能去搜同款；坦诚提示，不拦跳转；落灰度语义并入首词）
      if (g.stale) {
        h += '<div class="g-stale">' + icon('info') +
          '<span><b>这是古董</b>——这件可能已经下架了。若口令或跳转失效，可复制原始标题去淘宝搜同款。</span></div>';
      }
      // 披露（定案：固定于详情页底部，一句小字）
      h += legalLineDetail();
      // 底部 CTA：复制淘口令（次） + 去淘宝看看（主） + 价格（居右，划线价为淘宝标价）
      h += '<div class="g-cta">' +
        '<button class="icbtn g-cta-copy" data-a="goods-tpwd" data-arg="' + g.id + '" title="复制淘口令">' + icon('content_copy') + '</button>' +
        btn(buying ? '正在唤起淘宝…' : icon('open_in_new') + ' 去淘宝看看', 'goods-buy', g.id, 'flex' + (buying ? ' g-buying' : '')) +
        '<div class="g-cta-price"><span class="g-cta-about">约</span>' + fmtPrice(g.price) +
        (g.list ? '<s title="为淘宝标价">' + fmtPrice(g.list) + '</s>' : '') + '</div>' +
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

  // ---------- 共享元素转场（卡片 → 详情大图，FLIP） ----------
  // 点击卡片时克隆封面记录位置，详情渲染后克隆体从卡片位动画到 pager 位；
  // 图片本就是缓存同一张，无缝无白闪。返回时反向缩回（capture 拦截 back）。
  // App 侧对应：Compose sharedBounds/sharedElement 转场。
  let hero = null; // { id, rect, html } —— 进入详情时的源卡片快照
  function phoneRect() { return document.querySelector('.phone').getBoundingClientRect(); }
  function heroClone(rel, rect, html) {
    // rel 为定位参照（.phone）的视口 rect；rect 为内容视口 rect → 换算成 .phone 内绝对坐标
    const clone = document.createElement('div');
    clone.className = 'g-hero-anim';
    clone.innerHTML = html;
    const inner = clone.firstChild;
    inner.style.position = 'absolute';
    inner.style.inset = '0';
    inner.style.width = '100%';
    inner.style.height = '100%';
    Object.assign(clone.style, {
      left: (rect.left - rel.left) + 'px', top: (rect.top - rel.top) + 'px',
      width: rect.width + 'px', height: rect.height + 'px',
    });
    document.querySelector('.phone').appendChild(clone);
    return clone;
  }
  action('goods-open', (ds, el) => {
    const card = el && el.closest ? el.closest('.g-fall-card, .g-fresh-card') : null;
    const cov = card ? card.querySelector('.g-cover') : null;
    hero = cov ? { id: ds.arg, rect: cov.getBoundingClientRect(), html: cov.outerHTML } : null;
    nav.push('goods-detail', ds.arg);
    if (hero) requestAnimationFrame(() => {
      const target = document.querySelector('.g-shot .g-cover');
      if (!target || !hero) return;
      const clone = heroClone(phoneRect(), hero.rect, hero.html);
      const tr = target.getBoundingClientRect();
      const rel = phoneRect();
      target.style.visibility = 'hidden';
      requestAnimationFrame(() => {
        Object.assign(clone.style, {
          left: (tr.left - rel.left) + 'px', top: (tr.top - rel.top) + 'px',
          width: tr.width + 'px', height: tr.height + 'px',
        });
      });
      setTimeout(() => {
        target.style.visibility = '';
        clone.classList.add('out');
        setTimeout(() => clone.remove(), 140);
      }, 300);
    });
  });
  // 返回时反向缩回源卡片（capture 拦截全局 back；无源快照或找不到卡片时走默认返回）
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a="back"]');
    if (!b || !hero) return;
    const cur = nav.current();
    if (!cur || cur.page !== 'goods-detail' || cur.arg !== hero.id) return;
    const pager = document.querySelector('.g-shot .g-cover');
    if (!pager) return;
    const pr = pager.getBoundingClientRect();
    e.stopImmediatePropagation();
    e.preventDefault();
    const html = pager.outerHTML;
    nav.pop();
    requestAnimationFrame(() => {
      const card = document.querySelector('.g-fall-card[data-arg="' + hero.id + '"] .g-cover, .g-fresh-card[data-arg="' + hero.id + '"] .g-cover');
      if (!card) { hero = null; return; }
      const clone = heroClone(phoneRect(), pr, html);
      const tr = card.getBoundingClientRect();
      const rel = phoneRect();
      requestAnimationFrame(() => {
        Object.assign(clone.style, {
          left: (tr.left - rel.left) + 'px', top: (tr.top - rel.top) + 'px',
          width: tr.width + 'px', height: tr.height + 'px',
        });
      });
      setTimeout(() => { clone.classList.add('out'); setTimeout(() => clone.remove(), 140); }, 300);
      hero = null;
    });
  }, true);

  // ---------- 全屏查看器 ----------
  // 双指撑开（或双击，桌面/调试）pager 图片进入；横滑切换；长按/右键出菜单
  // （保存到相册 / 保存到素材 / 分享）；单击空白或图片、左上角 X、Esc 退出。
  // 挂在 .phone 上而非 #app——render（如对话框打开）不会销毁查看器。
  // App 侧契约：保存到相册=MediaStore 写入；保存到素材=入素材库；分享=系统分享。
  let viewerEl = null;
  function viewerSlides(g) {
    const imgs = g.images && g.images.length ? g.images : null;
    const n = imgs ? imgs.length : 1;
    return Array.from({ length: n }, (_, i) => {
      const inner = imgs
        ? '<img src="' + esc(imgs[i]) + '" alt="" draggable="false" onerror="this.remove()">'
        : '<div class="g-viewer-ph" style="--gh:' + (g.hue == null ? 300 : g.hue) + '"><span>' + (g.emoji || '🎁') + '</span></div>';
      return '<div class="g-viewer-slide">' + inner + '</div>';
    }).join('');
  }
  function openViewer(g, index) {
    closeViewer(true);
    const n = g.images && g.images.length ? g.images.length : 1;
    const el = document.createElement('div');
    el.className = 'g-viewer';
    el.innerHTML = '<button class="g-viewer-x" aria-label="退出全屏">' + icon('close') + '</button>' +
      '<div class="g-viewer-idx">' + (index + 1) + ' / ' + n + '</div>' +
      '<div class="g-viewer-strip">' + viewerSlides(g) + '</div>';
    document.querySelector('.phone').appendChild(el);
    viewerEl = el;
    const strip = el.querySelector('.g-viewer-strip');
    strip.scrollLeft = strip.clientWidth * index;
    strip.addEventListener('scroll', () => {
      const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      el.querySelector('.g-viewer-idx').textContent = (i + 1) + ' / ' + n;
    });
    // 单击退出（滑动/拖拽不触发：位移 >10px 视为手势）
    let downPos = null;
    el.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('click', e => {
      if (e.target.closest('.g-viewer-x')) { closeViewer(); return; }
      if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 10) return;
      closeViewer();
    });
    // 长按 / 右键 → 菜单
    let lpTimer = null;
    el.addEventListener('touchstart', () => {
      lpTimer = setTimeout(() => viewerMenu(g, currentViewerIndex(el)), 500);
    }, { passive: true });
    el.addEventListener('touchmove', () => clearTimeout(lpTimer), { passive: true });
    el.addEventListener('touchend', () => clearTimeout(lpTimer), { passive: true });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      viewerMenu(g, currentViewerIndex(el));
    });
    requestAnimationFrame(() => el.classList.add('on'));
  }
  function currentViewerIndex(el) {
    const strip = el.querySelector('.g-viewer-strip');
    return Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
  }
  function closeViewer(instant) {
    if (!viewerEl) return;
    const el = viewerEl;
    viewerEl = null;
    if (instant) { el.remove(); return; }
    el.classList.remove('on');
    setTimeout(() => el.remove(), 200);
  }
  function viewerMenu(g, idx) {
    showDialog({
      title: g.title,
      body: '第 ' + (idx + 1) + ' 张图',
      actions: [
        { label: '保存到相册', run: () => { viewerSavePhoto(g, idx); } },
        { label: '保存到素材', run: () => { viewerSaveAsset(g); } },
        { label: '分享', run: () => { viewerShare(g); } },
        { label: '取消', run: closeDialog },
      ]
    });
  }
  function viewerSavePhoto(g, idx) {
    const url = g.images && g.images[idx];
    if (!url) { toast('演示占位图没有可保存的图片'); return; }
    // 真实图：尽力走浏览器下载（跨域受 CORS 限制，失败回落打开原图）；App 侧为 MediaStore
    fetch(url).then(r => r.blob()).then(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = (g.title || 'goods') + '.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('已开始下载保存');
    }).catch(() => window.open(url, '_blank'));
  }
  function viewerSaveAsset(g) {
    const p = n => (n < 10 ? '0' : '') + n;
    const t = new Date();
    S.x.assets = S.x.assets || [];
    S.x.assets.unshift({
      id: 'as-g' + Date.now(), kind: 'image', hue: g.hue == null ? 300 : g.hue,
      label: '宅物·' + g.title,
      date: t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()),
    });
    toast('已存入素材库');
  }
  function viewerShare(g) {
    const text = g.title + ' · ' + fmtPrice(g.price) + '（MoeApk 宅物陈列室）';
    if (navigator.share) { navigator.share({ title: g.title, text: text }).catch(() => {}); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toast('已复制分享文案'), () => toast('分享失败'));
        return;
      }
    } catch (e) { /* fallthrough */ }
    toast('当前环境不支持分享');
  }
  // 双指撑开 pager 图片 → 全屏（触摸）；双击 → 全屏（桌面/调试）
  let pinch = null;
  document.addEventListener('touchstart', e => {
    const p = e.target.closest('.g-pager');
    pinch = (p && e.touches.length === 2)
      ? { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), fired: false }
      : null;
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', e => {
    if (!pinch || pinch.fired || e.touches.length !== 2) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (d / pinch.d > 1.3) {
      pinch.fired = true;
      const cur = nav.current();
      if (!cur || cur.page !== 'goods-detail') return;
      const g = goodById(cur.arg);
      const pager = document.querySelector('.g-pager');
      const idx = pager ? Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)) : 0;
      if (g) openViewer(g, idx);
    }
  }, { passive: true, capture: true });
  document.addEventListener('dblclick', e => {
    if (!e.target.closest('.g-pager')) return;
    const cur = nav.current();
    if (!cur || cur.page !== 'goods-detail') return;
    const g = goodById(cur.arg);
    const pager = document.querySelector('.g-pager');
    const idx = pager ? Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)) : 0;
    if (g) openViewer(g, idx);
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && viewerEl) closeViewer(); });

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
