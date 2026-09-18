# MoeApk App Web 原型

MoeApk App（`../app`，当前 0.9.5/26）UX 的 1:1 Web 还原。**UX 调整先在这里改、验证，再同步到 Compose。**

## 起法

- 直接双击 `index.html`（数据内嵌为 JS，file:// 可用）；
- 或 `run.cmd`（python http.server 8095）后访问 <http://127.0.0.1:8095>。
- 桌面浏览器显示手机框；开发者工具切移动视图或直接窄窗口即全屏。
- 右上角"明/暗"切换主题（App 侧跟随系统，无手动开关；原型提供切换仅便于对比验证）。
- 右上角"横屏"把预览框切为横屏（1024×680，localStorage 记忆），用于验证横屏/平板布局；也可用 `?frame=land / ?frame=port` 直达。
- URL hash 与导航同步（`#apk`、`#apk/catalog-detail/moeapk-service`），可直接直达某屏，浏览器前进/后退可用。

## 工作约定

1. **改 UX 只改本目录**，走查满意后再把同样的结构调整落到 `app/src/main/java/com/moeapk/ui/` 的 Compose 代码。
2. 页面 ↔ Compose 源文件对照表见下；新增页面两边同步新增。
3. 页面状态放 `S.x.<key>`（易失）或 `S`（全局：登录态、设置项）；跨页跳转用 `nav.push/pop/goTab`；子页 id 由 `ui.js` 的 `registerScreen` 自动收集进 `SUB_PAGES`（无需再手工维护数组）；模拟壁纸→AI 放大的跳转在 `js/screens/wallpaper-dialog.js` 的 `wp-parallax-set`。
4. 下载/生成等长流程用 `mock.startJob(key, label, ms, phases)`，真实下载队列在 `js/mock.js`。
5. 数据更新：改 `website/mukaapp_moeapk/site_moeapk` 后跑 `powershell -File tools/extract-data.ps1`（注意脚本会覆盖演示数据，需手工合并回 demo 项）。
6. 本目录是纯静态文件，不进 Gradle 构建；随 app 仓提交。
7. 改 js/css 后把 `index.html` 里所有 `?v=N` 一并递增（防 python http.server 启发式缓存导致浏览器用旧文件）。

## 页面 ↔ Compose 对照表

