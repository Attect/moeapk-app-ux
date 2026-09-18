// 下载页（子页，从"我的 → 下载任务"进入）。对应 ui/download/DownloadScreen.kt
(function () {
  function statusText(t) {
    switch (t.status) {
      case 'pending': return '等待中';
      case 'downloading': return '下载中（源 ' + t.source + '）· ' + fmtSize(t.downloaded) + ' / ' + fmtSize(t.size);
      case 'paused': return '已暂停 · ' + fmtSize(t.downloaded) + ' / ' + fmtSize(t.size);
      case 'verifying': return '校验中…';
      case 'done': return '已完成 · ' + fmtSize(t.size);
      case 'failed': return '失败：' + (t.error || '下载失败');
    }
  }
  function taskCard(t) {
    let actions = '';
    if (t.status === 'downloading' || t.status === 'pending') actions = textBtn('暂停', 'dl-pause', t.id);
    else if (t.status === 'paused') actions = textBtn('继续', 'dl-resume', t.id) + textBtn('移除', 'dl-remove', t.id, 'danger');
    else if (t.status === 'done' || t.status === 'failed') actions = textBtn('移除', 'dl-remove', t.id, 'danger');
    let bar = '';
    if (t.status === 'downloading' || t.status === 'paused') bar = progress(t.downloaded / t.size);
    else if (t.status === 'verifying') bar = progressInd();
    return card('<div class="dl-row"><div style="flex:1;min-width:0"><div class="li-title" style="font-weight:400;word-break:break-all">' + esc(t.name) + '</div>' +
      '<div class="dl-status">' + esc(statusText(t)) + '</div></div><div style="flex:none">' + actions + '</div></div>' + bar);
  }
  registerScreen('downloads', {
    title: '下载',
    render() {
      let h = '';
      if (!S.x.tasks.length) {
        h += '<div class="empty-illust">' + icon('cloud_download') +
          '<div class="empty-title">暂无下载任务</div>' +
          '<div class="empty-sub">在应用详情、模型中心等处发起的下载会出现在这里</div></div>';
      } else {
        h += S.x.tasks.map(taskCard).join('');
      }
      h += '<div style="margin-top:16px;text-align:center;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="tbtn" data-a="dl-test">[debug] 测试下载 moeapk.com/favicon.png（免校验）</button>' +
        '<button class="tbtn" data-a="dl-fail-test">[debug] 模拟失败</button></div>';
      return h;
    }
  });
  action('dl-pause', ds => mock.pause(+ds.arg));
  action('dl-resume', ds => mock.resume(+ds.arg));
  action('dl-remove', ds => mock.remove(+ds.arg));
  action('dl-test', () => { mock.enqueue('favicon.png', 32680); toast('已加入下载队列：favicon.png'); });
  action('dl-fail-test', () => {
    const t = S.x.tasks.find(x => x.status === 'downloading' || x.status === 'pending');
    if (!t) { toast('当前没有进行中的任务，请先添加一个下载'); return; }
    const kinds = Object.keys(mock.FAIL_TEXT);
    mock.fail(t.id, kinds[Math.floor(Math.random() * kinds.length)]);
    toast('已模拟失败：' + t.name);
  });
})();
