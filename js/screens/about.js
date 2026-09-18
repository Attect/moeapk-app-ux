// 关于页：版本信息 + 开源许可列表。对应 ui/about/AboutScreen.kt
(function () {
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
          '<div class="li-sub">' + esc(l[1]) + '</div></div><span class="li-arrow">' + icon(exp ? 'expand_less' : 'keyboard_arrow_right') + '</span></div>' +
          (exp ? '<div class="license-text">' + esc(l[2]) + '\n\n（原型中许可证正文省略，详见 App 内 assets。）</div>' : '') +
          (i < LICENSES.length - 1 ? '<div class="hr"></div>' : '');
      }).join('') + '</div>');
      h += '<div class="muted small center" style="padding:22px">萌萌安卓 MoeApk · moeapk.com</div>';
      return h;
    }
  });
  action('lic-toggle', ds => { S.x.licenseOpen = S.x.licenseOpen === +ds.arg ? null : +ds.arg; render(); });
})();
