// 主题：Material 3 观感。App 侧为动态取色（Android 12+），fallback 种子色 #E8A562（纸箱橙），
// 这里以 fallback 方案为基准：primary 覆盖为种子色，其余角色取 M3 baseline。
// 明/暗跟随系统，也可在原型内手动切换（App 无手动切换，此为原型调试便利）。
(function () {
  const root = document.documentElement;
  // file:// 或隐私模式下 localStorage 可能抛异常，做兜底
  let forced = null;
  try { forced = localStorage.getItem('proto-theme'); } catch (e) { /* 忽略 */ }
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
