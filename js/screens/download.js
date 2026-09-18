// 下载页（子页，从"我的 → 下载任务"进入）。对应 ui/download/DownloadScreen.kt
// F3 安装链路：完成的任务可"安装"（模拟调起系统安装器）/ OBB 提示；
// F13 策略：仅 Wi-Fi 下载开关 + 模拟网络切换；I5 空态 CTA。
// 状态机设计（本轮修正）：退后台下载继续、回前台进度无缝衔接；
// 校验是下载完成后的独立阶段（保留下载进度条）；失败重试默认断点续传（仅校验失败从头重下）。
(function () {
  function statusText(t) {
    switch (t.status) {
      case 'pending': return '等待中';
      case 'downloading': return '下载中 · ' + fmtSize(t.downloaded) + ' / ' + fmtSize(t.size) +
        ' · ' + fmtSize((t.lastSpeed || 0) * 2) + '/s（源 ' + t.source + '）';
      case 'paused': return (t.netHold ? '已暂停（仅 Wi-Fi · 蜂窝网络）' : '已暂停') + ' · ' + fmtSize(t.downloaded) + ' / ' + fmtSize(t.size) +
        ' · 点「继续」从 ' + Math.round(t.downloaded / t.size * 100) + '% 续传';
      case 'verifying': return '下载完成，校验中…（' + fmtSize(t.size) + '）';
      case 'done': return '已完成 · 校验通过 · ' + fmtSize(t.size);
      case 'failed': return '失败：' + (t.error || '下载失败') +
        (t.downloaded > 0 && t.errorKind !== 'badhash' ? ' · 已下载 ' + Math.round(t.downloaded / t.size * 100) + '%，重试将续传' : '');
    }
  }
  function taskCard(t) {
    let actions = '';
    if (t.status === 'downloading' || t.status === 'pending') actions = textBtn('暂停', 'dl-pause', t.id);
    else if (t.status === 'paused') actions = textBtn('继续', 'dl-resume', t.id) + textBtn('移除', 'dl-remove', t.id, 'danger');
    else if (t.status === 'done') actions = textBtn('安装', 'dl-install', t.id) + textBtn('移除', 'dl-remove', t.id, 'danger');
    else if (t.status === 'failed') actions = textBtn('重试', 'dl-retry', t.id) + textBtn('移除', 'dl-remove', t.id, 'danger');
    let bar = '';
    // 下载中/暂停/校验都保留同一根进度条：进度只增不减，校验只是进度走满后的独立阶段
    if (t.status === 'downloading' || t.status === 'paused' || t.status === 'verifying') {
      bar = progress(t.downloaded / t.size) + (t.status === 'verifying' ? '<div class="dl-status" style="margin-top:4px">▸ ' + esc(statusText(t)) + '</div>' : '');
    }
    // F3：游戏数据包（obb）下载完成后的安装提示
    let obb = '';
    if (t.status === 'done' && t.kind === 'obb') {
      obb = '<div class="li-sub" style="margin-top:6px">OBB 数据包将随 APK 安装自动放到 Android/obb 目录（模拟）</div>';
    }
    return card('<div class="dl-row"><div style="flex:1;min-width:0"><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(t.name) + '</div>' +
      (t.status === 'verifying' ? '' : '<div class="dl-status">' + esc(statusText(t)) + '</div>') + '</div><div style="flex:none">' + actions + '</div></div>' + bar + obb);
  }
  registerScreen('downloads', {
    title: '下载',
    render() {
      let h = '';
      // F13：策略行（仅 Wi-Fi + 模拟网络）
      h += card('<div class="dl-row"><div class="li-body"><div class="li-title">仅 Wi-Fi 下载</div>' +
        '<div class="li-sub">' + (S.net === 'cellular' ? '当前蜂窝网络' : '当前 Wi-Fi') + ' · 蜂窝网络下自动暂停，回 Wi-Fi 自动恢复</div></div>' +
        switchCtl(S.wifiOnly, 'dl-wifionly') + '</div>', 'tight');
      h += '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px">' +
        '<span class="muted small">' + (S.net === 'wifi' ? icon('wifi') + ' Wi-Fi' : icon('signal_cellular_alt') + ' 蜂窝') + '</span>' +
        textBtn('[debug] 切网络', 'dl-net-toggle') + '</div>';

      if (!S.x.tasks.length) {
        h += '<div class="empty-illust">' + icon('cloud_download') +
          '<div class="empty-title">暂无下载任务</div>' +
          '<div class="empty-sub">在应用详情、模型中心等处发起的下载会出现在这里</div>' +
          '<div class="empty-cta">' + btn('去应用页逛逛', 'dl-go-apk', null, 'small') + btn('去模型中心', 'dl-go-models', null, 'small ghost') + '</div></div>';
      } else {
        h += S.x.tasks.map(taskCard).join('');
      }
      h += '<div style="margin-top:16px;text-align:center;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="tbtn" data-a="dl-test">[debug] 测试下载 moeapk.com/favicon.png（免校验）</button>' +
        '<button class="tbtn" data-a="dl-fail-test">[debug] 模拟失败</button>' +
        '<button class="tbtn" data-a="dl-bg-test">[debug] 模拟切后台 3 秒</button></div>';
      if (S.x.bgMode) h += '<div class="dl-status" style="text-align:center;padding:8px">◐ 已切后台（模拟）——下载继续在后台进行</div>';
      return h;
    }
  });
  action('dl-pause', ds => mock.pause(+ds.arg));
  action('dl-resume', ds => mock.resume(+ds.arg));
  // I2 轻删：移除走 toast 撤销，而不是弹窗
  action('dl-remove', ds => {
    const id = +ds.arg;
    const t = S.x.tasks.find(x => x.id === id);
    if (!t) return;
    const idx = S.x.tasks.indexOf(t);
    mock.remove(id);
    toast('已移除 ' + t.name, { act: 'dl-undo', arg: JSON.stringify({ t, idx }), label: '撤销' });
  });
  action('dl-undo', ds => {
    const d = JSON.parse(ds.arg);
    S.x.tasks.splice(Math.min(d.idx, S.x.tasks.length), 0, d.t);
    render();
  });
  action('dl-retry', ds => {
    const t = S.x.tasks.find(x => x.id === +ds.arg);
    if (!t) return;
    // 断点续传：保留已下载字节继续下；仅校验失败（哈希不符）才需要从头重下
    const restart = t.errorKind === 'badhash';
    t.status = 'downloading'; t.error = null; t.errorKind = null; t.verifyTick = 0; t.netHold = false;
    if (restart) t.downloaded = 0;
    toast(restart ? '校验失败，从头重新下载' : '已从 ' + Math.round(t.downloaded / t.size * 100) + '% 断点续传');
    render();
  });
  action('dl-bg-test', () => {
    mock.setBackground(true);
    setTimeout(() => mock.setBackground(false), 3000);
  });
  // F3 安装：模拟调起系统安装器（区分 APK / OBB）
  action('dl-install', ds => {
    const t = S.x.tasks.find(x => x.id === +ds.arg);
    if (!t) return;
    if (t.kind === 'obb') { toast('OBB 数据包无需单独安装，随主 APK 放置（模拟）'); return; }
    showDialog({
      title: '安装 ' + t.name,
      body: '<div class="muted" style="font-size:14px">即将调起系统安装器。安装完成后可在桌面启动，或回 MoeApk 查看授权状态。</div>',
      actions: [
        { label: '取消' },
        { label: '安装', style: 'filled', run: () => toast('已调起系统安装器（模拟）') }
      ]
    });
  });
  action('dl-wifionly', () => { S.wifiOnly = !S.wifiOnly; toast(S.wifiOnly ? '已开启仅 Wi-Fi 下载' : '已关闭仅 Wi-Fi 下载'); render(); });
  action('dl-net-toggle', () => { mock.setNet(S.net === 'wifi' ? 'cellular' : 'wifi'); });
  action('dl-go-apk', () => { nav.goTab('apk'); });
  action('dl-go-models', () => { nav.goTab('ai'); nav.push('models'); });
  action('dl-test', () => { mock.enqueue('favicon.png', 32680); toast('已加入下载队列：favicon.png'); });
  action('dl-fail-test', () => {
    const t = S.x.tasks.find(x => x.status === 'downloading' || x.status === 'pending');
    if (!t) { toast('当前没有进行中的任务，请先添加一个下载'); return; }
    const kinds = Object.keys(mock.FAIL_TEXT);
    mock.fail(t.id, kinds[Math.floor(Math.random() * kinds.length)]);
    toast('已模拟失败：' + t.name);
  });
})();
