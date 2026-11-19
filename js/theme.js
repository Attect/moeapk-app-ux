// 主题：MoeApk（二次元）双主题。App 侧为动态取色（Android 12+），fallback 种子色为浅纯绿 #8FBC91。
// 原型以浅绿为主色，文字按主题使用当前绿 → 深绿的同色系渐变；原控件参数不变。
// 明/暗跟随系统，也可在原型内手动切换（App 无手动切换，此为原型调试便利）。
(function () {
  const root = document.documentElement;
  // file:// 或隐私模式下 localStorage 可能抛异常，做兜底
  // 也支持 ?theme=dark / ?theme=light 单次覆盖（截图/调试便利，不写 localStorage）
  let forced = null;
  try { forced = localStorage.getItem('proto-theme'); } catch (e) { /* 忽略 */ }
  const qsTheme = (location.search.match(/[?&]theme=(dark|light)/) || [])[1];
  if (qsTheme) forced = qsTheme;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function apply() {
    const dark = forced ? forced === 'dark' : media.matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  window.theme = {
    toggle() {
      const cur = root.getAttribute('data-theme') === 'dark';
      forced = cur ? 'light' : 'dark';
      try { localStorage.setItem('proto-theme', forced); } catch (e) { /* 忽略 */ }
      apply();
    },
    isDark() { return root.getAttribute('data-theme') === 'dark'; }
  };
  media.addEventListener('change', apply);
  apply();
})();
