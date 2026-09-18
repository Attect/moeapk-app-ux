// 下载 Tab。对应 ui/download/DownloadScreen.kt
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
  registerScreen('tab:download', {
    title: '下载',
    render() {
      let h = '';
      if (!S.x.tasks.length) {
        h += '<div style="padding-top:120px;text-align:center;color:var(--on-surface-variant)">' +
          '<div style="width:64px;height:64px;margin:0 auto 12px;opacity:.7">' + icon('cloud_download') + '</div>' +
          '<div>暂无下载任务</div></div>';
      } else {
        h += S.x.tasks.map(taskCard).join('');
      }
      h += '<div style="margin-top:16px;text-align:center">' +
        '<button class="tbtn" data-a="dl-test">[debug] 测试下载 moeapk.com/favicon.png（免校验）</button></div>';
      return h;
    }
  });
  action('dl-pause', ds => mock.pause(+ds.arg));
  action('dl-resume', ds => mock.resume(+ds.arg));
  action('dl-remove', ds => mock.remove(+ds.arg));
  action('dl-test', () => { mock.enqueue('favicon.png', 32680); toast('已加入下载队列：favicon.png'); });
})();
