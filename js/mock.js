// 模拟层：下载引擎、通用任务进度、toast。对应 :download 的 DownloadManager 行为
// （进度推进 / 暂停继续 / 校验 / 失败文案 / 多源显示），全部为本地定时器模拟。
(function () {
  let seq = 1;
  S.x.tasks = [];          // 下载任务
  S.x.jobs = {};           // 通用进度任务 {key: {label, p, phase}}
  S.x.voices = [           // TTS 已保存参考音色（演示）
    { name: 'momori_054', note: '桃璃台词 · 2026-09-10' }
  ];
  S.x.assets = [           // 素材库（图片/视频；壁纸中心拆除后统一为素材）
    { id: 'as1', kind: 'image', hue: 26, label: '示例·晚霞', date: '2026-09-15' },
    { id: 'as2', kind: 'image', hue: 200, label: '示例·海面', date: '2026-09-12' },
    { id: 'as3', kind: 'video', hue: 300, label: '示例·夜樱', date: '2026-09-08', meta: '0:12' },
    { id: 'as4', kind: 'image', hue: 150, label: '示例·林间', date: '2026-09-06' },
    { id: 'as5', kind: 'image', hue: 45, label: '示例·街角', date: '2026-09-02' }
  ];

  const FAIL_TEXT = { unreachable: '网络不可达', timeout: '连接超时', expired: '下载地址已过期', throttled: '请求过于频繁', nospace: '存储空间不足', badhash: '校验失败' };

  window.mock = {
    FAIL_TEXT,
    enqueue(name, size, opt) {
      const t = { id: seq++, name, size, downloaded: 0, status: 'pending', source: 1, error: null, kind: (opt && opt.kind) || 'data' };
      S.x.tasks.unshift(t);
      setTimeout(() => { if (t.status === 'pending') { t.status = 'downloading'; render(); } }, 600);
      render();
      return t;
    },
    enqueueParts(parts, label) {
      parts.forEach((p, i) => mock.enqueue(p.name, p.size, { kind: p.kind }));
      toast('已加入下载队列' + (label ? '：' + label : '') + '，请到下载页查看');
    },
    pause(id) { const t = find(id); if (t) { t.status = 'paused'; render(); } },
    resume(id) { const t = find(id); if (t) { t.status = 'downloading'; render(); } },
    remove(id) { S.x.tasks = S.x.tasks.filter(t => t.id !== id); render(); },
    fail(id, kind) { const t = find(id); if (t) { t.status = 'failed'; t.error = FAIL_TEXT[kind] || '下载失败'; render(); } },

    // 通用进度任务（AI 测试台的"下载/加载/生成"）。入 AI 任务队列（ai-queue 子页展示）。
    startJob(key, label, ms, phases) {
      S.x.jobs[key] = { label, p: 0, phase: (phases && phases[0]) || '' };
      S.x.aiQueue = S.x.aiQueue || [];
      if (!S.x.aiQueue.some(q => q.key === key)) S.x.aiQueue.unshift({ key, title: label || key });
      const step = 200;
      const timer = setInterval(() => {
        const j = S.x.jobs[key];
        if (!j) { clearInterval(timer); return; }
        j.p = Math.min(1, j.p + step / ms);
        if (phases) j.phase = phases[Math.min(phases.length - 1, Math.floor(j.p * phases.length))];
        if (j.p >= 1) { j.done = true; clearInterval(timer); }
        render();
      }, step);
    },
    job(key) { return S.x.jobs[key]; },
    resetJob(key) {
      delete S.x.jobs[key];
      if (S.x.aiQueue) S.x.aiQueue = S.x.aiQueue.filter(q => q.key !== key);
    },
    isJobDone(key) { const j = S.x.jobs[key]; return !!(j && j.done); },
    // 队列项状态：running {p,phase} / done / gone（取消或清除）
    queueState(q) {
      const j = S.x.jobs[q.key];
      if (!j) return 'gone';
      return j.done ? 'done' : 'running';
    },

    // 账户演示数据
    account: {
      devices: [
        { name: '本机（vivo）', last: '当前在线', self: true },
        { name: 'AYANEO Pocket', last: '2 小时前活跃', self: false },
        { name: '工作站 Chrome', last: '3 天前活跃', self: false }
      ],
      grants: [
        { pkg: 'com.demo.kirara', note: '活跃凭证 2 个 · 1 小时前' }
      ]
    }
  };

  function find(id) { return S.x.tasks.find(t => t.id === id); }

  // 下载推进：每 500ms 一拍，速度按"源"略有差异，接近完成时进入校验
  setInterval(() => {
    let changed = false;
    S.x.tasks.forEach(t => {
      if (t.status !== 'downloading') return;
      const speed = t.source === 1 ? 1.6e6 : 2.4e6; // bytes/tick
      if (t.downloaded === 0 && Math.random() < 0.18) { t.source = 2; changed = true; } // 偶发换源
      t.downloaded = Math.min(t.size, t.downloaded + speed * (0.7 + Math.random() * 0.6));
      if (t.size - t.downloaded < speed) { t.status = 'verifying'; changed = true; }
      else changed = true;
    });
    S.x.tasks.forEach(t => {
      if (t.status === 'verifying') {
        t.verifyTick = (t.verifyTick || 0) + 1;
        if (t.verifyTick > 3) { t.status = 'done'; t.downloaded = t.size; changed = true; }
      }
    });
    if (changed) render();
  }, 500);

  // toast：最多堆叠 3 条，超出丢弃最旧
  const TOAST_MAX = 3;
  window.toast = function (text) {
    S.toasts.push({ text, id: Date.now() + Math.random() });
    while (S.toasts.length > TOAST_MAX) S.toasts.shift();
    render();
    setTimeout(() => {
      S.toasts.shift(); render();
    }, 2600);
  };
})();
