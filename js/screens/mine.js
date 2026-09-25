// 我的 Tab。对应 ui/mine/MineScreen.kt

// ---------- 第八轮文案：hero 问候语 ----------
// 未登录时标题按一天时段随机问候（登录时保持「用户名，欢迎回来！」）；
// 第三行（品牌行 <br> 后）从随机池抽取。同一小时内复用已抽中的句子，避免每次 render 文案闪变。
var HERO_GREETINGS = [ // from = 起始小时（升序），命中最后一个 from <= 当前小时 的时段
  { from: 0,  name: '午夜', lines: ['该睡了哦~', '夜深人静，早点休息吧', '月亮都困了，你也该睡了'] },
  { from: 4,  name: '黎明', lines: ['是不是熬穿了，注意身体', '天蒙蒙亮了，喝口水休息一下吧', '通宵虽爽，可别贪杯哦'] },
  { from: 6,  name: '早上', lines: ['精神满满的一天开始了', '早安！今天也是崭新的一天', '早上好，元气加载完成~'] },
  { from: 11, name: '中午', lines: ['现在适合放松一下呢', '午饭时间到，先犒劳一下自己', '中午好，给自己充充电吧'] },
  { from: 13, name: '下午', lines: ['努力的一天~继续加油', '下午时光，效率拉满', '保持节奏，稳稳前进'] },
  { from: 18, name: '傍晚', lines: ['晚霞正好，歇一会儿吧', '夕阳西下，辛苦一天啦', '傍晚的风，最适合出去走走'] },
  { from: 20, name: '晚上', lines: ['精神满满自由时刻', '夜晚时间，做自己喜欢的事', '夜猫子模式，启动~'] }
];
var HERO_SUBS = [
  '应用、壁纸、AI，都在等你哦',
  '今天想折腾点什么好呢',
  '安卓娘陪你一起折腾~',
  '慢慢逛，发现喜欢的应用吧',
  '开源世界里藏着好多宝藏'
];
// 抽句逻辑抽成函数便于走查（可按小时直调验证各时段）：heroCopyFor(hour) -> {hour, slot, greet, sub}
function heroCopyFor(hour) {
  let slot = HERO_GREETINGS[0];
  for (const g of HERO_GREETINGS) { if (g.from <= hour) slot = g; }
  return {
    hour: hour, slot: slot.name,
    greet: slot.lines[Math.floor(Math.random() * slot.lines.length)],
    sub: HERO_SUBS[Math.floor(Math.random() * HERO_SUBS.length)]
  };
}
function heroCopy() {
  const h = new Date().getHours();
  const c = S.x.heroCopy;
  if (c && c.hour === h) return c;
  return (S.x.heroCopy = heroCopyFor(h));
}