| 原型 | Compose 源 |
|---|---|
| `js/screens/apk.js`（tab:apk + 详情 + favorites 收藏子页） | `ui/apk/ApkScreen.kt`、`ApkHomeScreen.kt`、`CatalogScreens.kt`、`OpenScreens.kt`、`ApkRepo.kt`；收藏 `ui/favorites/FavoritesScreen.kt` + `FavoriteRepo.kt` + `:core FavoritesPref` |
| `js/screens/assets.js`（tab:assets 素材网格 + asset 查看器） | `ui/assets/AssetsScreen.kt`、`AssetViewerScreen.kt`、`AssetDialogs.kt`、`AssetOps.kt` + `:assets`（`AssetStore`/`AssetImporter`/`AssetThumbnails`/`AssetMigrator`） |
| `js/screens/ai.js`（tab:ai 入口枢纽 + ai-queue 任务队列子页） | `ui/ai/AiHubScreen.kt`、`AiQueueScreen.kt` + `:ai InferenceHub`/`InferenceQueue` |
| `js/screens/ai-llm.js`（llm / llm-config 子页） | `ui/ai/LlmScreen.kt`、`LlmConfigScreen.kt` |
| `js/screens/ai-diffusion.js`（diffusion / diff-config 子页） | `ui/ai/DiffusionScreen.kt`、`DiffConfigScreen.kt` |
| `js/screens/ai-tts.js`（tts / tts-voices 子页） | `ui/ai/TtsScreen.kt`、`TtsVoicesScreen.kt` |
| `js/screens/ai-models.js`（models / model-search） | `ui/ai/ModelHubScreen.kt`、`ModelSearchScreen.kt` |
| `js/screens/download.js`（downloads 子页） | `ui/download/DownloadScreen.kt`（入口在 我的 → 下载任务） |
| `js/screens/mine.js` | `ui/mine/MineScreen.kt` |
| `js/screens/pages-account.js`（login/register） | `ui/login/LoginScreen.kt`、`RegisterScreen.kt` |
| `js/screens/pages-account.js`（account/security） | `ui/account/AccountScreen.kt`、`SecurityScreen.kt` |
| `js/screens/pages-account.js`（update） | `ui/about/UpdateScreen.kt` |
| `js/screens/about.js` | `ui/about/AboutScreen.kt` |
| `js/screens/wallpaper-dialog.js`（壁纸对话框） | `ui/assets/AssetDialogs.kt`（设桌面/锁屏/双设、动态壁纸）、`ui/wallpaper/PointCloudPreviewScreen.kt`（点云预览/取景） |
| `js/store.js`（导航栈/Tab） | `ui/AppRoot.kt`（MainTab + `NavEntry` 参数栈）、`ui/UiBus.kt`（通用跳转） |
| `js/mock.js`（下载队列/任务进度/AI 任务队列/toast 撤销动作/网络模拟） | `:download` DownloadManager；AI 任务队列 `:ai InferenceQueue` + `InferenceHub`；toast/撤销 `ui/UiFeedback.kt` |
| `js/ui.js`（组件库/渲染 + registerScreen 子页自动收集 + 回顶/引导/输入聚焦） | `ui/CommonUi.kt`（`ScrollToTopBox`/`SkeletonBox`/`EmptyState`/`OnboardingTip`/`bringIntoViewOnFocus`）+ 各 M3 组件 |
| `css/app.css`（设计令牌） | `ui/theme/Theme.kt`（dynamic color；fallback 种子 #E8A562、`onPrimary` #FFF3E6；0.22s 明暗颜色过渡） |

> **App 侧对齐状态（2026-09-18）**：本表所列全部页面已按原型落到 Compose（四批次：壳层/素材/AI/APK + 主题过渡），过程与逐项差异记录见 `docs/prototype-alignment/00-overview.md`～`d-apk-and-server.md`。原型仍是 UX 的唯一变更入口（见「工作约定」第 1 条）。

## 当前设计（2026-09-18 三轮调整）

### 素材查看器（沉浸式全屏）

素材查看器（asset 子页）为**无顶栏全屏界面**：`registerScreen` 的 `full: true` 选项不渲染 TopAppBar（Compose 侧对应全屏 Dialog / immersive viewer），返回用左上角悬浮键（Esc / 安卓返回键同样生效），顶部悬浮序号，底部按类型变化的工具栏；全屏时 proto-bar 调试条自动隐藏。

### 横屏 / 平板适配（App 侧对应 WindowSizeClass + NavigationSuiteScaffold + ListDetailPaneScaffold）

断点以 `.phone` 容器宽为准（CSS 容器查询 + JS `isRail()/isWide()` 同阈值，真机旋转/窗口变化自动重渲染）：

| 容器宽 | 形态 | 布局 |
|---|---|---|
| <720 | 竖屏手机 | 现状：NavigationBar 底栏、单列、历史用 overlay 抽屉 |
| ≥720 | 横屏手机 / 小平板 | 底栏变 **NavigationRail 左栏**（84px），内容右移；其余同竖屏 |
| ≥920 | 平板横屏 / 桌面全屏 | Rail + **双栏 master-detail** + 多列网格 |

≥920 具体规则：
- **LLM 对话 / 图片生成 / 语音生成**：会话列表 / 生成历史 / 合成历史常驻左栏（300px，含搜索、新建、设置入口），右栏对话区与输入区；输入区限宽 640 居中。窄屏的 overlay 抽屉保留（同一 `drawerListHtml/diffHistHtml/ttsHistHtml` 主体复用）。
- **APK 首页与应用/游戏/开源列表**：卡片两列（`.two-col`，`sectionColumn` 统一包装）。
- **AI 枢纽**：任务队列全宽，四个入口 2×2（`.ai-grid`）。
- **素材**：网格 `auto-fill minmax(150px,1fr)` 自适应列数；排序/视图工具行不变。
- 未改动的页（我的/下载/关于等）：Rail 下自然右移，维持单列阅读宽度。

