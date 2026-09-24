# AGENTS.md — 给 AI 编码工具的项目说明书

本文件面向 AI 编码 Agent（DeepSeek Harness、KimiCode、OpenCode、MimoCode、WorkBuddy、Qoder 等），描述这个仓库的架构、技术约定与禁区。**改动前请完整阅读**；人类贡献者的流程说明见 README.md 与 CONTRIBUTING.md。

## 这是什么

MoeApk App（Android）的 UX 设计原型：**纯静态 HTML/CSS/JS，零依赖、零构建**，对 App 界面与交互做 1:1 还原。所有 UX 变更先在本仓库验证，被采纳后由维护者同步到正式 App（Compose，私有项目，你接触不到也不需要接触）。

## 运行与验证

- **运行**：直接用浏览器打开 `index.html`（`file://` 协议可用，所有数据内嵌为 JS 全局变量，不发起网络请求）；或 `run.cmd`（python http.server 8095）。
- **验证（每次改动必须做）**：
  1. 明/暗主题各走查一遍（页面右上角切换）；
  2. 竖屏 + 横屏（右上角"横屏"，1024×680）各走查一遍；
  3. 桌面窄窗口（移动视图）确认布局；
  4. 确认 `file://` 直接打开一切正常（无网络依赖报错）。

## 架构地图

| 文件 | 职责 |
|---|---|
| `index.html` | 入口：proto-bar 调试条 + `.phone` 预览框 + 按序加载全部 js/css。**所有资源引用带 `?v=N` 版本号** |
| `css/app.css` | 全部样式与**设计令牌**（CSS 变量：颜色/圆角/间距/阴影）；明/暗双套变量；横屏断点（容器查询） |
| `js/store.js` | 全局状态 `S`（登录态/设置等持久项）与 `S.x`（页面级易失状态）；导航栈 `nav.push/pop/goTab`，URL hash 同步 |
| `js/ui.js` | 组件库与渲染核心；`registerScreen(id, opts)` 注册页面/子页并自动收集 `SUB_PAGES`；`full: true` 选项 = 无顶栏全屏页 |
| `js/mock.js` | 模拟层：`mock.startJob(key, label, ms, phases)` 长任务（下载/生成）、toast 与撤销、网络状态模拟 |
| `js/theme.js` | 明/暗主题切换 |
| `js/icons.js` | 内联 SVG 图标库（`icon('name')`） |
| `js/screens/*.js` | 各页面实现，一个文件一个（组）页面 |
| `js/data/*.js` | 演示数据（catalog 应用目录 / open 开源收录 / ai 模型），内嵌为全局变量 |
| `shots/` | 走查截图留档，勿删改（新增截图除外） |

页面与正式 App 实现的对应关系、完整设计沿革见 `docs/design-notes.md`。

## 技术约定（改动必须遵守）

1. **纯静态、零依赖、零构建**：不引入任何框架（React/Vue/Tailwind…）、包管理器（npm）、构建步骤、CDN 外链。只允许原生 HTML/CSS/JS。
2. **`file://` 必须可用**：不 `fetch`、不 `import`（ES module 在 file:// 下会被 CORS 拦），数据一律内嵌为 JS 全局变量（参照 `js/data/`）。
3. **状态管理**：页面级易失状态放 `S.x.<key>`；全局状态（登录态、设置项）放 `S`。不自创状态机制。
4. **导航**：跨页跳转用 `nav.push/pop/goTab`；新子页用 `registerScreen` 注册（自动收集，无需手工维护清单）。
5. **长流程**：下载/生成/处理类耗时操作一律用 `mock.startJob(key, label, ms, phases)`，自动进入 AI 任务队列与下载页。
6. **样式**：颜色/圆角/间距优先使用 `css/app.css` 的设计令牌变量，不写死新色值；明暗两套主题都要适配（在暗色变量组同步定义）。
7. **横屏适配**：遵循既有断点（容器宽 <720 竖屏 / ≥720 NavigationRail / ≥920 双栏 master-detail），新页面默认在三种宽度下都可用。
8. **`?v=N` 递增**：改了任何 js/css，把 `index.html` 里**所有**资源的 `?v=N` 一并递增（防缓存）。
9. **图标**：用 `js/icons.js` 的 `icon()`；新增图标保持同风格（线性 SVG）。
10. **提交信息**：中文，格式 `<类型>: <简述>`，类型如 `原型:` `功能:` `修复:` `调整:` `文档:`。
11. **原型版本常量**（仅维护者）：`js/screens/about.js` 顶部的 `PROTO_COMMIT` / `PROTO_DATE` 记录原型自身的 git 提交，**每次提交前更新为当前 HEAD**（即页面展示值恒为最近一次提交）。贡献者无需处理。

## 禁区（违反的 PR 一律拒绝）

- 引入框架、构建工具、包管理器、外部 CDN/字体/图片链接；
- 改为需要构建的项目形态（webpack/vite/任何打包器）；
- 破坏 `file://` 直开；
- 修改或删除 `assets/` 中的品牌素材（logo、MoeApk 字体）——它们不适用 MIT 许可（见 LICENSE）；
- 在原型中请求真实网络接口（一切数据用 `js/data/` 的演示数据）；
- 改动与 PR 描述不符的无关文件。

## 走查清单（提交前自查）

- [ ] 明/暗主题均正常
- [ ] 竖屏/横屏（≥720、≥920）均正常
- [ ] `file://` 直开无报错
- [ ] 未引入任何依赖与网络请求
- [ ] `index.html` 的 `?v=N` 已递增
- [ ] 涉及页面跳转的，`nav` 栈与 URL hash 行为正常（前进/后退可用）
