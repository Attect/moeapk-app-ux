// 运行：node --test tests/ai-diffusion-device-status.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const screen = read('js/screens/ai-diffusion.js');
const css = read('css/app.css');

test('设备状态只进入正在生成的结果步，并展示温度、四项负载与电量', () => {
  const running = screen.match(/if \(j && !j\.done\) \{([\s\S]*?)\n    \}\n    const r = currentResult\(\);/);
  assert.ok(running, '必须保留生成中分支');
  assert.match(running[1], /deviceMetrics\(d, j\)/);
  assert.match(running[1], /deviceStatusHtml\(device\)/);
  assert.match(running[1], /diff-generating-layout/);
  const finished = screen.slice(screen.indexOf('const r = currentResult();', screen.indexOf('function resultStep')));
  assert.ok(!finished.includes('deviceStatusHtml(device)'), '完成结果不继续显示生成中设备面板');
  for (const label of ['设备温度', 'CPU', 'GPU', 'NPU', '内存', '运行内存', '充电中', '未充电']) {
    assert.ok(screen.includes(label), label);
  }
  assert.match(screen, /lowBattery: base\.battery < 50 && !base\.charging/);
  assert.match(screen, /warming: base\.tempTrend > 0/);
});

test('升温与低电量建议可同时出现，文案明确且不冒充系统错误', () => {
  assert.ok(screen.includes('建议摘下手机保护壳，或安装散热器。'));
  assert.ok(screen.includes('建议连接充电器电源，避免生成中断。'));
  assert.ok(screen.includes('if (m.warming)'));
  assert.ok(screen.includes('if (m.lowBattery)'));
  const thermal = screen.match(/if \(m\.warming\) h \+= '([^']+)'/);
  const battery = screen.match(/if \(m\.lowBattery\) h \+= '([^']+)'/);
  assert.ok(thermal && thermal[1].includes('diff-device-advice thermal'));
  assert.ok(battery && battery[1].includes('diff-device-advice battery'));
  assert.ok(!thermal[1].includes('err-card') && !battery[1].includes('err-card'));
});

test('温度环、负载条与提醒使用设计令牌，明暗和宽窄屏均有适配', () => {
  assert.match(css, /--warning:\s*#A96F16/);
  assert.match(css, /\[data-theme="dark"]\s*\{[\s\S]*?--warning:\s*#F2C078/);
  assert.match(css, /\.diff-temp-ring\s*\{[^}]*conic-gradient\(var\(--c-mint\)/s);
  assert.match(css, /\.diff-temp-ring\.warming\s*\{[^}]*var\(--warning\)/s);
  assert.match(css, /\.diff-load-grid\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.diff-device-advice\s*\{[^}]*background:\s*var\(--warning-container\)/s);
  assert.match(css, /@container \(min-width: 720px\)\s*\{[\s\S]*?\.diff-generating-layout\s*\{[^}]*grid-template-columns/s);
  assert.match(css, /@container \(max-width: 380px\)\s*\{[\s\S]*?\.diff-temp-ring\s*\{\s*width:\s*72px/s);
});

test('进度刷新保留步骤滚动位置，尺寸切换先对齐当前步骤', () => {
  assert.match(screen, /const stepScroll = activeJob && !activeJob\.done/);
  assert.match(screen, /el\.scrollTop = stepScroll\[i\] \|\| 0/);
  assert.match(screen, /window\.addEventListener\('resize', \(\) => \{\s*if \(!document\.getElementById\('diff-pager'\)\) return;\s*clearTimeout\(pagerScrollTimer\);\s*syncWizardPager\(false\);/);
  const icons = read('js/icons.js');
  for (const name of ['device_thermostat', 'battery_full', 'battery_charging_full', 'trending_up']) {
    assert.match(icons, new RegExp(name + ":"));
  }
});