### 第三轮（功能/交互补全，F1–F14 + I1–I8）

- **F1** 应用/游戏/开源列表带搜索框（名称/简介/标签）+ 标签筛选 chips；收藏条目置顶。
- **F2** 首页更新卡多应用感知（"发现 N 个应用可更新：A、B 等"）；更新检测页多更新时加"全部更新"（逐个错峰启动）。
- **F3** 下载完成 → "安装"（模拟调起系统安装器）；含 OBB 数据包的条目在详情页与任务卡给出放置说明。
- **F4** 应用/开源详情页右上角 ♡ 收藏；「我的 → 我的收藏」集中查看（空态导流）。
- **F5** 素材页排序（时间/名称）+ 网格/列表视图切换。
- **F6** 素材长按（500ms）或工具键进入多选，支持批量导入/批量删除。
- **F7** 素材查看器各类型工具栏加"详情"（尺寸/大小/路径/来源元信息面板）。
- **F8** LLM 对话：AI 末条 → 复制 / 重新生成；用户末条 → 编辑并重新发送（回填输入框）。
- **F9** 生图支持负向提示词（可折叠）与批量张数（×1/×2/×4，种子递增），历史记录可见负向词。
- **F10** 生图/合成记录抽屉内可搜索；AI 存素材的条目带来源标记，详情面板显示。
- **F11** 模型中心存储占用卡（总量/进度/清理未使用模型，撤销可用），模型列表按时间/大小排序。
- **F12** TTS 输入区实时字数与预计时长（按 4.2 字/秒估算）。
- **F13** 下载页"仅 Wi-Fi 下载"开关 + [debug] 模拟 Wi-Fi/蜂窝切换：蜂窝下自动暂停、回 Wi-Fi 自动恢复。
- **F14** 「我的」下载分区显示各节点延迟与可达状态（绿<100ms / 黄 / 红不可达）。
- **I1** 各 Tab 首次进入显示一次性轻引导横幅，点"知道了"或切走消失。
- **I2** 删除分级：轻删（下载任务/素材/生成记录/合成记录/收藏取消）→ toast + 撤销按钮；
  重删（模型文件）→ 保留二次确认弹窗；批量清理模型仍弹窗但完成后给撤销。
- **I3** 长列表滚动 >480px 出现回顶 FAB；分区标题吸顶。
- **I4** 模型搜索中转态为骨架屏（筛选器原地保留，不再整页闪白）。
- **I5** 下载页/AI 队列空态加"去逛逛"导流按钮。
- **I6** 素材查看器支持左右滑动切换（touch swipe）。
- **I7** 输入框聚焦自动滚入视野（软键盘场景兜底）。
- **I8** 明/暗主题切换带 0.22s 颜色过渡动画。
- 新增子页 `favorites`（我的收藏），已登记进对照表。

### 第二轮（布局/文案修正）

1. LLM 长文本消息换行问题（msg 白空间 pre-wrap）、发送键被挤压。
2. AI 抽屉标题文案统一为"对话历史 / 生成历史 / 合成记录"。
3. 关于页授权协议展开箭头方向反转（expand_less）。
4. 壁纸设置项行内展开改为独立对话框。
5. 素材网格外边距与查看器返回键布局修正。

### 第一轮（结构调整）

### 导航

1. 底部导航四 Tab：**APK / 素材 / AI / 我的**。原"下载"Tab 并入"我的 → 下载任务"（downloads 子页）。

### 素材

