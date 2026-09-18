// 关于 / 壁纸中心 / 点云预览
// 对应：ui/about/AboutScreen.kt、ui/wallpaper/WallpaperCenterScreen.kt、PointCloudPreviewScreen.kt
(function () {
  // ---------- 关于 ----------
  const LICENSES = [
    ['LocalDream', 'CC BY-NC 4.0', '生图引擎应用（本地 Diffusion）。署名-非商业性使用。'],
    ['Real-ESRGAN', 'MIT', 'ximoke Zhang et al. 实用的图像超分辨率模型。'],
    ['4x_UltraSharp', '自定义', 'Kim2091 的写实向放大模型。'],
    ['Audio8-AI', 'Apache-2.0', 'DualAR 多语言 TTS 与语音克隆。'],
    ['llama.cpp', 'MIT', 'Georgi Gerganov 的纯 C/C++ LLM 推理。'],
    ['ONNX Runtime', 'MIT', '微软出品的跨平台推理引擎。'],
    ['MNN', 'Apache-2.0', '阿里巴巴开源的轻量深度学习框架。'],
    ['Kotlin', 'Apache-2.0', 'JetBrains 出品的现代 JVM 语言。'],
    ['AndroidX', 'Apache-2.0', 'Android Jetpack 扩展库。'],
    ['Jetpack Compose', 'Apache-2.0', 'Android 声明式 UI 工具包。'],
    ['Ktor', 'Apache-2.0', 'JetBrains 的异步 Kotlin Web 框架。'],
    ['Material Icons', 'Apache-2.0', 'Google Material 图标库。']
  ];
  registerScreen('about', {
    title: '关于',
    render() {
      const open = S.x.licenseOpen;
      let h = '<div style="text-align:center;padding-top:28px">' +
        '<img src="assets/ic_launcher_fg.png" alt="MoeApk" style="width:72px;height:72px;border-radius:16px;background:#fff;object-fit:cover">' +
        '<div class="headline" style="font-size:22px;margin-top:10px">MoeApk</div>' +
        '<div class="muted">版本 0.9.5（26）</div></div>';
      h += sectionTitle('开源许可');
      h += card('<div class="card tight expander" style="padding:0;margin-top:0">' + LICENSES.map((l, i) => {
        const exp = open === i;
        return '<div class="li" data-a="lic-toggle" data-arg="' + i + '"><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(l[0]) + '</div>' +
          '<div class="li-sub">' + esc(l[1]) + '</div></div><span class="li-arrow">' + icon(exp ? 'expand_less' : 'expand_more') + '</span></div>' +
          (exp ? '<div class="license-text">' + esc(l[2]) + '\n\n（原型中许可证正文省略，详见 App 内 assets。）</div>' : '') +
          (i < LICENSES.length - 1 ? '<div class="hr"></div>' : '');
      }).join('') + '</div>');
      h += '<div class="muted small center" style="padding:22px">萌萌安卓 MoeApk · moeapk.com</div>';
      return h;
    }
  });
  action('lic-toggle', ds => { S.x.licenseOpen = S.x.licenseOpen === +ds.arg ? null : +ds.arg; render(); });

  // ---------- 壁纸中心 ----------
  function wpThumb(w) {
    return '<div class="wp-cell wp-thumb" data-a="wp-open" data-arg="' + w.id + '" style="background:linear-gradient(165deg,hsl(' + w.hue + ',62%,64%),hsl(' + ((w.hue + 60) % 360) + ',48%,30%))">' +
      '<span>' + esc(w.label) + '</span></div>';
  }
  registerScreen('wallpaper', {
    title: '壁纸中心',
    render() {
      let h = '<div class="wp-grid">' +
        '<div class="wp-cell wp-add" data-a="wp-pick">' + icon('add') + '<span>选择图片</span></div>' +
        '<div class="wp-cell wp-add" data-a="wp-pick-video">' + icon('videocam') + '<span>选择视频<br>动态壁纸</span></div>' +
        S.x.wallpapers.map(wpThumb).join('') + '</div>';
      return h;
    }
  });
  action('wp-pick', () => {
    S.x.wallpapers.unshift({ id: 'wp' + Date.now(), hue: 150, label: '相册·模拟', date: '2026-09-18' });
    render();
    S.x.wpCurrent = S.x.wallpapers[0].id;
    openSetDialog(S.x.wallpapers[0]);
  });
  action('wp-open', ds => {
    const w = S.x.wallpapers.find(x => x.id === ds.arg);
    if (w) { S.x.wpCurrent = w.id; openSetDialog(w); }
  });
  action('wp-pick-video', () => {
    S.x.videoCfg = S.x.videoCfg || { sound: false, bright: 80 };
    showDialog({
      title: '视频动态壁纸',
      body: '<div class="muted" style="font-size:13px">示例视频.mp4 · 12 秒 · 1080×1920（≤30 秒、≤1080p 校验通过）</div>' +
        '<div class="hr"></div>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">播放声音</div></div>' + switchCtl(S.x.videoCfg.sound, 'vid-sound') + '</div>' +
        '<label class="slider-row"><span class="li-title">亮度 ' + S.x.videoCfg.bright + '%</span><input type="range" min="40" max="100" value="' + S.x.videoCfg.bright + '" class="slider" data-live="vid-bright"></label>',
      actions: [
        { label: '取消' },
        { label: '设为视频壁纸', style: 'filled', run: () => toast('已写入视频壁纸槽位，调起系统选择器（模拟）') }
      ]
    });
  });
  action('vid-sound', () => { S.x.videoCfg.sound = !S.x.videoCfg.sound; render(); });
  action('vid-bright', (ds, el) => { S.x.videoCfg.bright = +el.value; });

  function openSetDialog(w) {
    const cfg = S.x.wpCfg = S.x.wpCfg || { parallax: 1.0 };
    const isLib = true;
    showDialog({
      title: '设为壁纸',
      body: '<div class="wp-preview" style="background:linear-gradient(165deg,hsl(' + w.hue + ',62%,64%),hsl(' + ((w.hue + 60) % 360) + ',48%,30%))"></div>' +
        '<div class="li-sub" style="text-align:center">' + esc(w.label) + ' · ' + esc(w.date) + ' · 将按屏幕比例居中裁剪</div>' +
        '<label class="slider-row"><span class="li-title">视差强度 ' + cfg.parallax.toFixed(1) + '</span><input type="range" min="0.2" max="2" step="0.1" value="' + cfg.parallax + '" class="slider" data-live="wp-parallax"></label>' +
        '<div class="hr"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 0">' +
        btn('设为桌面', 'wp-set-home', null, 'small') + btn('设为锁屏', 'wp-set-lock', null, 'small ghost') + btn('桌面+锁屏', 'wp-set-both', null, 'small ghost') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        btn('AI 放大后设置', 'wp-upscale', null, 'small ghost') + btn('动态壁纸（视差）', 'wp-parallax-set', null, 'small ghost') +
        btn('3D 点云（较慢/GPU/旗舰芯）', 'wp-3d', null, 'small ghost') +
        (isLib ? btn('删除', 'wp-del', w.id, 'small danger') : '') + '</div>',
      actions: [{ label: '取消' }]
    });
  }
  action('wp-parallax', (ds, el) => { S.x.wpCfg.parallax = +el.value; });
  action('wp-set-home', () => { closeDialog(); toast('已设为桌面壁纸（模拟）'); });
  action('wp-set-lock', () => { closeDialog(); toast('已设为锁屏壁纸（模拟）'); });
  action('wp-set-both', () => { closeDialog(); toast('已设为桌面与锁屏壁纸（模拟）'); });
  action('wp-upscale', () => { closeDialog(); nav.goTab('ai'); nav.setAiTab('upscale'); toast('已跳转到 AI 放大（模拟 UiBus）'); });
  action('wp-parallax-set', () => { closeDialog(); mock.startJob('wp-depth', '深度估计模型', 2400, ['下载模型', '推理']); const t = setInterval(() => { if (mock.isJobDone('wp-depth')) { clearInterval(t); toast('已调起系统动态壁纸选择器（模拟）'); } }, 300); });
  action('wp-3d', () => { closeDialog(); nav.push('pointcloud-preview', S.x.wpCurrent); });
  action('wp-del', ds => confirmDialog('删除壁纸', '将从壁纸库删除。', '删除', () => {
    S.x.wallpapers = S.x.wallpapers.filter(x => x.id !== ds.arg);
    render();
  }, true));

  // ---------- 点云预览 ----------
  registerScreen('pointcloud-preview', {
    title: '点云预览',
    render(arg) {
      const w = S.x.wallpapers.find(x => x.id === arg) || S.x.wallpapers[0] || { hue: 26, label: '示例' };
      const cfg = S.x.pc = S.x.pc || { power: 1.0, quality: 100, zoom: 1.0, panX: 0, panY: 0, sway: true, panMode: false };
      if (!S.x.pcDots) {
        S.x.pcDots = [];
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 90; i++) {
          S.x.pcDots.push({ x: 8 + rnd() * 84, y: 20 + rnd() * 60, s: 1.5 + rnd() * 4, d: 0.4 + rnd() * 0.6 });
        }
      }
      const dots = S.x.pcDots.map(d =>
        '<div class="pc-dot" style="left:' + d.x + '%;top:' + d.y + '%;width:' + (d.s * cfg.zoom) + 'px;height:' + (d.s * cfg.zoom) + 'px;opacity:' + (0.35 + d.d * 0.6) + '"></div>').join('');
      return '<div class="pc-stage">' + dots +
        '<div class="pc-stats">点数 1,179,432 · pcache v2<br>焦距 525.4 · 深度 μ=2.41 σ=1.12<br>帧耗时 36ms（28fps）· ' + esc(w.label) + '</div>' +
        '<div class="pc-controls">' +
        '<label class="slider-row"><span class="li-title">强度 ' + cfg.power.toFixed(1) + '</span><input type="range" min="0.2" max="2" step="0.1" value="' + cfg.power + '" class="slider" data-live="pc-set" data-k="power"></label>' +
        '<label class="slider-row"><span class="li-title">点云精度 ' + cfg.quality + '%</span><input type="range" min="30" max="100" step="1" value="' + cfg.quality + '" class="slider" data-live="pc-set" data-k="quality"></label>' +
        '<label class="slider-row"><span class="li-title">缩放 ' + cfg.zoom.toFixed(1) + 'x</span><input type="range" min="0.6" max="2.5" step="0.1" value="' + cfg.zoom + '" class="slider" data-live="pc-set" data-k="zoom"></label>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">自动摇摆</div></div>' + switchCtl(cfg.sway, 'pc-sway') + '</div>' +
        '<div class="li"><div class="li-body"><div class="li-title" style="font-weight:400">平面平移</div></div>' + switchCtl(cfg.panMode, 'pc-panmode') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:8px">' +
        btn('回正', 'pc-reset', null, 'small ghost') + btn('截图', 'pc-shot', null, 'small ghost') +
        btn('应用为壁纸', 'pc-apply', null, 'small') + '</div></div></div>';
    }
  });
  action('pc-set', (ds, el) => {
    const cfg = S.x.pc; const k = ds.k;
    cfg[k] = +el.value;
    const lb = el.parentElement.querySelector('.li-title');
    if (lb) lb.textContent = lb.textContent.replace(/ [\d.]+x?%?$/, '') + ' ' + (k === 'quality' ? cfg[k] + '%' : (k === 'zoom' ? cfg[k].toFixed(1) + 'x' : cfg[k].toFixed(1)));
    // 缩放即时重绘点云
    if (k === 'zoom') render();
  });
  action('pc-sway', () => { S.x.pc.sway = !S.x.pc.sway; render(); });
  action('pc-panmode', () => { S.x.pc.panMode = !S.x.pc.panMode; render(); });
  action('pc-reset', () => { S.x.pc = { power: 1.0, quality: 100, zoom: 1.0, panX: 0, panY: 0, sway: true, panMode: false }; render(); });
  action('pc-shot', () => toast('已截图到外部存储（模拟）'));
  action('pc-apply', () => toast('已调起系统动态壁纸选择器（模拟）'));
})();
