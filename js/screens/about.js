// 关于页：版本信息 + 原型版本（git 提交）+ 开源许可列表。对应 ui/about/AboutScreen.kt
//
// 原型版本约定：PROTO_COMMIT / PROTO_DATE 记录本原型自身的 git 提交，
// 由维护者在每次提交前更新为当前 HEAD（提交者无需处理）。
// App 关于页显示同形态的一行，值为其 UX 同步所依据的原型提交。
const PROTO_COMMIT = '8dd7aa2';
const PROTO_DATE = '2026-09-24';
const PROTO_COMMIT_URL = 'https://github.com/Attect/moeapk-app-ux/commit/';

(function () {
  const LICENSES = [
    ['LocalDream', 'CC BY-NC 4.0', '生图引擎应用（本地 Diffusion）。署名-非商业性使用。'],
    ['Real-ESRGAN', 'BSD-3-Clause', 'Xintao Wang 等（Tencent ARC）的图像超分辨率模型（x4plus_anime_6B）。'],
    ['4x_UltraSharp', 'CC BY-NC-SA 4.0（非商业）', 'Kim2091 的写实向放大模型（非商业性使用、相同方式共享）。'],
    ['Audio8-AI', 'Apache-2.0', 'DualAR 多语言 TTS 与语音克隆。'],
    ['llama.cpp', 'MIT', 'Georgi Gerganov 的纯 C/C++ LLM 推理。'],
    ['ONNX Runtime', 'MIT', '微软出品的跨平台推理引擎。'],
    ['MNN', 'Apache-2.0', '阿里巴巴开源的轻量深度学习框架（扩散 CPU / 点云）。'],
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
        '<div class="headline moe-brand" style="font-size:24px;margin-top:6px">MoeApk</div>' +
        '<div class="muted">版本 0.10.3（30）</div>' +
        '<div class="muted small" style="margin-top:4px">界面原型 <a href="' + PROTO_COMMIT_URL + PROTO_COMMIT + '" style="color:var(--primary)">' + PROTO_COMMIT + '</a>（' + PROTO_DATE + '）</div></div>';
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