2. **素材 Tab**：网格列表，首格"导入素材"（模拟系统文件选择器）。素材类型：图片 / 视频 / 音频 / **3D 点云**（点云是图片的处理产物，作为一等素材）。
3. **素材查看器**（相册式，asset 子页）：左右切换浏览（序号含类型标签）、按类型变化的底部工具栏：
   - 图片：设为壁纸 / 分享 / AI 放大 / AI 扩图 / 3D 点云处理
   - 视频：设为壁纸（视频壁纸对话框）/ 分享 / 删除
   - 音频：波形舞台 + 播放，分享 / 删除
   - 点云：点云舞台 + 设为壁纸 / 分享 / 控制面板 / 删除
4. **耗时处理**在工具栏上方出现进度条：步骤、百分比、取消。完成去向：放大→存相册；扩图→存为新图片素材；
   **点云→存为点云素材并直接切到结果查看**。
5. **点云查看**：姿态感应（俯仰/左右倾斜滑杆演示 + 自动摇摆模拟陀螺仪）、查看方式（强度/缩放）、
   渲染性能（点云精度=渲染点数百分比）；控制面板**默认收起**，点舞台右上角齿轮展开。壁纸中心已拆除。

### AI

6. **AI Tab 为入口枢纽**：AI 任务队列 + 模型管理 / LLM 对话 / 图片生成 / 语音生成 四个独立入口条目，
   各自进入独立子页。AI 放大不再单列（在素材查看器对图片操作）。
7. **AI 任务队列**（ai-queue 子页）：所有 `mock.startJob` 的任务自动入队，运行中显示步骤+进度+取消，
   已完成可单个清除或清空；文件下载仍在"我的 → 下载任务"。
8. **LLM 对话**（llm 子页，Agent 化，经典助手布局）：
   - 主区域为对话区；进入即**新对话界面**（空态提示），首条消息自动建会话（标题取首条消息摘要）、
     按所选模型下载/加载，就绪后自动回复。
   - 底部输入区：**模型选择**（chip 点开对话框，新对话态选 modelSel；空会话直接换模型；
     有消息的会话换模型则另起新对话）+ **上下文用量**（token 数/上限 + 占用条，超 80% 变红）+
     图片附件 + 输入框 + 发送。
   - 顶部右侧菜单键打开**侧边抽屉**：会话列表（点按切换、✕ 删除、新建对话），抽屉底部为**推理设置**
     （按当前模型进入 llm-config）。
   - 图片附件仅多模态模型可用（否则系统消息/Toast 提示忽略）；token 估算（字数/2，图片 512），
     接近上限自动压缩（tokens×0.5 + 系统消息）。
   - 推理配置（llm-config 子页）：上下文长度/种子/温度/推理方式 CPU·GPU·NPU/线程数/批大小/KV 缓存量化，
     **按模型独立保存**。
9. **图片生成**（diffusion 子页，与 LLM 同范式）：主区域为当前结果（大图 + 参数信息 + 提示词 + 保存到素材/相册，
    文生图结果可"作为底图"一键转图生图）；底部输入区：文生图/图生图切换 + 模型选择 chip（对话框内下载/换用）、
    图生图底图（素材库选取 + 重绘幅度）、采样步数、提示词 + 生成。右上角菜单抽屉=生成历史（切换/删除/新建），
    底部"生成设置"子页：采样器/CFG/种子/输出尺寸，**按模型独立保存**。
10. **语音生成**（tts 子页，与 LLM 同范式）：主区域为当前合成结果（大播放键 + 波形 + 文本 + 保存到素材），
    未下载模型时显示下载卡；底部输入区：音色选择 chip（对话框含音色管理入口）、CPU/NPU、文本 + 合成。
    右上角菜单抽屉=合成记录（切换/删除/新建），底部"音色管理"子页：从素材音频克隆新音色 + 已保存音色选用/删除。

## 与真机的刻意差异（原型简化）

- 动态取色不可还原，统一用 fallback 种子色 #E8A562（+M3 baseline 其余角色）。
- 开源条目图标用首字占位图（原型离线，不请求网络图标）。
- 下拉刷新为"点击模拟"链接；点云预览用 CSS 粒子舞台代替 GL 渲染。
- AI 对话/生图/语音结果均为模拟数据，用于验证布局与流程，不验证模型效果。
