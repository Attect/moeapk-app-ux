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
  const ipById = id => (DB.GOODS_IP_ENTITIES || []).find(e => e.id === Number(id));
  const ipHallById = id => (DB.GOODS_IP_HALLS || []).find(h => h.id === id);
  const ipHallForEntity = id => (DB.GOODS_IP_HALLS || []).find(h => h.subject.id === Number(id));
  const ipKindLabel = (kind, groupType) => ({
    work: '作品', character: '角色', gijinka: '拟人化', vtuber: 'VTuber', mascot: '吉祥物',
    group: groupType === 'company' ? '公司' : groupType === 'franchise' ? '系列 / IP' : '团体', other: '其他'
  })[kind] || '其他';
  const ipMediaLabel = e => ({ game: '游戏', anime: '动画', manga: '漫画', music: '音乐' })[e.media_type] || '媒介';
  const ipTypeLabel = e => e.kind === 'work' && e.media_type ? ipMediaLabel(e) + '作品' : ipKindLabel(e.kind, e.group_type);
  // 作品厅：hallId 本身就是策展确认成员凭证，不能用 ip_ids 或名称替代。
  // 角色厅：除了 hallId，还必须精确包含该角色实体 ID，避免把同作品其它角色混入。
  function goodsByIpHall(hall) {
    return (DB.GOODS || []).filter(g => (g.ip_hall_ids || []).includes(hall.id) &&
      (hall.subject.kind !== 'character' || (g.ip_ids || []).includes(Number(hall.subject.id))));
  }
  function goodsByCatFiltered(cid) {
    const selected = S.x.goodsCatIp && S.x.goodsCatIp[cid];
    return goodsByCat(cid).filter(g => !selected || (g.ip_ids || []).includes(Number(selected)));
  }
  function ipOptionsForCat(cid) {
    const ids = new Set();
    goodsByCat(cid).forEach(g => (g.ip_ids || []).forEach(id => ids.add(id)));
    return [...ids].map(ipById).filter(Boolean);
  }
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
  function ipHallCard(hall) {
    const work = hall.subject.kind === 'work';
    return '<button type="button" class="g-ip-hall-card ' + (work ? 'work' : 'character') + '" data-a="goods-open-ip-hall" data-arg="' + esc(hall.id) + '">' +
      '<span class="g-ip-hall-top"><span class="g-ip-hall-emoji">' + hall.emoji + '</span>' +
      '<span class="g-ip-hall-kind">' + (work ? '作品策展' : '精确角色') + '</span></span>' +
      '<span class="g-ip-hall-title">' + esc(hall.title) + '</span>' +
      '<span class="g-ip-hall-blurb">' + esc(hall.blurb) + '</span>' +
      '<span class="g-ip-hall-meta">' + hall.item_count + ' 件策展展品 · ' +
      (work ? hall.character_count + ' 位角色' : '仅此角色') + '</span></button>';
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

      // IP 展厅与物品形态展厅是两套正交入口：作品=确认成员策展，角色=精确实体。
      // 卡片只使用 feed ip_halls 的策展统计，不读取联盟原始结果。
      h += '<div class="sec-head"><span class="sec-title">IP 展厅</span>' +
        '<span class="g-sec-note">作品策展 / 精确角色</span></div>' +
        '<button type="button" class="g-ip-tree-entry" data-a="goods-open-ip-tree" data-arg="9001">' +
        '<span class="g-ip-tree-icon">' + icon('share') + '</span><span class="g-ip-tree-copy">' +
        '<strong>品牌 / 系列 / 媒介层级</strong>' +
        '<span>米哈游 → 原神 / 星穹铁道 → 游戏 / 动画 / 漫画 / 音乐</span>' +
        '<small>只沿 belongs_to / part_of / appears_in 浏览，独立条目不合并</small></span>' +
        icon('keyboard_arrow_right') + '</button>' +
        '<div class="g-ip-halls">' + (DB.GOODS_IP_HALLS || []).map(ipHallCard).join('') + '</div>';

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
      h += '<div class="sec-head"><span class="sec-title">物品形态展厅</span>' + textBtn('换一批', 'goods-reshuffle') + '</div>';
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
    let items = goodsByCatFiltered(cid);
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
      const selectedIp = (S.x.goodsCatIp && S.x.goodsCatIp[arg]) || '';
      const ipOptions = ipOptionsForCat(arg);
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
      if (ipOptions.length) {
        h += '<div class="chip-row g-ip-filter">' +
          chip('全部 IP', !selectedIp, 'goods-cat-ip', arg + ':') +
          ipOptions.map(e => chip(e.name, selectedIp === String(e.id), 'goods-cat-ip', arg + ':' + e.id)).join('') + '</div>';
      }
      if (!goodsByCatFiltered(arg).length) {
        return h + emptyHint('这个 IP 在本展厅还没有展品，换一个看看');
      }
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
  action('goods-cat-ip', ds => {
    const [hall, id] = ds.arg.split(':');
    S.x.goodsCatIp = S.x.goodsCatIp || {};
    S.x.goodsCatIp[hall] = id;
    if (S.x.goodsBatches) S.x.goodsBatches[hall] = 1;
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
      const ipLinks = (g.ip_ids || []).map(ipById).filter(Boolean);
      if (ipLinks.length) {
        h += '<div class="chip-row g-ip-tags">' + ipLinks.map(e =>
          chip(ipKindLabel(e.kind) + '·' + e.name, false, 'goods-open-ip', e.id)).join('') + '</div>';
      }
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
      // 每条目一张小卡片 + SVG 图标示意（券=票券 / 折=百分号 / 减降补贴抵扣=降价标签 / 包邮等标签=通用优惠）
      if (g.promos && g.promos.length) {
        const pIcon = p => {
          if (p.includes('券')) return 'confirmation_number';
          if (p.includes('折')) return 'percent';
          if (p.includes('减') || p.includes('降') || p.includes('补贴') || p.includes('抵扣')) return 'sell';
          return 'local_offer';
        };
        h += '<div class="g-promo"><div class="g-promo-label">可能存在的优惠</div>' +
          '<div class="g-promo-list">' +
          g.promos.map(p => '<div class="g-promo-card">' + icon(pIcon(p)) + '<span>' + esc(p) + '</span></div>').join('') +
          '</div></div>';
      }
      // 同 IP 还有（跨展厅）：与物品形态分类正交，只在确有同实体展品时显示
      const sameIp = (DB.GOODS || []).filter(x => x.id !== g.id &&
        (g.ip_ids || []).some(id => (x.ip_ids || []).includes(id))).slice(0, 5);
      if (sameIp.length) {
        h += '<div class="sec-head"><span class="sec-title">同 IP 还有</span></div>' +
          '<div class="g-fresh">' + sameIp.map(x =>
            '<div class="g-fresh-card" data-a="goods-open" data-arg="' + x.id + '">' +
            cover(x) +
            '<div class="g-fresh-name">' + esc(x.title) + '</div>' +
            '<div class="g-fresh-cat">' + esc((catById(x.cat) || {}).name || '') + ' · ' + fmtPrice(x.price) + '</div></div>').join('') + '</div>';
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

  // ---------- 统一 IP 页：策展展品 / 角色关系 / 联盟发现 ----------
  // 静态模拟固定后端契约，不发起网络请求。公司 / 系列只沿显式 belongs_to / part_of
  // 进入 children；作品根的 media 来自同一系列的显式 part_of 兄弟条目，角色只沿 appears_in。
  // 不按 related、名称或相似度推断，也不把不同媒介合并成一份资料。
  function groupChildEdges(root) {
    return (DB.GOODS_IP_RELATIONS || []).filter(r =>
      (r.relation === 'belongs_to' || r.relation === 'part_of') && r.parent_id === root.id);
  }
  function groupChildren(root) {
    const seen = new Set();
    return groupChildEdges(root).map(r => ipById(r.child_id)).filter(e => {
      if (!e || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }
  function mediaForWork(root) {
    const edges = (DB.GOODS_IP_RELATIONS || []).filter(r => r.relation === 'part_of');
    const parents = new Set(edges.filter(r => r.child_id === root.id).map(r => r.parent_id));
    const seen = new Set();
    return edges.filter(r => parents.has(r.parent_id) && r.child_id !== root.id)
      .map(r => ipById(r.child_id)).filter(e => {
        if (!e || e.kind !== 'work' || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
  }
  function graphResponse(root, offset, limit) {
    const start = Math.max(0, Number(offset) || 0);
    const size = Math.max(1, Number(limit) || 3);
    if (root.kind === 'group') {
      const edges = groupChildEdges(root);
      const all = groupChildren(root);
      return {
        root: root, mode: 'group',
        relation: (edges[0] && edges[0].relation) || (root.group_type === 'company' ? 'belongs_to' : 'part_of'),
        works: [], characters: [], children: all.slice(start, start + size),
        work_total: all.filter(e => e.kind === 'work').length, character_total: 0,
        group_type: root.group_type, offset: start, limit: size
      };
    }
    const edges = (DB.GOODS_IP_RELATIONS || []).filter(r => r.relation === 'appears_in');
    if (root.kind === 'work') {
      const ids = [...new Set(edges.filter(r => r.work_id === root.id).map(r => r.character_id))];
      const media = mediaForWork(root);
      return {
        root: root, mode: 'work', relation: 'appears_in', works: [root],
        characters: ids.slice(start, start + size).map(ipById).filter(Boolean),
        work_total: 1, character_total: ids.length,
        media: media.slice(start, start + size), media_total: media.length,
        media_relation: 'part_of', offset: start, limit: size
      };
    }
    const ids = [...new Set(edges.filter(r => r.character_id === root.id).map(r => r.work_id))];
    return {
      root: root, mode: 'character', relation: 'appears_in',
      works: ids.slice(start, start + size).map(ipById).filter(Boolean), characters: [root],
      work_total: ids.length, character_total: 1, offset: start, limit: size
    };
  }
  DB.goodsIpGraph = graphResponse; // 静态契约探针：不发起网络请求

  // 公司 / 系列 / 作品的面包屑只回溯显式层级边；角色可能属于多作品，不猜唯一父级。
  function ipLineage(e) {
    if (e.kind !== 'group' && e.kind !== 'work') return [];
    const chain = [e];
    const seen = new Set([e.id]);
    let cur = e;
    while (cur) {
      const edge = (DB.GOODS_IP_RELATIONS || []).find(r =>
        (r.relation === 'belongs_to' || r.relation === 'part_of') && r.child_id === cur.id);
      const parent = edge && ipById(edge.parent_id);
      if (!parent || seen.has(parent.id)) break;
      chain.unshift(parent); seen.add(parent.id); cur = parent;
    }
    return chain;
  }

  function renderIpCurated(e) {
    if (e.kind === 'group') {
      return '<div class="g-ip-curation"><div class="g-ip-curation-rule">' + icon('info') +
        '公司 / 系列只提供层级导航，不合并下设媒介的资料或策展展品</div></div>' +
        emptyHint('请在「角色关系」进入具体作品或角色展厅');
    }
    const hall = ipHallForEntity(e.id);
    if (!hall) return emptyHint(e.kind === 'work' && e.media_type ? '这个媒介作品还没有策展展厅' : '这个实体还没有策展展厅');
    const selectedCat = (S.x.goodsIpCat && S.x.goodsIpCat[e.id]) || '';
    const allItems = goodsByIpHall(hall);
    const catIds = [...new Set(allItems.map(g => g.cat))];
    const items = allItems.filter(g => !selectedCat || g.cat === selectedCat);
    const work = hall.subject.kind === 'work';
    let h = '<div class="g-ip-curation"><div class="g-ip-curation-head">' +
      '<span class="g-ip-curation-emoji">' + hall.emoji + '</span><div>' +
      '<div class="g-ip-curation-title">' + esc(hall.title) + '</div>' +
      '<div class="g-ip-curation-blurb">' + esc(hall.blurb) + '</div></div></div>' +
      '<div class="g-ip-curation-rule">' + icon('verified') +
      (work ? '仅策展确认成员 · 按展厅成员 ID 收录' : '精确角色 ID 匹配 · 不按名称猜测') + '</div></div>';
    h += '<div class="chip-row g-ip-filter" aria-label="按物品形态筛选">' +
      chip('全部物品形态', !selectedCat, 'goods-ip-cat', e.id + ':') +
      catIds.map(id => chip((catById(id) || {}).name || id, selectedCat === id, 'goods-ip-cat', e.id + ':' + id)).join('') + '</div>';
    if (!items.length) return h + emptyHint('这个物品形态还没有该展厅的策展展品');
    h += '<div class="g-ip-count">' + items.length + ' / ' + allItems.length + ' 件策展展品</div>' +
      '<div class="g-falls">' + items.map(g => fallCard(g, 1)).join('') + '</div>';
    return h;
  }

  function renderWorkDualGraph(e) {
    const mediaLimit = (S.x.goodsIpMediaLimit && S.x.goodsIpMediaLimit[e.id]) || 2;
    const characterLimit = (S.x.goodsIpGraphLimit && S.x.goodsIpGraphLimit[e.id]) || 3;
    const graph = graphResponse(e, 0, Math.max(mediaLimit, characterLimit));
    // 同一 limit 的后端响应在原型中按两条独立 lane 重放，互不把另一 lane 的加载量带走。
    const media = graph.media.slice(0, mediaLimit);
    const characters = graph.characters.slice(0, characterLimit);
    const highlight = Number(S.x.goodsIpGraphHighlight && S.x.goodsIpGraphHighlight[e.id]);
    const rows = Math.max(1, media.length, characters.length);
    const height = Math.max(310, 192 + rows * 84);
    const childY = i => 172 + i * 84;
    let h = '<div class="g-graph-legend">' + icon('share') + '<span>' +
      '<b>part_of</b> · 同 IP 媒介（独立条目）<br><b>appears_in</b> · 同作品角色' +
      '<small>游戏 / 动画 / 漫画 / 音乐不合并资料；角色关系也不跨媒介猜测</small></span></div>';
    h += '<div class="g-graph-caption">作品根 · 媒介与角色同时展示、分别分页</div>';
    h += '<div class="g-graph-stage dual" style="height:' + height + 'px">' +
      '<svg class="g-graph-svg" viewBox="0 0 1000 ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      media.map((child, i) => '<line class="g-graph-line media" x1="460" y1="82" x2="300" y2="' + (childY(i) - 31) + '" vector-effect="non-scaling-stroke"/>').join('') +
      characters.map((child, i) => '<line class="g-graph-line character' + (child.id === highlight ? ' highlight' : '') +
        '" x1="540" y1="82" x2="700" y2="' + (childY(i) - 31) + '" vector-effect="non-scaling-stroke"/>').join('') + '</svg>';
    h += '<div class="g-graph-node root work" style="left:50%;top:52px">' +
      '<span class="g-graph-node-kind">当前' + esc(ipTypeLabel(e)) + '</span><strong>' + esc(e.name) + '</strong>' +
      '<small>独立作品根</small></div>';
    h += '<div class="g-graph-lane-label media" style="left:26%;top:108px">同 IP 媒介 · part_of</div>' +
      '<div class="g-graph-lane-label character" style="left:74%;top:108px">同作品角色 · appears_in</div>';
    h += media.map((child, i) => '<button type="button" class="g-graph-node work media"' +
      ' data-a="goods-ip-open-node" data-arg="' + e.id + ':' + child.id + '" style="left:26%;top:' + childY(i) + 'px">' +
      '<span class="g-graph-node-kind">' + esc(ipMediaLabel(child)) + ' · part_of</span><strong>' + esc(child.name) + '</strong>' +
      '<small>同 IP 独立条目 · 进入</small></button>').join('');
    h += characters.map((child, i) => {
      const on = child.id === highlight;
      return '<button type="button" class="g-graph-node character' + (on ? ' highlight' : '') + '"' +
        ' data-a="goods-ip-open-node" data-arg="' + e.id + ':' + child.id + '" style="left:74%;top:' + childY(i) + 'px">' +
        '<span class="g-graph-node-kind">角色 · appears_in' + (on ? ' · 入口角色' : '') + '</span><strong>' + esc(child.name) + '</strong>' +
        '<small>' + (on ? '入口高亮' : '同作品角色 · 进入') + '</small></button>';
    }).join('');
    if (!characters.length) h += '<div class="g-graph-empty" style="left:74%;top:172px">本作品暂无 appears_in 角色</div>';
    h += '</div><div class="g-graph-progress dual-progress">' +
      '<span data-progress="media">同 IP 媒介 ' + media.length + ' / ' + graph.media_total + ' 部独立作品</span>' +
      '<span data-progress="characters">同作品角色 ' + characters.length + ' / ' + graph.character_total + ' 位</span></div>';
    h += '<div class="g-graph-actions">';
    if (media.length < graph.media_total) h += btn('加载更多同 IP 媒介', 'goods-ip-media-more', e.id, 'small ghost');
    if (characters.length < graph.character_total) h += btn('加载更多同作品角色', 'goods-ip-graph-more', e.id, 'small ghost');
    h += btn(icon('search') + ' 查看当前' + ipTypeLabel(e) + '的联盟原始结果', 'goods-ip-show-raw', e.id, 'small ghost g-graph-raw') + '</div>';
    return h;
  }

  function renderIpGraph(e) {
    if (e.kind !== 'group' && e.kind !== 'work' && e.kind !== 'character') {
      return '<div class="g-graph-legend">' + icon('info') + '仅公司、系列、作品与角色支持显式关系</div>' + emptyHint('这个实体没有演示关系');
    }
    if (e.kind === 'work' && mediaForWork(e).length) return renderWorkDualGraph(e);
    const group = e.kind === 'group', work = e.kind === 'work';
    const limit = group
      ? ((S.x.goodsIpGroupLimit && S.x.goodsIpGroupLimit[e.id]) || 3)
      : ((S.x.goodsIpGraphLimit && S.x.goodsIpGraphLimit[e.id]) || 3);
    const graph = graphResponse(e, 0, limit);
    const children = group ? graph.children : work ? graph.characters : graph.works;
    const total = group ? groupChildren(e).length : work ? graph.character_total : graph.work_total;
    const highlight = Number(S.x.goodsIpGraphHighlight && S.x.goodsIpGraphHighlight[e.id]);
    let legend;
    if (group) {
      legend = '<b>' + graph.relation + '</b> · ' + (e.group_type === 'company' ? '公司 → 旗下系列 / IP' : '系列 / IP → 独立媒介作品') +
        '<small>children 保留下一层独立条目；group_type: ' + esc(graph.group_type) + '，不按 related 或名称推断</small>';
    } else if (work) {
      legend = '<b>appears_in</b> · 当前作品 → 同作品角色<small>当前作品没有同 IP 媒介演示；不会从角色反推或合并其它媒介</small>';
    } else {
      legend = '<b>appears_in</b> · 角色 → 出现的媒介作品<small>进入作品可查看同作品其他角色，入口角色会继续高亮</small>';
    }
    let h = '<div class="g-graph-legend">' + icon('share') + '<span>' + legend + '</span></div>';
    if (!children.length) {
      h += emptyHint(group ? '当前层级暂无 children 演示关系' : '当前实体暂无 appears_in 演示关系');
    } else {
      const height = Math.max(250, 74 + children.length * 84);
      const rootY = height / 2;
      const childY = i => (height - (children.length - 1) * 84) / 2 + i * 84;
      const caption = group
        ? (e.group_type === 'company' ? '公司根 · children=franchise · belongs_to' : '系列根 · children=work · part_of')
        : work ? '作品根 · appears_in 同作品角色分页' : '角色根 · appears_in 媒介作品分页，进入作品看其他角色';
      h += '<div class="g-graph-caption">' + caption + '</div>';
      h += '<div class="g-graph-stage" style="height:' + height + 'px">' +
        '<svg class="g-graph-svg" viewBox="0 0 1000 ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
        children.map((child, i) => '<line class="g-graph-line' + (work && child.id === highlight ? ' highlight' : '') +
          '" x1="370" y1="' + rootY + '" x2="630" y2="' + childY(i) + '" vector-effect="non-scaling-stroke"/>').join('') +
        '</svg>';
      h += '<div class="g-graph-node root ' + e.kind + '" style="left:19%;top:' + rootY + 'px">' +
        '<span class="g-graph-node-kind">当前' + esc(ipTypeLabel(e)) + '</span><strong>' + esc(e.name) + '</strong>' +
        '<small>' + esc(e.year || (group ? 'group_type: ' + e.group_type : graph.relation)) + '</small></div>';
      h += children.map((child, i) => {
        const on = work && child.id === highlight;
        const kind = ipTypeLabel(child) + (group ? ' · ' + graph.relation : '') + (on ? ' · 入口角色' : '');
        const sub = group ? 'children · 进入下一层' : work ? 'appears_in · ' + (on ? '入口高亮' : '进入') :
          (child.media_type ? ipMediaLabel(child) + ' · appears_in' : (child.year || 'appears_in · 进入'));
        return '<button type="button" class="g-graph-node ' + child.kind + (child.media_type ? ' media' : '') + (on ? ' highlight' : '') + '"' +
          ' data-a="goods-ip-open-node" data-arg="' + e.id + ':' + child.id + '" style="left:81%;top:' + childY(i) + 'px">' +
          '<span class="g-graph-node-kind">' + esc(kind) + '</span><strong>' + esc(child.name) + '</strong><small>' + esc(sub) + '</small></button>';
      }).join('');
      h += '</div><div class="g-graph-progress">' + (group ? '下一层条目 ' : work ? '同作品角色 ' : '媒介作品 ') +
        children.length + ' / ' + total + (group ? ' 个' : work ? ' 位' : ' 部') + '</div>';
    }
    h += '<div class="g-graph-actions">';
    if (children.length < total) {
      const moreAct = group ? 'goods-ip-group-more' : 'goods-ip-graph-more';
      const moreLabel = group ? (e.group_type === 'company' ? '加载更多系列 / IP' : '加载更多媒介作品') : work ? '加载更多同作品角色' : '加载更多媒介作品';
      h += btn(moreLabel, moreAct, e.id, 'small ghost');
    }
    h += btn(icon('search') + ' 查看当前' + ipTypeLabel(e) + '的联盟原始结果', 'goods-ip-show-raw', e.id, 'small ghost g-graph-raw') + '</div>';
    return h;
  }

  function renderIpRaw(e) {
    const raw = (DB.GOODS_ALLIANCE_RAW || {})[e.id];
    const results = raw ? raw.results : [];
    let h = '<div class="g-raw-warning" role="note">' + icon('warning') + '<div>' +
      '<div class="g-raw-warning-title"><strong>联盟原始结果</strong><span>/</span><b>未经 AI 与人工策展</b></div>' +
      '<p>直接保留原始返回，可能包含重复、无关、失效或价格变化；不会计入任何策展展厅。</p></div></div>';
    h += '<div class="g-raw-query">' + icon('search') + '<div><span>当前' + esc(ipTypeLabel(e)) + '直接搜索</span>' +
      '<strong>' + esc(raw ? raw.query : e.name) + '</strong><small>静态演示 · 无网络请求</small></div></div>';
    if (!results.length) return h + emptyHint('当前实体暂无联盟原始演示结果');
    h += '<div class="g-raw-count">原始返回 ' + results.length + ' 条 · 未筛选</div>' +
      '<div class="g-raw-list">' + results.map((r, i) => '<article class="g-raw-card">' +
        '<div class="g-raw-card-top"><span>原始第 ' + (i + 1) + ' 条</span><b>未筛选</b></div>' +
        '<div class="g-raw-title">' + esc(r.title) + '</div>' +
        '<div class="g-raw-meta"><span>' + esc(r.shop) + '</span><strong>' + fmtPrice(r.price) + '</strong></div>' +
        (r.promo ? '<div class="g-raw-promo">原始促销：' + esc(r.promo) + '</div>' : '') +
        '</article>').join('') + '</div>';
    h += '<div class="g-raw-foot">原始结果不等于策展收录；价格与有效性以淘宝页面为准。</div>';
    return h;
  }

  registerScreen('goods-ip', {
    title: arg => { const e = ipById(arg); return e ? e.name : 'IP 展厅'; },
    render(arg) {
      const e = ipById(arg);
      if (!e) return emptyHint('这个 IP 实体不存在');
      const view = (S.x.goodsIpView && S.x.goodsIpView[arg]) || 'curated';
      const lineage = ipLineage(e);
      const typeLine = ipTypeLabel(e) + (e.group_type ? ' · group_type: ' + e.group_type : '');
      let h = '<div class="g-ip-hero"><div class="g-ip-kind">' + esc(typeLine) +
        (e.year ? ' · ' + e.year : '') + ' · 静态演示实体</div><div class="g-ip-name">' + esc(e.name) + '</div>' +
        (lineage.length > 1 ? '<div class="g-ip-lineage" aria-label="显式 IP 层级">' + lineage.map((x, i) =>
          '<span' + (i === lineage.length - 1 ? ' class="current"' : '') + '>' + esc(x.name) + '</span>').join('<i>›</i>') + '</div>' : '') +
        (e.summary ? '<div class="g-ip-summary">' + esc(e.summary) + '</div>' : '') + '</div>';
      const tabs = [['curated', 'redeem', '策展展品'], ['graph', 'share', '角色关系'], ['raw', 'search', '联盟发现']];
      h += '<div class="g-ip-tabs" role="tablist" aria-label="IP 页面视图">' + tabs.map(t =>
        '<button type="button" role="tab" aria-selected="' + (view === t[0]) + '" class="g-ip-tab' + (view === t[0] ? ' on' : '') +
        '" data-a="goods-ip-tab" data-arg="' + arg + ':' + t[0] + '">' + icon(t[1]) + '<span>' + t[2] + '</span></button>').join('') + '</div>';
      h += view === 'graph' ? renderIpGraph(e) : view === 'raw' ? renderIpRaw(e) : renderIpCurated(e);
      return h;
    }
  });
  function setIpView(id, view) {
    S.x.goodsIpView = S.x.goodsIpView || {};
    S.x.goodsIpView[id] = view;
  }
  action('goods-open-ip', ds => { setIpView(ds.arg, 'curated'); nav.push('goods-ip', ds.arg); });
  action('goods-open-ip-tree', ds => { setIpView(ds.arg, 'graph'); nav.push('goods-ip', ds.arg); });
  action('goods-open-ip-hall', ds => {
    const hall = ipHallById(ds.arg);
    if (!hall) return;
    setIpView(hall.subject.id, 'curated');
    nav.push('goods-ip', String(hall.subject.id));
  });
  action('goods-ip-tab', ds => {
    const [id, view] = ds.arg.split(':');
    setIpView(id, view);
    render();
  });
  action('goods-ip-show-raw', ds => { setIpView(ds.arg, 'raw'); render(); });
  action('goods-ip-cat', ds => {
    const [ip, cat] = ds.arg.split(':');
    S.x.goodsIpCat = S.x.goodsIpCat || {};
    S.x.goodsIpCat[ip] = cat;
    render();
  });
  action('goods-ip-graph-more', ds => {
    S.x.goodsIpGraphLimit = S.x.goodsIpGraphLimit || {};
    S.x.goodsIpGraphLimit[ds.arg] = (S.x.goodsIpGraphLimit[ds.arg] || 3) + 3;
    render();
  });
  action('goods-ip-media-more', ds => {
    S.x.goodsIpMediaLimit = S.x.goodsIpMediaLimit || {};
    S.x.goodsIpMediaLimit[ds.arg] = (S.x.goodsIpMediaLimit[ds.arg] || 2) + 2;
    render();
  });
  action('goods-ip-group-more', ds => {
    S.x.goodsIpGroupLimit = S.x.goodsIpGroupLimit || {};
    S.x.goodsIpGroupLimit[ds.arg] = (S.x.goodsIpGroupLimit[ds.arg] || 3) + 3;
    render();
  });
  action('goods-ip-open-node', ds => {
    const [fromId, toId] = ds.arg.split(':');
    const from = ipById(fromId), to = ipById(toId);
    if (!to) return;
    if (from && from.kind === 'character' && to.kind === 'work') {
      S.x.goodsIpGraphHighlight = S.x.goodsIpGraphHighlight || {};
      S.x.goodsIpGraphHighlight[to.id] = from.id;
    }
    setIpView(to.id, 'graph');
    nav.push('goods-ip', String(to.id));
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
    // 原型禁止 fetch：真实图只交给浏览器原图下载/打开；App 侧仍由 MediaStore 保存。
    const a = document.createElement('a');
    a.href = url;
    a.download = (g.title || 'goods') + '.jpg';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    toast('已尝试下载原图；浏览器未下载时可长按另存');
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