(function () {
  registerScreen('tab:mine', {
    title: '我的',
    render() {
      const cache = S.x.iconCache = S.x.iconCache || { count: 12, bytes: 7340032, mem: 30, disk: 12, net: 4 };
      const hero = heroCopy();
      let h = '';
      // 吉祥物问候横幅（MoeApk 主题：渐变 hero + Grok Bot 大头，明暗双版）
      // 第八轮文案：未登录标题 = 时段随机问候（heroCopy）；第三行 = 随机池（登录/未登录同池）
      h += '<div class="moe-hero">' +
        '<div class="moe-hero-text">' +
        '<div class="moe-hero-title">' + (S.loggedIn && S.user ? esc(S.user.name) + '，欢迎回来！' : esc(hero.greet)) + '</div>' +
        '<div class="moe-hero-sub"><span class="moe-brand">MoeApk</span> · 萌萌安卓<br>' + esc(hero.sub) + '</div>' +
        '</div>' +
        '<img class="moe-hero-img d-only" src="assets/chara-head.webp" alt="安卓娘">' +
        '<img class="moe-hero-img n-only" src="assets/chara-head-night.webp" alt="安卓娘">' +
        '<span class="sparkle" style="left:50%;top:16px">✦</span>' +
        '<span class="sparkle s2" style="left:44%;top:56px;font-size:9px">✧</span>' +
        '<span class="sparkle s3" style="left:62%;bottom:18px;font-size:8px">✦</span>' +
        '</div>';
      // 账户
      h += sectionTitle('账户');
      h += card(listItem({
        icon: 'account_circle', title: 'MK 通行证',
        sub: S.loggedIn && S.user ? '已登录：' + S.user.name : '未登录，点击登录',
        arrow: true, action: 'go-account'
      }) + '<div class="hr"></div>' + listItem({
        icon: 'favorite', title: '我的收藏',
        sub: (S.favs && S.favs.length ? S.favs.length + ' 个条目' : '收藏的应用与开源项目'),
        arrow: true, action: 'go-favorites'
      }) + '<div class="hr"></div>' + listItem({
        icon: 'verified', title: '已授权应用', arrow: true, action: 'go-account'
      }), 'tight');
      action('go-favorites', () => nav.push('favorites'));
      // 服务
      h += sectionTitle('服务');
      h += card(listItem({
        icon: 'power_settings_new', title: '后台服务',
        sub: S.serviceRunning ? '常驻运行中：提供通行证 / 下载 / AI 能力' : '已停止',
        trailing: switchCtl(S.serviceRunning, 'mine-service')
      }) + '<div class="hr"></div>' + listItem({
        icon: 'battery_saver', title: '电池优化白名单',
        sub: S.batteryWhitelisted ? '已加入白名单' : '未加入，可能被系统杀后台',
        arrow: true, action: 'mine-battery'
      }), 'tight');
      // 下载
      h += sectionTitle('下载');
      const activeCnt = S.x.tasks.filter(t => t.status === 'downloading' || t.status === 'pending' || t.status === 'verifying').length;
      const nodes = S.x.nodes = S.x.nodes || [
        { name: '国内 A 节点', ms: 38 }, { name: '国内 D 节点', ms: 52 },
        { name: '海外 B 节点', ms: 210 }, { name: '海外 C 节点', ms: 187 }
      ];
      h += card(listItem({
        icon: 'download', title: '下载任务',
        sub: S.x.tasks.length ? S.x.tasks.length + ' 个任务' + (activeCnt ? ' · ' + activeCnt + ' 个进行中' : '') : '暂无下载任务',
        trailing: activeCnt ? '<span class="count-badge">' + activeCnt + '</span>' : undefined,
        arrow: true, action: 'go-downloads'
      }) + '<div class="hr"></div>' + radioRow('国内优先', 'AI 引擎 / 安装包 / 数据包优先国内节点', S.srcPref === 'domestic', 'mine-src', 'domestic') +
        '<div class="hr"></div>' + radioRow('稳定优先', '海外机房优先', S.srcPref === 'stable', 'mine-src', 'stable') +
        '<div class="hr"></div><div class="li" style="cursor:default;flex-wrap:wrap;gap:6px 14px">' +
        nodes.map(n => '<span class="node-row"><span class="node-dot' + (n.ms > 400 ? ' down' : n.ms > 100 ? ' slow' : '') + '"></span>' +
          esc(n.name) + ' ' + (n.ms > 400 ? '不可达' : n.ms + 'ms') + '</span>').join('') +
        '<span class="node-row" style="flex-basis:100%"><span class="muted small">源偏好 ' + (S.srcPref === 'domestic' ? '国内优先' : '稳定优先') + ' · 节点延迟为上次测速结果</span></span></div>', 'tight');
      // 存储
      h += sectionTitle('存储');
      h += card(listItem({
        icon: 'settings', title: '图标缓存',
        sub: cache.count + ' 个 · ' + fmtSize(cache.bytes) + ' · 内存命中 ' + cache.mem + ' / 磁盘命中 ' + cache.disk + ' / 网络 ' + cache.net,
        trailing: textBtn('清理', 'mine-clear-cache')
      }), 'tight');
      // 其它
      h += sectionTitle('其它');
      h += card(listItem({ icon: 'info', title: '关于', arrow: true, action: 'go-about' }), 'tight');
      // 开发者（debug）
      h += sectionTitle('开发者');
      h += card(listItem({
        icon: 'settings', title: '服务端地址',
        sub: S.serverOverride ? S.serverOverride : '默认（moeapk.com）',
        arrow: true, action: 'mine-server'
      }), 'tight');
      return h;
    }
  });
  action('go-account', () => nav.push(S.loggedIn ? 'account' : 'login'));
  action('go-about', () => nav.push('about'));
  action('go-downloads', () => nav.push('downloads'));
  action('mine-service', () => { S.serviceRunning = !S.serviceRunning; toast(S.serviceRunning ? '后台服务已启动（模拟）' : '后台服务已停止（模拟）'); render(); });
  action('mine-battery', () => { S.batteryWhitelisted = !S.batteryWhitelisted; toast(S.batteryWhitelisted ? '已加入电池优化白名单（模拟）' : '已移除白名单（模拟）'); render(); });
  action('mine-src', ds => { S.srcPref = ds.arg; render(); });
  action('mine-clear-cache', () => { S.x.iconCache = { count: 0, bytes: 0, mem: 0, disk: 0, net: 0 }; toast('图标缓存已清理'); render(); });
  action('mine-server', () => {
    showDialog({
      title: '服务端地址',
      body: field({ id: 'srv-override', label: 'Base URL（留空恢复默认）', value: S.serverOverride, mono: true }),
      actions: [
        { label: '恢复默认', run: () => { S.serverOverride = ''; toast('已恢复默认'); } },
        { label: '保存', style: 'filled', run: () => { S.serverOverride = ((S.x.keep || {})['srv-override'] || '').trim(); toast('已保存（模拟）'); } }
      ]
    });
  });
})();
