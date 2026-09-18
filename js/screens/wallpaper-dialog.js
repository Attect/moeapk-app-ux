// 壁纸设置对话框（图片 / 视频素材查看器"设为壁纸"复用）。
// 对应 WallpaperCenterScreen.kt 的 SetWallpaperDialog / 视频壁纸对话框。
(function () {
  // 图片壁纸：视差强度 + 桌面/锁屏/动态壁纸
  function openSetDialog(a) {
    const cfg = S.x.wpCfg = S.x.wpCfg || { parallax: 1.0 };
    showDialog({
      title: '设为壁纸',
      body: '<div class="wp-preview" style="background:linear-gradient(165deg,hsl(' + a.hue + ',62%,64%),hsl(' + ((a.hue + 60) % 360) + ',48%,30%))"></div>' +
        '<div class="li-sub" style="text-align:center">' + esc(a.label) + ' · ' + esc(a.date) + ' · 将按屏幕比例居中裁剪</div>' +
        '<label class="slider-row"><span class="li-title">视差强度 ' + cfg.parallax.toFixed(1) + '</span><input type="range" min="0.2" max="2" step="0.1" value="' + cfg.parallax + '" class="slider" data-live="wp-parallax"></label>' +
        '<div class="hr"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 0">' +
        btn('设为桌面', 'wp-set-home', null, 'small') + btn('设为锁屏', 'wp-set-lock', null, 'small ghost') + btn('桌面+锁屏', 'wp-set-both', null, 'small ghost') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        btn('动态壁纸（视差）', 'wp-parallax-set', null, 'small ghost') +
        btn('删除', 'wp-del', a.id, 'small danger') + '</div>',
      actions: [{ label: '取消' }]
    });
  }
  // 视频壁纸：声音开关 + 亮度
  function openVideoDialog(a) {
    S.x.videoCfg = S.x.videoCfg || { sound: false, bright: 80 };
    const v = S.x.videoCfg;
    showDialog({
      title: '视频动态壁纸',
      body: '<div class="muted" style="font-size:13px">' + esc(a.label) + ' · ' + esc(a.meta || '12 秒 · 1080×1920') + '（≤30 秒、≤1080p 校验通过）</div>' +
        '<div class="hr"></div>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">播放声音</div></div>' + switchCtl(v.sound, 'vid-sound') + '</div>' +
        '<label class="slider-row"><span class="li-title">亮度 ' + v.bright + '%</span><input type="range" min="40" max="100" value="' + v.bright + '" class="slider" data-live="vid-bright"></label>',
      actions: [
        { label: '取消' },
        { label: '设为视频壁纸', style: 'filled', run: () => toast('已写入视频壁纸槽位，调起系统选择器（模拟）') }
      ]
    });
  }
  window.openSetDialog = openSetDialog;
  window.openVideoDialog = openVideoDialog;

  action('wp-parallax', (ds, el) => { S.x.wpCfg.parallax = +el.value; });
  action('wp-set-home', () => { closeDialog(); toast('已设为桌面壁纸（模拟）'); });
  action('wp-set-lock', () => { closeDialog(); toast('已设为锁屏壁纸（模拟）'); });
  action('wp-set-both', () => { closeDialog(); toast('已设为桌面与锁屏壁纸（模拟）'); });
  action('wp-parallax-set', () => {
    closeDialog();
    mock.startJob('wp-depth', '深度估计模型', 2400, ['下载模型', '推理']);
    const t = setInterval(() => {
      if (mock.isJobDone('wp-depth')) { clearInterval(t); toast('已调起系统动态壁纸选择器（模拟）'); }
    }, 300);
  });
  action('wp-del', ds => confirmDialog('删除素材', '将从素材库删除。', '删除', () => {
    S.x.assets = S.x.assets.filter(x => x.id !== ds.arg);
    closeDialog(); render();
  }, true));
  action('vid-sound', () => { S.x.videoCfg.sound = !S.x.videoCfg.sound; render(); });
  action('vid-bright', (ds, el) => { S.x.videoCfg.bright = +el.value; });
})();
