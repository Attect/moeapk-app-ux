// 账户相关子页：登录 / 注册 / MK 通行证 / 账号与安全 / 更新检测
// 对应：ui/account/LoginScreen.kt、RegisterScreen.kt、AccountScreen.kt、SecurityScreen.kt、UpdateScreen.kt
(function () {
  // ---------- 登录 ----------
  registerScreen('login', {
    title: '登录 MK 通行证',
    render() {
      const err = S.x.loginErr;
      return '<div class="form-pad">' +
        '<div class="login-mascot">' +
        '<img class="d-only" src="assets/chara-head-hi.webp" alt="安卓娘">' +
        '<img class="n-only" src="assets/chara-head-hi-night.webp" alt="安卓娘"></div>' +
        '<div class="headline">登录 MK 通行证</div>' +
        '<div class="sub">用户名 + 身份验证器动态码登录，无密码、不开放注册。</div>' +
        field({ id: 'login-name', label: '用户名', error: err === 'name' ? '请输入用户名' : '' }) +
        field({ id: 'login-code', label: '动态码', type: 'password', hint: '6 位数字', error: err === 'code' ? '动态码应为 6 位数字' : '', mono: true }) +
        (err === 'bad' ? '<div class="field-err">用户名或动态码不正确</div>' : '') +
        '<div style="margin-top:18px">' + btn(S.x.loginBusy ? '登录中…' : '登录', 'do-login', null, 'block') + '</div>' +
        '<div class="center" style="margin-top:8px">' + textBtn('没有账号？用 MK 码注册', 'go-register') + '</div></div>';
    }
  });
  action('go-register', () => nav.push('register'));
  action('do-login', () => {
    const name = ((S.x.keep || {})['login-name'] || '').trim();
    const code = ((S.x.keep || {})['login-code'] || '').trim();
    if (!name) { S.x.loginErr = 'name'; return render(); }
    if (!/^\d{6}$/.test(code)) { S.x.loginErr = 'code'; return render(); }
    S.x.loginBusy = true; S.x.loginErr = null; render();
    setTimeout(() => {
      S.x.loginBusy = false;
      if (code === '000000') { S.x.loginErr = 'bad'; return render(); }
      S.loggedIn = true; S.user = { name, id: 1024 };
      S.stack = []; toast('已登录：' + name); render();
    }, 900);
  });

  // ---------- 注册（两步向导） ----------
  registerScreen('register', {
    title: '创建 MK 通行证',
    render() {
      const s = S.x.reg = S.x.reg || { step: 1 };
      let h = '<div class="form-pad"><div class="headline">创建 MK 通行证</div>' +
        '<div class="sub">使用 MK 码注册账号，无密码、无邮箱。</div>';
      if (s.step === 1) {
        h += field({ id: 'reg-mk', label: 'MK 码', hint: 'MK-XXXX-XXXX-XXXX', mono: true, value: s.mk });
        h += field({ id: 'reg-name', label: '用户名', value: s.name });
        if (s.err) h += '<div class="field-err">' + esc(s.err) + '</div>';
        h += '<div style="margin-top:18px">' + btn('下一步', 'reg-next', null, 'block') + '</div>';
      } else {
        h += card('<div class="li-title">把密钥添加到身份验证器</div>' +
          '<div class="mono-block">' + esc(s.secret || 'JBSWY3DPEHPK3PXP') + '</div>' +
          '<div style="display:flex;gap:8px;align-items:center">' + btn(s.copied ? '已复制' : '复制密钥', 'reg-copy', null, 'small ghost') + '</div>' +
          '<div class="warn-card">密钥只显示这一次，请立即保存到身份验证器（如 Aegis、Bitwarden）。丢失密钥将无法找回账号。</div>');
        h += field({ id: 'reg-code', label: '动态码', hint: '输入身份验证器上的 6 位数字', mono: true });
        if (s.err) h += '<div class="field-err">' + esc(s.err) + '</div>';
        h += '<div class="msg-row" style="margin-top:18px">' + btn('上一步', 'reg-prev', null, 'ghost') +
          btn('完成注册并登录', 'reg-finish', null, '') + '</div>';
      }
      return h + '</div>';
    }
  });
  action('reg-next', () => {
    const s = S.x.reg;
    s.mk = ((S.x.keep || {})['reg-mk'] || '').toUpperCase();
    s.name = ((S.x.keep || {})['reg-name'] || '').trim();
    if (!/^MK-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(s.mk)) { s.err = 'MK 码格式不正确'; return render(); }
    if (!s.name) { s.err = '请输入用户名'; return render(); }
    s.err = null; s.step = 2; s.secret = 'JBSW Y3DP EHPK 3PXP'.replace(/\s/g, '');
    render();
  });
  action('reg-prev', () => { S.x.reg.step = 1; render(); });
  action('reg-copy', () => { S.x.reg.copied = true; toast('密钥已复制'); render(); });
  action('reg-finish', () => {
    const s = S.x.reg;
    const code = ((S.x.keep || {})['reg-code'] || '').trim();
    if (!/^\d{6}$/.test(code)) { s.err = '请输入 6 位动态码'; return render(); }
    s.err = null;
    S.loggedIn = true; S.user = { name: s.name, id: 1025 };
    S.stack = []; toast('注册成功，已自动登录'); render();
  });

  // ---------- MK 通行证 ----------
  registerScreen('account', {
    title: 'MK 通行证',
    render() {
      if (!S.loggedIn || !S.user) {
        return emptyHint('登录状态已失效') + '<div style="text-align:center">' + btn('返回', 'back-mine', null, 'ghost') + '</div>';
      }
      const acc = mock.account;
      let h = card('<div style="display:flex;align-items:center;gap:14px"><span style="color:var(--on-surface-variant)">' + icon('account_circle') + '</span>' +
        '<div><div class="li-title">' + esc(S.user.name) + '</div><div class="li-sub">MK 通行证 #' + S.user.id + '</div></div></div>');
      h += sectionTitle('安全');
      h += card(listItem({ icon: 'password', title: '动态码密钥', sub: '疑似泄露时可更换', arrow: true, action: 'go-security' }), 'tight');
      h += sectionTitle('已登录设备');
      let dev = '<div class="card tight" style="padding:0;margin-top:0">' + acc.devices.map((d, i) =>
        '<div class="li"><div class="li-icon">' + icon('devices') + '</div><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(d.name) + '</div>' +
        '<div class="li-sub">' + esc(d.last) + '</div></div>' +
        (d.self ? '<span class="badge soft">本机</span>' : '<button class="icbtn" data-a="acc-kick" data-arg="' + i + '">' + icon('close') + '</button>') + '</div>' +
        (i < acc.devices.length - 1 ? '<div class="hr"></div>' : '')).join('') + '</div>';
      const others = acc.devices.filter(d => !d.self);
      if (others.length) dev += '<div style="padding:10px 12px 12px">' + btn('下线其它设备', 'acc-kick-all', null, 'ghost') + '</div>';
      h += card(dev);
      h += sectionTitle('已授权应用');
      if (acc.grants.length) {
        h += card('<div class="card tight" style="padding:0;margin-top:0">' + acc.grants.map((g, i) =>
          '<div class="li"><div class="li-icon">' + icon('verified') + '</div><div class="li-body"><div class="li-title" style="font-weight:400">' + esc(g.pkg) + '</div>' +
          '<div class="li-sub">' + esc(g.note) + '</div></div>' +
          '<button class="icbtn" data-a="acc-revoke" data-arg="' + i + '">' + icon('close') + '</button></div>').join('') + '</div>');
      } else {
        h += card('<div class="muted center" style="padding:14px">暂无已授权应用</div>');
      }
      h += '<div style="margin-top:16px">' + btn('退出登录', 'acc-logout', null, 'block danger') + '</div>';
      return h;
    }
  });
  action('back-mine', () => { S.stack = []; render(); });
  action('go-security', () => nav.push('security'));
  action('acc-kick', ds => confirmDialog('下线该设备', '该设备将立即退出登录。', '下线', () => {
    mock.account.devices.splice(+ds.arg, 1); render();
  }, true));
  action('acc-kick-all', () => confirmDialog('下线其它设备', '除本机外，所有已登录设备将立即退出。', '全部下线', () => {
    mock.account.devices = mock.account.devices.filter(d => d.self); render();
  }, true));
  action('acc-revoke', ds => confirmDialog('吊销应用授权', '该应用将立即失去通行证能力。', '吊销', () => {
    mock.account.grants.splice(+ds.arg, 1); render();
  }, true));
  action('acc-logout', () => confirmDialog('退出登录', '退出后需要重新输入动态码登录。', '退出登录', () => {
    S.loggedIn = false; S.user = null; S.stack = []; render();
  }, true));

  // ---------- 账号与安全（TOTP 换钥三步向导） ----------
  registerScreen('security', {
    title: '动态码密钥',
    render() {
      const s = S.x.sec = S.x.sec || { step: 1 };
      let h = '<div class="form-pad"><div class="headline">动态码密钥</div>';
      if (s.step === 1) {
        h += '<div class="sub">用于登录与敏感操作的 6 位动态码由身份验证器生成。若怀疑密钥泄露，可在此更换。</div>' +
          '<div class="warn-card">更换后：旧密钥立即作废，其它已登录设备将全部下线，请确认所有设备都能重新登录。</div>' +
          field({ id: 'sec-code', label: '当前动态码', mono: true, hint: '验证身份后才能更换' });
        if (s.err) h += '<div class="field-err">' + esc(s.err) + '</div>';
        h += '<div style="margin-top:18px">' + btn('生成新密钥', 'sec-gen', null, 'block') + '</div>';
      } else if (s.step === 2) {
        h += card('<div class="li-title">新密钥</div>' +
          '<div class="mono-block">' + esc(s.secret || 'KRSXG5DSN5ZGO3TFOJ4Q====') + '</div>' +
          '<div>' + btn(s.copied ? '已复制' : '复制密钥', 'sec-copy', null, 'small ghost') + '</div>' +
          '<div class="warn-card">密钥只显示这一次。旧密钥在你确认更换后才作废，确认前请先把新密钥加入身份验证器并确认能生成动态码。</div>');
        h += field({ id: 'sec-newcode', label: '新密钥的动态码', mono: true });
        if (s.err) h += '<div class="field-err">' + esc(s.err) + '</div>';
        h += '<div class="msg-row" style="margin-top:18px">' + btn('重新开始', 'sec-restart', null, 'ghost') +
          btn('确认更换', 'sec-confirm', null, '') + '</div>';
      } else {
        h += card('<div style="display:flex;align-items:center;gap:10px"><span style="color:var(--primary)">' + icon('check') + '</span>' +
          '<div class="li-title">密钥已更换</div></div>' +
          '<div class="sub">旧密钥已作废，其它设备已全部下线。</div>');
        h += '<div style="margin-top:18px">' + btn('完成', 'sec-done', null, 'block') + '</div>';
      }
      return h + '</div>';
    }
  });
  action('sec-gen', () => {
    const code = ((S.x.keep || {})['sec-code'] || '').trim();
    if (!/^\d{6}$/.test(code)) { S.x.sec.err = '请输入当前 6 位动态码'; return render(); }
    S.x.sec.err = null; S.x.sec.step = 2; S.x.sec.secret = 'KRSXG5DSN5ZGO3TFOJ4Q====';
    render();
  });
  action('sec-copy', () => { S.x.sec.copied = true; toast('密钥已复制'); render(); });
  action('sec-restart', () => { S.x.sec = { step: 1 }; render(); });
  action('sec-confirm', () => {
    const code = ((S.x.keep || {})['sec-newcode'] || '').trim();
    if (!/^\d{6}$/.test(code)) { S.x.sec.err = '请输入新密钥的 6 位动态码'; return render(); }
    S.x.sec.err = null; S.x.sec.step = 3;
    mock.account.devices = mock.account.devices.filter(d => d.self); // 其它设备全部下线
    render();
  });
  action('sec-done', () => { S.x.sec = null; nav.pop(); });

  // ---------- 更新检测 ----------
  registerScreen('update', {
    title: '更新检测',
    render() {
      let h = card('<div class="dl-row"><div style="flex:1"><div class="li-title">当前版本 0.10.3（30）</div></div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        (DB.UPDATES.length > 1 ? btn('全部更新', 'upd-all', null, 'small') : '') +
        btn('重新检测', 'upd-check', null, 'small ghost') + '</div></div>');
      if (S.x.updChecking) return h + spinner();
      if (!DB.UPDATES.length) return h + emptyHint('全部应用已是最新版本');
      h += DB.UPDATES.map(u => {
        const c = DB.CATALOG.find(i => i.id === u.id);
        const j = mock.job('upd-dl-' + u.id);
        const done = j && j.done;
        let action;
        if (done) action = btn('安装更新', 'upd-install', u.id, 'small');
        else if (j) action = '<div style="min-width:110px">' + progress(j.p) + '</div>';
        else action = btn('下载更新', 'upd-dl', u.id, 'small');
        return card('<div class="dl-row"><div style="flex:1"><div class="li-title" style="font-weight:400">' + esc(c ? c.title : u.id) + '</div>' +
          '<div class="dl-status">新版本 v' + u.version + '（' + u.version_code + '）· ' + fmtSize(u.size) + '</div></div>' +
          (u.force ? '<span class="badge">必须更新</span>' : '') + '</div>' +
          (u.force && u.id === 'moeapk-service' ? '<div class="li-sub" style="margin-top:4px">必须更新，安装后方可继续使用</div>' : '') +
          '<ul class="changes muted" style="font-size:13px">' + u.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' +
          '<div style="margin-top:8px;display:flex;align-items:center;gap:8px">' + action +
          (j && !done ? textBtn('取消', 'upd-cancel', u.id) : '') + '</div>');
      }).join('');
      return h;
    }
  });
  action('upd-check', () => { S.x.updChecking = true; render(); setTimeout(() => { S.x.updChecking = false; render(); }, 800); });
  action('upd-all', () => { DB.UPDATES.forEach((u, i) => { if (!mock.job('upd-dl-' + u.id)) setTimeout(() => mock.startJob('upd-dl-' + u.id, '下载中', 3000, ['源 1', '校验']), i * 400); }); render(); });
  action('upd-dl', ds => mock.startJob('upd-dl-' + ds.arg, '下载中', 3000, ['源 1', '校验']));
  action('upd-cancel', ds => { mock.resetJob('upd-dl-' + ds.arg); render(); });
  action('upd-install', ds => {
    const u = DB.UPDATES.find(x => x.id === ds.arg);
    if (u && u.force) {
      showDialog({
        title: '必须更新', sticky: true,
        body: '当前版本已停止服务，请更新到 v' + u.version + '后继续。',
        actions: [{ label: '安装更新', style: 'filled', run: () => toast('调起系统安装器（模拟）') }]
      });
    } else toast('调起系统安装器（模拟）');
  });
})();
