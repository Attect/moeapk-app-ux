# MoeApk App Web 原型

MoeApk App（`../app`，当前 0.9.5/26）UX 的 1:1 Web 还原。**UX 调整先在这里改、验证，再同步到 Compose。**

## 起法

- 直接双击 `index.html`（数据内嵌为 JS，file:// 可用）；
- 或 `run.cmd`（python http.server 8095）后访问 <http://127.0.0.1:8095>。
- 桌面浏览器显示手机框；开发者工具切移动视图或直接窄窗口即全屏。
- 右上角"明/暗"切换主题（App 侧跟随系统，无手动开关；原型提供切换仅便于对比验证）。
- URL hash 与导航同步（`#apk`、`#apk/catalog-detail/moeapk-service`），可直接直达某屏，浏览器前进/后退可用。

## 工作约定

1. **改 UX 只改本目录**，走查满意后再把同样的结构调整落到 `app/src/main/java/com/moeapk/ui/` 的 Compose 代码。
2. 页面 ↔ Compose 源文件对照表见下；新增页面两边同步新增。
3. 页面状态放 `S.x.<key>`（易失）或 `S`（全局：登录态、设置项）；跨页跳转用 `nav.push/pop/goTab`，模拟 Compose 侧 UiBus 的跳转（如壁纸→AI 放大）在 `js/screens/pages-misc.js` 的 `wp-upscale`。
4. 下载/生成等长流程用 `mock.startJob(key, label, ms, phases)`，真实下载队列在 `js/mock.js`。
5. 数据更新：改 `website/mukaapp_moeapk/site_moeapk` 后跑 `powershell -File tools/extract-data.ps1`（注意脚本会覆盖演示数据，需手工合并回 demo 项）。
6. 本目录是纯静态文件，不进 Gradle 构建；随 app 仓提交。

## 页面 ↔ Compose 对照表

| 原型 | Compose 源 |
|---|---|
| `js/screens/apk.js`（tab:apk + 详情） | `ui/apk/ApkScreen.kt`、`ApkHomeScreen.kt`、`CatalogScreens.kt`、`OpenScreens.kt` |
| `js/screens/ai.js`（tab:ai） | `ui/ai/AiScreen.kt`、`LlmBench.kt`、`DiffusionBench.kt`、`TtsBench.kt`、`UpscaleBench.kt` |
| `js/screens/ai.js`（models / model-search） | `ui/ai/ModelHubScreen.kt`、`ModelSearchScreen.kt` |
| `js/screens/download.js` | `ui/download/DownloadScreen.kt` |
| `js/screens/mine.js` | `ui/mine/MineScreen.kt` |
| `js/screens/pages-account.js`（login/register/account/security） | `ui/account/LoginScreen.kt`、`RegisterScreen.kt`、`AccountScreen.kt`、`SecurityScreen.kt` |
| `js/screens/pages-account.js`（update） | `ui/about/UpdateScreen.kt` |
| `js/screens/pages-misc.js`（about） | `ui/about/AboutScreen.kt` |
| `js/screens/pages-misc.js`（wallpaper / pointcloud-preview） | `ui/wallpaper/WallpaperCenterScreen.kt`、`PointCloudPreviewScreen.kt` |
| `js/store.js`（导航栈/Tab） | `ui/AppRoot.kt`（MainTab/SubPage/Crossfade） |
| `js/mock.js`（下载队列/任务进度） | `:download` DownloadManager |
| `js/ui.js`（组件库/渲染） | 各 M3 组件 + 本仓 EntryCard/SectionColumn 等私有组件 |
| `css/app.css`（设计令牌） | `ui/theme/Theme.kt`（dynamic color，fallback 种子 #E8A562） |

## 与真机的刻意差异（原型简化）

- 动态取色不可还原，统一用 fallback 种子色 #E8A562（+M3 baseline 其余角色）。
- 开源条目图标用首字占位图（原型离线，不请求网络图标）。
- 下拉刷新为"点击模拟"链接；点云预览用 CSS 粒子舞台代替 GL 渲染。
- AI 对话/生图/语音结果均为模拟数据，用于验证布局与流程，不验证模型效果。
